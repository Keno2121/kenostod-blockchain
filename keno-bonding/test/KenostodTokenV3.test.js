const { expect } = require("chai");
const { ethers } = require("hardhat");
const allocationPlan = require("../config/keno-v3-allocation.json");
const forensicSnapshot = require("../migration/v2-forensic-snapshot.json");
const rawHolderSnapshot = require("../migration/evidence/holders-119792272.json");
const criticalEvidence = require("../migration/evidence/critical-chain-evidence.json");

describe("KenostodTokenV3", function () {
  async function deployFixture() {
    const [deployer, owner, treasury, user, nextOwner] =
      await ethers.getSigners();
    const Token = await ethers.getContractFactory("KenostodTokenV3", deployer);
    const token = await Token.deploy(owner.address, treasury.address);
    await token.waitForDeployment();

    return { token, deployer, owner, treasury, user, nextOwner };
  }

  it("keeps the approved allocation ledger equal to the fixed supply", async function () {
    const allocated = allocationPlan.allocations.reduce(
      (total, allocation) => total + allocation.amountKeno,
      0
    );
    const percentage = allocationPlan.allocations.reduce(
      (total, allocation) => total + allocation.percentage,
      0
    );

    expect(allocated).to.equal(allocationPlan.totalSupplyKeno);
    expect(allocated).to.equal(1_000_000_000);
    expect(percentage).to.equal(100);
  });

  it("keeps confirmed contributor obligations within their approved bucket", async function () {
    const contributorBucket = allocationPlan.allocations.find(
      (allocation) => allocation.id === "marketing-contributors"
    );
    const confirmedObligations =
      allocationPlan.confirmedContributorObligations.reduce(
        (total, obligation) => total + obligation.amountKeno,
        0
      );

    expect(contributorBucket).to.not.equal(undefined);
    expect(confirmedObligations).to.equal(100_000);
    expect(confirmedObligations).to.be.at.most(
      contributorBucket.amountKeno
    );
  });

  it("records the verified migration snapshot without exceeding its reserve", async function () {
    const migrationBucket = allocationPlan.allocations.find(
      (allocation) => allocation.id === "v2-migration"
    );

    expect(migrationBucket.amountKeno).to.equal(100_000_000);
    expect(allocationPlan.migrationPolicy.ratio).to.equal("1:1");
    expect(allocationPlan.migrationPolicy.claimPeriodMonths).to.equal(12);
    expect(allocationPlan.migrationPolicy.snapshotBlock).to.equal(
      119_792_272
    );
    expect(allocationPlan.migrationPolicy.snapshotStatus).to.equal(
      "forensically-verified"
    );
    expect(allocationPlan.migrationPolicy.eligibleClaimCount).to.equal(12);
    expect(allocationPlan.migrationPolicy.merkleRoot).to.equal(
      forensicSnapshot.merkle.root
    );
  });

  it("records the approved reward and release controls", async function () {
    expect(allocationPlan.rewardPolicy.transferableAt).to.equal(
      "verified-graduation"
    );
    expect(
      allocationPlan.releasePolicy.teamDevelopment.launchUnlockPercentage
    ).to.equal(0);
    expect(
      allocationPlan.releasePolicy.teamDevelopment.vestingMonths
    ).to.equal(12);
    expect(
      allocationPlan.releasePolicy.initialProtocolOwnedLiquidity
        .minimumLpLockMonths
    ).to.equal(12);
    expect(
      allocationPlan.releasePolicy.confirmedContributorCompensation.release
    ).to.equal(
      "Fully unlocked after beneficiary and payment verification"
    );
    expect(
      allocationPlan.releasePolicy.treasuryControlledProgramBuckets
        .fixedApprovalRecordRequired
    ).to.equal(false);
  });

  it("keeps verified v2 claims within the migration reserve", async function () {
    const eligibleTotal = forensicSnapshot.eligibleClaims.reduce(
      (total, claim) => total + BigInt(claim.amountRaw),
      0n
    );
    const reserve = BigInt(forensicSnapshot.totals.migrationReserveRaw);

    expect(eligibleTotal.toString()).to.equal(
      forensicSnapshot.totals.eligibleMigrationRaw
    );
    expect(eligibleTotal).to.be.lessThan(reserve);
    expect(forensicSnapshot.snapshot.blockNumber).to.equal(119_792_272);
    expect(forensicSnapshot.eligibleClaims).to.have.length(12);
  });

  it("excludes compromised and project-controlled v2 balances", async function () {
    const excludedCategories = new Set(
      forensicSnapshot.classifications
        .filter((holder) => !holder.eligible)
        .map((holder) => holder.category)
    );

    expect(excludedCategories).to.include("compromised-project-wallet");
    expect(excludedCategories).to.include(
      "undistributed-fjord-project-inventory"
    );
    expect(excludedCategories).to.include(
      "compromised-wallet-staking-position"
    );
    expect(excludedCategories).to.include("project-liquidity-pool");
    expect(excludedCategories).to.include("dead-address");
  });

  it("reconciles retained primary evidence with the classified supply", async function () {
    const rawSupply = rawHolderSnapshot.holders.reduce(
      (total, holder) => total + BigInt(holder.balance),
      0n
    );
    const classifiedSupply = forensicSnapshot.classifications.reduce(
      (total, holder) => total + BigInt(holder.balanceRaw),
      0n
    );

    expect(rawHolderSnapshot.blockNumber).to.equal(
      forensicSnapshot.snapshot.blockNumber
    );
    expect(rawSupply.toString()).to.equal(forensicSnapshot.totalSupplyRaw);
    expect(classifiedSupply).to.equal(rawSupply);
    expect(
      criticalEvidence.pinksaleCalls.purchasedOf.resultRaw
    ).to.equal(
      forensicSnapshot.additionalObligations[0].amountRaw
    );
    expect(criticalEvidence.stakingCalls.getStakerCount.result).to.equal(1);
    expect(
      criticalEvidence.postCompromiseTransferScan.reviewedExternalAcquisitions
    ).to.have.length(2);
  });

  it("mints the fixed supply once to the chosen recipient", async function () {
    const { token, deployer, owner, treasury } = await deployFixture();
    const supply = ethers.parseEther("1000000000");

    expect(await token.totalSupply()).to.equal(supply);
    expect(await token.MAX_SUPPLY()).to.equal(supply);
    expect(await token.balanceOf(treasury.address)).to.equal(supply);
    expect(await token.balanceOf(deployer.address)).to.equal(0);
    expect(await token.balanceOf(owner.address)).to.equal(0);
  });

  it("keeps the deployer separate from ownership", async function () {
    const { token, deployer, owner } = await deployFixture();

    expect(await token.owner()).to.equal(owner.address);
    await expect(token.connect(deployer).pause())
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
      .withArgs(deployer.address);
  });

  it("allows normal ERC-20 transfers", async function () {
    const { token, treasury, user } = await deployFixture();
    const amount = ethers.parseEther("100");

    await token.connect(treasury).transfer(user.address, amount);
    expect(await token.balanceOf(user.address)).to.equal(amount);
  });

  it("lets holders burn tokens and reduces reported total supply", async function () {
    const { token, treasury } = await deployFixture();
    const amount = ethers.parseEther("100");
    const initialSupply = await token.totalSupply();

    await token.connect(treasury).burn(amount);

    expect(await token.balanceOf(treasury.address)).to.equal(
      initialSupply - amount
    );
    expect(await token.totalSupply()).to.equal(initialSupply - amount);
  });

  it("supports approved burns without giving the owner seizure power", async function () {
    const { token, owner, treasury, user } = await deployFixture();
    const amount = ethers.parseEther("25");
    const initialSupply = await token.totalSupply();

    await expect(
      token.connect(owner).burnFrom(treasury.address, amount)
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");

    await token.connect(treasury).approve(user.address, amount);
    await token.connect(user).burnFrom(treasury.address, amount);

    expect(await token.totalSupply()).to.equal(initialSupply - amount);
    expect(await token.allowance(treasury.address, user.address)).to.equal(0);
  });

  it("lets only the owner pause and unpause transfers", async function () {
    const { token, owner, treasury, user } = await deployFixture();

    await expect(token.connect(user).pause())
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
      .withArgs(user.address);

    await token.connect(owner).pause();
    await expect(
      token.connect(treasury).transfer(user.address, 1)
    ).to.be.revertedWithCustomError(token, "EnforcedPause");
    await expect(token.connect(user).unpause())
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
      .withArgs(user.address);

    await token.connect(owner).unpause();
    await token.connect(treasury).transfer(user.address, 1);
    expect(await token.balanceOf(user.address)).to.equal(1);
  });

  it("blocks allowance-based transfers while paused", async function () {
    const { token, owner, treasury, user, nextOwner } = await deployFixture();
    const amount = ethers.parseEther("10");

    await token.connect(treasury).approve(user.address, amount);
    await token.connect(owner).pause();
    await expect(
      token
        .connect(user)
        .transferFrom(treasury.address, nextOwner.address, amount)
    ).to.be.revertedWithCustomError(token, "EnforcedPause");
  });

  it("blocks direct and allowance-based burns while paused", async function () {
    const { token, owner, treasury, user } = await deployFixture();
    const amount = ethers.parseEther("10");

    await token.connect(treasury).approve(user.address, amount);
    await token.connect(owner).pause();

    await expect(
      token.connect(treasury).burn(amount)
    ).to.be.revertedWithCustomError(token, "EnforcedPause");
    await expect(
      token.connect(user).burnFrom(treasury.address, amount)
    ).to.be.revertedWithCustomError(token, "EnforcedPause");
  });

  it("requires the proposed owner to accept ownership", async function () {
    const { token, owner, user, nextOwner } = await deployFixture();

    await token.connect(owner).transferOwnership(nextOwner.address);
    expect(await token.owner()).to.equal(owner.address);
    expect(await token.pendingOwner()).to.equal(nextOwner.address);
    await expect(token.connect(user).acceptOwnership())
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
      .withArgs(user.address);

    await token.connect(nextOwner).acceptOwnership();
    expect(await token.owner()).to.equal(nextOwner.address);
  });

  it("lets the current owner replace a pending ownership transfer", async function () {
    const { token, owner, user, nextOwner } = await deployFixture();

    await token.connect(owner).transferOwnership(user.address);
    await token.connect(owner).transferOwnership(nextOwner.address);
    expect(await token.pendingOwner()).to.equal(nextOwner.address);
    await expect(token.connect(user).acceptOwnership())
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
      .withArgs(user.address);
  });

  it("does not permit ownership renunciation", async function () {
    const { token, owner } = await deployFixture();

    await expect(token.connect(owner).renounceOwnership())
      .to.be.revertedWithCustomError(token, "RenouncingOwnershipDisabled");
  });

  it("exposes no mint, blacklist, clawback, or forced-transfer functions", async function () {
    const { token } = await deployFixture();
    const forbidden = [
      "mint(address,uint256)",
      "blacklist(address)",
      "clawback(address,uint256)",
      "forceTransfer(address,address,uint256)",
    ];

    for (const signature of forbidden) {
      expect(token.interface.getFunction(signature)).to.equal(null);
    }
  });

  it("rejects zero owner and supply-recipient addresses", async function () {
    const [deployer, owner, treasury] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("KenostodTokenV3", deployer);

    await expect(
      Token.deploy(ethers.ZeroAddress, treasury.address)
    ).to.be.revertedWithCustomError(Token, "OwnableInvalidOwner");

    await expect(
      Token.deploy(owner.address, ethers.ZeroAddress)
    ).to.be.revertedWith("KENO: recipient is zero");
  });

  it("enforces separation from the one-time deployer", async function () {
    const [deployer, owner, treasury] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("KenostodTokenV3", deployer);

    await expect(
      Token.deploy(deployer.address, treasury.address)
    ).to.be.revertedWithCustomError(Token, "DeployerCannotBeOwner");

    await expect(
      Token.deploy(owner.address, deployer.address)
    ).to.be.revertedWithCustomError(Token, "DeployerCannotReceiveSupply");
  });
});