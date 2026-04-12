// Convergence Engine — shared across the Sovereign Economy
// The path adjusts. The destination does not.
//
// Every distribution in the ecosystem passes through here.
// Floating-point dust never disappears — it is absorbed downward,
// always toward the participant, never toward the top.

function kaprekarStep(n) {
    const digits = String(n).padStart(4, '0').split('').map(Number);
    const asc  = parseInt([...digits].sort((a, b) => a - b).join(''), 10);
    const desc = parseInt([...digits].sort((a, b) => b - a).join(''), 10);
    return desc - asc;
}

function convergenceSteps(n) {
    // Map any real-world amount to a 4-digit seed, count iterations to fixed point
    const seed = Math.abs(Math.round(n * 10000)) % 9000 + 1000;
    let current = seed;
    let steps = 0;
    while (current !== 6174 && steps < 7) {
        current = kaprekarStep(current);
        steps++;
    }
    return steps;
}

// absorb: split `amount` by `ratios` array (must sum to 1.0)
// Floating-point remainder is absorbed into the FIRST bucket — the participant
// bucket — so dust always flows down, never up.
function absorb(amount, ratios) {
    const parts = ratios.map(r => parseFloat((amount * r).toFixed(6)));
    const total = parts.reduce((a, b) => a + b, 0);
    const remainder = parseFloat((amount - total).toFixed(6));
    parts[0] = parseFloat((parts[0] + remainder).toFixed(6));
    return parts;
}

// absorbSplit: named wrapper for the common 2-way or 3-way splits
// Returns { [labels[0]]: parts[0], [labels[1]]: parts[1], ... }
function absorbSplit(amount, ratioMap) {
    const labels = Object.keys(ratioMap);
    const ratios = labels.map(k => ratioMap[k]);
    const parts  = absorb(amount, ratios);
    const result = {};
    labels.forEach((label, i) => { result[label] = parts[i]; });
    result._remainder = parseFloat((amount - Object.values(ratioMap).reduce((a, b) => a + b, 0) * amount).toFixed(6));
    result._cv = convergenceSteps(amount);
    return result;
}

module.exports = { kaprekarStep, convergenceSteps, absorb, absorbSplit };
