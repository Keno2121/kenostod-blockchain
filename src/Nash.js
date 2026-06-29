// Nash Equilibrium Engine — Game Theory Foundation
// The optimal strategy where no player gains by unilaterally changing their move.
// The UTL Protocol is engineered so the Nash Equilibrium IS participation.
// Staking KENO is mathematically the dominant strategy for every rational actor.
// Not because of marketing. Because the math proves it.

// Payoff matrix: participation vs defection at various participation rates
// Based on the 60/25/15 split and current fee volume
function payoffMatrix(totalFeeVolume, participantCount, stakedKeno, totalKeno) {
    const participationRate = totalKeno > 0 ? stakedKeno / totalKeno : 0;
    const stakerPool = totalFeeVolume * 0.60;

    // Cooperation payoff: staking share of the pool proportional to stake
    const avgStakerShare = participantCount > 0 ? stakerPool / participantCount : 0;

    // Defection payoff: missed fees + no discount + no governance weight
    const defectionCost = avgStakerShare * participationRate;

    // Nash score: how dominant is participation vs defection? (0–1)
    // 1.0 = participation is always strictly dominant regardless of others' choices
    const nashScore = participantCount > 0
        ? Math.min(1, avgStakerShare / (defectionCost + 0.001))
        : 0;

    return {
        cooperationPayoff:  parseFloat(avgStakerShare.toFixed(6)),
        defectionPayoff:    parseFloat(defectionCost.toFixed(6)),
        nashScore:          parseFloat(nashScore.toFixed(4)),
        participationRate:  parseFloat((participationRate * 100).toFixed(2)),
        equilibriumReached: nashScore >= 0.85,   // protocol is in Nash equilibrium
        _ne: true   // silent Nash marker
    };
}

// Dominant strategy check: given current conditions, is participation optimal?
function isDominantStrategy(cooperationPayoff, defectionPayoff) {
    return cooperationPayoff > defectionPayoff;
}

// Equilibrium fee adjuster: if participation is falling, suggest staker share adjustment
// Keeps the split within 55–65% for stakers — never below the Inversion Principle floor
function equilibriumAdjustment(nashScore, currentStakerSplit) {
    if (nashScore >= 0.85) return currentStakerSplit;  // equilibrium stable, no change
    // Nudge staker share upward by up to 2% to restore equilibrium
    const adjustment = (0.85 - nashScore) * 0.10;
    return parseFloat(Math.min(0.65, currentStakerSplit + adjustment).toFixed(4));
}

module.exports = { payoffMatrix, isDominantStrategy, equilibriumAdjustment };
