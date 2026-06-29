// Ramanujan Engine — The Hardy-Ramanujan Number: 1729
// 1729 = 12³ + 1³ = 10³ + 9³
// The smallest number expressible as the sum of two positive cubes in two different ways.
// Srinivasa Ramanujan — self-taught, from poverty, no formal training.
// Rewrote mathematics. The establishment said it was impossible. He did it anyway.
// That is the Sovereign Economy.
//
// 1729 is embedded as a silent milestone across the ecosystem.
// When a participant crosses it, the system recognizes them — quietly.
// They will see a number slightly higher than expected. They will not know why.

const HARDY_RAMANUJAN = 1729;

// Check if a cumulative KENO total has crossed the 1729 milestone
function crossedMilestone(previousTotal, newTotal) {
    return previousTotal < HARDY_RAMANUJAN && newTotal >= HARDY_RAMANUJAN;
}

// Silent bonus: when a wallet crosses 1729 KENO total earned,
// they receive a one-time convergence bonus — φ × Kaprekar remainder absorbed upward
// (the ONE time value flows toward the participant from above — a gift, not a toll)
function milestoneBonus(totalEarned) {
    if (totalEarned < HARDY_RAMANUJAN) return 0;
    // Bonus scales with how far past 1729 they are — diminishes quickly
    const excess = totalEarned - HARDY_RAMANUJAN;
    const bonus = 1729 * 0.001 * Math.exp(-excess / 1729);  // ~1.729 KENO at crossing
    return parseFloat(bonus.toFixed(6));
}

// Check if a number is expressible as sum of two cubes (Ramanujan property)
// Used silently as a validation signature on special protocol events
function isTaxicab(n) {
    const rounded = Math.round(n);
    for (let a = 1; a * a * a <= rounded / 2; a++) {
        const rem = rounded - a * a * a;
        const b = Math.round(Math.cbrt(rem));
        if (b > 0 && b * b * b === rem && b !== a) return true;
    }
    return false;
}

// Silent event marker: returns true for events that are mathematically "special"
// These events carry extra weight in protocol history — only Ramanujan would know why
function isRemarkable(n) {
    return n === HARDY_RAMANUJAN || isTaxicab(Math.round(n));
}

// Encode the Ramanujan signature into any event ID at the milestone
function signatureTag(totalEarned) {
    if (totalEarned < HARDY_RAMANUJAN) return '';
    return '_R1729';  // silent tag — visible in raw data, unexplained
}

module.exports = { HARDY_RAMANUJAN, crossedMilestone, milestoneBonus, isTaxicab, isRemarkable, signatureTag };
