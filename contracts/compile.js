// UTL Protocol — Solidity Compiler
// Uses solc npm package to compile all UTL contracts
// Run: node contracts/compile.js
// Output: contracts/artifacts/<ContractName>.json (ABI + bytecode)

const solc   = require('solc');
const fs     = require('fs');
const path   = require('path');

const ROOT  = __dirname;
const OUTDIR = path.join(ROOT, 'artifacts');

if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });

// Contracts to compile (in order — simpler ones first)
const TARGETS = [
    { file: 'utl/FlashArbLoan2.sol',    name: 'FlashArbLoan2' },
    { file: 'utl/UTLGuard.sol',          name: 'UTLGuard' },
    { file: 'utl/UTLdeBridgeRouter.sol', name: 'UTLdeBridgeRouter' },
    { file: 'utl/UTL1inchRouter.sol',    name: 'UTL1inchRouter' },
    { file: 'utl/UTLVenusWrapper.sol',   name: 'UTLVenusWrapper' },
];

// Read a file relative to the contracts root
function readContract(relPath) {
    const full = path.join(ROOT, relPath);
    if (!fs.existsSync(full)) throw new Error(`File not found: ${full}`);
    return fs.readFileSync(full, 'utf8');
}

// Collect all sources needed for a contract (including imports recursively)
function collectSources(entryRelPath, sources = {}) {
    if (sources[entryRelPath]) return sources;
    try {
        sources[entryRelPath] = { content: readContract(entryRelPath) };
    } catch {
        return sources;
    }
    const content = sources[entryRelPath].content;
    const importRe = /import\s+["']([^"']+)["']/g;
    let m;
    while ((m = importRe.exec(content)) !== null) {
        const importPath = m[1];
        const resolvedRel = path.normalize(path.join(path.dirname(entryRelPath), importPath));
        collectSources(resolvedRel, sources);
    }
    return sources;
}

// Compile a single contract
function compileContract(target) {
    console.log(`\nCompiling ${target.name}...`);
    const sources = collectSources(target.file);

    const input = {
        language: 'Solidity',
        sources,
        settings: {
            optimizer: { enabled: true, runs: 200 },
            viaIR: true,
            outputSelection: {
                '*': {
                    '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object']
                }
            }
        }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        const errors   = output.errors.filter(e => e.severity === 'error');
        const warnings = output.errors.filter(e => e.severity === 'warning');
        warnings.forEach(w => console.log(`   ⚠️  ${w.formattedMessage?.split('\n')[0] || w.message}`));
        if (errors.length > 0) {
            errors.forEach(e => console.error(`   ❌ ${e.formattedMessage || e.message}`));
            throw new Error(`Compilation failed for ${target.name}`);
        }
    }

    // Find the compiled contract
    let contractData = null;
    for (const [filePath, contracts] of Object.entries(output.contracts || {})) {
        if (contracts[target.name]) {
            contractData = contracts[target.name];
            break;
        }
    }

    if (!contractData) {
        throw new Error(`Contract ${target.name} not found in compiler output`);
    }

    const artifact = {
        contractName: target.name,
        abi: contractData.abi,
        bytecode: '0x' + contractData.evm.bytecode.object,
        deployedBytecode: '0x' + contractData.evm.deployedBytecode.object,
        compiler: `solc-${solc.version()}`,
        compiledAt: new Date().toISOString(),
    };

    const outPath = path.join(OUTDIR, `${target.name}.json`);
    fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
    console.log(`   ✅ ${target.name} compiled`);
    console.log(`      ABI functions: ${artifact.abi.filter(x => x.type === 'function').length}`);
    console.log(`      Bytecode size: ${Math.round(artifact.bytecode.length / 2)} bytes`);
    console.log(`      Saved: ${outPath}`);

    return artifact;
}

async function main() {
    console.log(`\n${'═'.repeat(60)}`);
    console.log('UTL Protocol — Contract Compilation');
    console.log(`Solc version: ${solc.version()}`);
    console.log(`${'═'.repeat(60)}`);

    const results = { compiled: [], failed: [] };

    for (const target of TARGETS) {
        try {
            compileContract(target);
            results.compiled.push(target.name);
        } catch (e) {
            console.error(`   ❌ FAILED: ${e.message}`);
            results.failed.push({ name: target.name, error: e.message });
        }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Compiled: ${results.compiled.length}/${TARGETS.length}`);
    if (results.compiled.length > 0) {
        results.compiled.forEach(n => console.log(`  ✅ ${n}`));
    }
    if (results.failed.length > 0) {
        console.log(`Failed:`);
        results.failed.forEach(f => console.log(`  ❌ ${f.name}: ${f.error}`));
    }
    console.log(`\nArtifacts in: contracts/artifacts/`);
    console.log(`Next: node contracts/scripts/deployAll.js`);
    console.log(`${'═'.repeat(60)}\n`);
}

main().catch(console.error);
