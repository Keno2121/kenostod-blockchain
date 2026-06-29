/*!
 * Shield Bonds — Anchor Program (Solana)
 * =======================================
 * Protocol-Owned Liquidity bonding for King's Shield (SHIELD) token.
 *
 * Bond Mechanism (OlympusDAO-style):
 *   1. User deposits SOL (or SHIELD/SOL LP tokens)
 *   2. Program issues discounted SHIELD over a 5-day vesting period
 *   3. SOL is paired with SHIELD to add Raydium SHIELD/SOL liquidity
 *   4. Protocol owns LP tokens → earns trading fees perpetually
 *   5. Aegis Tax on SHIELD transfers accumulates in treasury
 *   6. When treasury threshold hit → bridge SOL to BSC → burn KENO
 *
 * Status: Architecture skeleton — ready for full Anchor implementation.
 *         Full program requires Rust/Anchor developer engagement.
 *
 * PDAs:
 *   - BondMarket:  [b"bond_market", authority.key()]
 *   - BondAccount: [b"bond", user.key(), bond_index.to_le_bytes()]
 *   - Treasury:    [b"treasury", bond_market.key()]
 *
 * Dependencies (Cargo.toml):
 *   anchor-lang = "0.30.1"
 *   anchor-spl  = "0.30.1"
 */

use anchor_lang::prelude::*;

declare_id!("SHLDbondXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"); // replace after deploy

// ── Constants ────────────────────────────────────────────────────────────
pub const BOND_VESTING_SECONDS: i64 = 5 * 24 * 60 * 60; // 5 days
pub const MAX_DISCOUNT_BPS:     u64  = 1_000;             // 10% max discount
pub const AEGIS_TAX_BPS:        u64  = 300;               // 3% Aegis Tax on transfers
pub const MIN_SOL_DEPOSIT:      u64  = 10_000_000;        // 0.01 SOL minimum

// ── Program ──────────────────────────────────────────────────────────────
#[program]
pub mod shield_bonds {
    use super::*;

    /// Initialize a new Bond Market (called once by authority).
    pub fn initialize_market(
        ctx:              Context<InitializeMarket>,
        discount_bps:     u64,
        bond_capacity:    u64,
    ) -> Result<()> {
        require!(discount_bps <= MAX_DISCOUNT_BPS, ShieldError::DiscountTooHigh);

        let market = &mut ctx.accounts.bond_market;
        market.authority     = ctx.accounts.authority.key();
        market.shield_mint   = ctx.accounts.shield_mint.key();
        market.treasury      = ctx.accounts.treasury.key();
        market.discount_bps  = discount_bps;
        market.bond_capacity = bond_capacity;
        market.bonds_sold    = 0;
        market.total_sol_raised = 0;
        market.paused        = false;
        market.bond_count    = 0;

        emit!(MarketInitialized {
            authority:    market.authority,
            discount_bps: market.discount_bps,
            capacity:     market.bond_capacity,
        });

        Ok(())
    }

    /// User purchases a bond by depositing SOL.
    /// Returns discounted SHIELD after vesting period.
    pub fn purchase_bond(
        ctx:        Context<PurchaseBond>,
        sol_amount: u64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.bond_market;
        require!(!market.paused,                  ShieldError::MarketPaused);
        require!(sol_amount >= MIN_SOL_DEPOSIT,   ShieldError::DepositTooSmall);
        require!(
            market.bonds_sold < market.bond_capacity,
            ShieldError::MarketCapacityReached
        );

        // Calculate SHIELD payout with discount
        // payout = sol_amount * shield_price * (1 + discount_bps / 10000)
        // NOTE: shield_price oracle integration needed here (e.g., Pyth)
        let shield_payout = calculate_payout(sol_amount, market.discount_bps);

        let bond = &mut ctx.accounts.bond_account;
        bond.owner        = ctx.accounts.user.key();
        bond.sol_deposited = sol_amount;
        bond.shield_payout = shield_payout;
        bond.vested_at    = Clock::get()?.unix_timestamp + BOND_VESTING_SECONDS;
        bond.claimed      = false;
        bond.bond_index   = market.bond_count;

        market.bonds_sold       += shield_payout;
        market.total_sol_raised += sol_amount;
        market.bond_count       += 1;

        // Transfer SOL from user to treasury
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to:   ctx.accounts.treasury.to_account_info(),
                },
            ),
            sol_amount,
        )?;

        emit!(BondPurchased {
            user:           bond.owner,
            sol_deposited:  sol_amount,
            shield_payout:  shield_payout,
            vests_at:       bond.vested_at,
        });

        Ok(())
    }

    /// User claims vested SHIELD after lock period.
    pub fn claim_bond(ctx: Context<ClaimBond>) -> Result<()> {
        let bond   = &mut ctx.accounts.bond_account;
        let clock  = Clock::get()?;

        require!(!bond.claimed,                              ShieldError::AlreadyClaimed);
        require!(clock.unix_timestamp >= bond.vested_at,    ShieldError::NotVestedYet);

        bond.claimed = true;

        // Transfer SHIELD tokens from vault to user
        // (SPL token CPI — implementation here after mint setup)
        // anchor_spl::token::transfer(...) → shield_payout to user

        emit!(BondClaimed {
            user:          bond.owner,
            shield_amount: bond.shield_payout,
        });

        Ok(())
    }

    /// Authority: pause/unpause bond market.
    pub fn set_paused(ctx: Context<AuthorityOnly>, paused: bool) -> Result<()> {
        ctx.accounts.bond_market.paused = paused;
        Ok(())
    }

    /// Authority: update discount rate (market conditions may change).
    pub fn update_discount(ctx: Context<AuthorityOnly>, new_bps: u64) -> Result<()> {
        require!(new_bps <= MAX_DISCOUNT_BPS, ShieldError::DiscountTooHigh);
        ctx.accounts.bond_market.discount_bps = new_bps;
        Ok(())
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────
fn calculate_payout(sol_amount: u64, discount_bps: u64) -> u64 {
    // Placeholder: 1 SOL = 1000 SHIELD at base rate, adjusted by discount
    // Production: replace with Pyth oracle price feed
    let base_rate: u64 = 1_000;
    let multiplier = 10_000 + discount_bps;
    sol_amount
        .saturating_mul(base_rate)
        .saturating_mul(multiplier)
        / 10_000
}

// ── Accounts ─────────────────────────────────────────────────────────────
#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        payer  = authority,
        space  = BondMarket::LEN,
        seeds  = [b"bond_market", authority.key().as_ref()],
        bump
    )]
    pub bond_market:  Account<'info, BondMarket>,
    /// CHECK: SHIELD SPL mint address
    pub shield_mint:  UncheckedAccount<'info>,
    /// CHECK: Treasury PDA
    pub treasury:     UncheckedAccount<'info>,
    #[account(mut)]
    pub authority:    Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(sol_amount: u64)]
pub struct PurchaseBond<'info> {
    #[account(mut, seeds = [b"bond_market", bond_market.authority.as_ref()], bump)]
    pub bond_market:  Account<'info, BondMarket>,
    #[account(
        init,
        payer = user,
        space = BondAccount::LEN,
        seeds = [b"bond", user.key().as_ref(), bond_market.bond_count.to_le_bytes().as_ref()],
        bump
    )]
    pub bond_account: Account<'info, BondAccount>,
    /// CHECK: treasury receives SOL
    #[account(mut)]
    pub treasury:     UncheckedAccount<'info>,
    #[account(mut)]
    pub user:         Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimBond<'info> {
    #[account(mut, seeds = [b"bond", user.key().as_ref(), bond_account.bond_index.to_le_bytes().as_ref()], bump)]
    pub bond_account: Account<'info, BondAccount>,
    pub user:         Signer<'info>,
}

#[derive(Accounts)]
pub struct AuthorityOnly<'info> {
    #[account(mut, has_one = authority)]
    pub bond_market: Account<'info, BondMarket>,
    pub authority:   Signer<'info>,
}

// ── State ─────────────────────────────────────────────────────────────────
#[account]
pub struct BondMarket {
    pub authority:        Pubkey,  // 32
    pub shield_mint:      Pubkey,  // 32
    pub treasury:         Pubkey,  // 32
    pub discount_bps:     u64,     // 8
    pub bond_capacity:    u64,     // 8
    pub bonds_sold:       u64,     // 8
    pub total_sol_raised: u64,     // 8
    pub bond_count:       u64,     // 8
    pub paused:           bool,    // 1
}

impl BondMarket {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 64;
}

#[account]
pub struct BondAccount {
    pub owner:         Pubkey,  // 32
    pub sol_deposited: u64,     // 8
    pub shield_payout: u64,     // 8
    pub vested_at:     i64,     // 8
    pub claimed:       bool,    // 1
    pub bond_index:    u64,     // 8
}

impl BondAccount {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 1 + 8 + 32;
}

// ── Events ────────────────────────────────────────────────────────────────
#[event]
pub struct MarketInitialized {
    pub authority:    Pubkey,
    pub discount_bps: u64,
    pub capacity:     u64,
}

#[event]
pub struct BondPurchased {
    pub user:          Pubkey,
    pub sol_deposited: u64,
    pub shield_payout: u64,
    pub vests_at:      i64,
}

#[event]
pub struct BondClaimed {
    pub user:          Pubkey,
    pub shield_amount: u64,
}

// ── Errors ────────────────────────────────────────────────────────────────
#[error_code]
pub enum ShieldError {
    #[msg("Discount exceeds maximum allowed (10%)")]
    DiscountTooHigh,
    #[msg("Bond market is paused")]
    MarketPaused,
    #[msg("Deposit below minimum (0.01 SOL)")]
    DepositTooSmall,
    #[msg("Bond market capacity reached")]
    MarketCapacityReached,
    #[msg("Bond already claimed")]
    AlreadyClaimed,
    #[msg("Bond not yet vested — wait for 5-day lock")]
    NotVestedYet,
}
