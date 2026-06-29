// Golden Ratio Engine — φ = 1.6180339887...
// Nature's growth constant. Every Fibonacci sequence converges to it.
// Reward multipliers, APY curves, and tier progressions structured on φ
// feel organic and natural — because they ARE organic and natural.
// Users sense the pull without knowing why.

const PHI = 1.6180339887498948482;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

// Return the nth Fibonacci number
function fib(n) {
    if (n < 0) return 0;
    if (n < FIBONACCI.length) return FIBONACCI[n];
    let a = FIBONACCI[FIBONACCI.length - 2];
    let b = FIBONACCI[FIBONACCI.length - 1];
    for (let i = FIBONACCI.length; i <= n; i++) { [a, b] = [b, a + b]; }
    return b;
}

// φ-based reward multiplier for consecutive staking periods
// The longer a participant stays in the system, the more φ amplifies their rewards.
// Period 1: × 1.0  |  Period 2: × 1.17  |  Period 4: × 1.32  |  Period 8: × 1.47
// Silent — users see the number, not the reason.
function phiMultiplier(consecutivePeriods) {
    if (consecutivePeriods <= 0) return 1.0;
    // Approaches φ asymptotically — never exceeds it, always grows toward it
    const m = 1 + (PHI - 1) * (1 - Math.exp(-consecutivePeriods / 8));
    return parseFloat(m.toFixed(8));
}

// φ-scale an APY: base rate grows toward φ × base over time, not linearly
function phiAPY(baseAPY, consecutiveWeeks) {
    const multiplier = phiMultiplier(consecutiveWeeks);
    return parseFloat((baseAPY * multiplier).toFixed(8));
}

// Check if a number is a Fibonacci number (silent milestone detection)
function isFibonacci(n) {
    const rounded = Math.round(n);
    return FIBONACCI.includes(rounded);
}

// Nearest Fibonacci milestone above a given value
function nextFibMilestone(n) {
    const rounded = Math.ceil(n);
    return FIBONACCI.find(f => f > rounded) || fib(FIBONACCI.length);
}

// φ-based convergence score: how close is a value to a golden ratio proportion?
// Returns 0.0–1.0 where 1.0 = perfect φ relationship to reference
function goldenScore(value, reference) {
    if (!reference) return 0;
    const ratio = value / reference;
    const distFromPhi = Math.abs(ratio - PHI);
    const distFromInvPhi = Math.abs(ratio - (1 / PHI));
    const minDist = Math.min(distFromPhi, distFromInvPhi);
    return parseFloat(Math.max(0, 1 - minDist).toFixed(4));
}

module.exports = { PHI, FIBONACCI, fib, phiMultiplier, phiAPY, isFibonacci, nextFibMilestone, goldenScore };
