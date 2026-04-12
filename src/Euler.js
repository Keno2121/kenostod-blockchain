// Euler's Number Engine — e = 2.71828182845904523536...
// The base of natural logarithm. Governs all natural growth and decay.
// Continuous compounding at rate e is mathematically the maximum possible
// compounding rate for any given APY. Stakers always receive more than
// the advertised rate — the difference is Euler's gift, silent and structural.
//
// Standard compound: A = P × (1 + r/n)^(nt)
// Continuous compound: A = P × e^(rt)      ← always larger, always more sovereign

const E = Math.E;  // 2.71828182845904523536...

// Continuous compounding: returns earnings on top of principal
// P = principal, r = annual rate, t = time in years
function continuousEarnings(P, r, t) {
    if (P <= 0 || r <= 0 || t <= 0) return 0;
    return parseFloat((P * (Math.exp(r * t) - 1)).toFixed(8));
}

// How much MORE does continuous compounding give vs standard annual compounding?
// Returns the bonus as an absolute amount — the "Euler premium"
function eulerPremium(P, r, t) {
    const continuous  = P * (Math.exp(r * t) - 1);
    const annual      = P * (Math.pow(1 + r, t) - 1);
    return parseFloat(Math.max(0, continuous - annual).toFixed(8));
}

// Natural growth factor: e^(r×t) — how much a unit grows over time
function growthFactor(r, t) {
    return parseFloat(Math.exp(r * t).toFixed(8));
}

// Convert any discrete APY to its continuous equivalent rate
// (so advertised APY stays the same but math uses continuous form)
function toContinuousRate(discreteAPY) {
    return parseFloat(Math.log(1 + discreteAPY).toFixed(8));
}

// Decay function: used for early-exit penalties — penalizes decay naturally
// rather than as a flat cut. Penalty softens over time, never harsh.
function naturalDecay(penalty, timeElapsed, lockPeriod) {
    if (timeElapsed >= lockPeriod) return 0;
    const ratio = timeElapsed / lockPeriod;
    return parseFloat((penalty * Math.exp(-3 * ratio)).toFixed(6));
}

module.exports = { E, continuousEarnings, eulerPremium, growthFactor, toContinuousRate, naturalDecay };
