const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

async function verifySourcify(name, address, args) {
    console.log(`\nVerifying ${name} at ${address} (Sourcify)...`);
    try {
        await hre.run("verify:sourcify", {
            address,
            constructorArguments: args,
        });
        console.log(`  ✅ ${name} — verified on Sourcify`);
        return true;
    } catch (err) {
        const msg = err.message.toLowerCase();
        if (msg.includes("already verified") || msg.includes("perfect match") || msg.includes("partial match")) {
            console.log(`  ✅ ${name} — already verified`);
            return true;
        }
        console.log(`  ❌ ${name} — sourcify failed: ${err.message}`);
        return false;
    }
}

async function main() {
    const deploymentsDir = path.join(__dirname, "../deployments");

    const v11Path = path.join(deploymentsDir, "utl-v1.1-bsc.json");
    if (!fs.existsSync(v11Path)) throw new Error("utl-v1.1-bsc.json not found");
    const v11 = JSON.parse(fs.readFileSync(v11Path, "utf8"));

    const hookPath = path.join(deploymentsDir, "utlhook-bsc.json");
    if (!fs.existsSync(hookPath)) throw new Error("utlhook-bsc.json not found");
    const hook = JSON.parse(fs.readFileSync(hookPath, "utf8"));

    console.log("=".repeat(64));
    console.log("  Sourcify Verification — UTL Protocol v1.1 + UTLHook");
    console.log("  (Free, no API key needed — BSCScan shows Sourcify badge)");
    console.log("=".repeat(64));

    const results = [];

    for (const [name, data] of Object.entries(v11.contracts)) {
        const ok = await verifySourcify(name, data.address, data.constructorArgs);
        results.push({ name, address: data.address, ok });
    }

    const hookOk = await verifySourcify(
        "UTLHook",
        hook.address,
        [hook.poolManager, hook.feeCollector]
    );
    results.push({ name: "UTLHook", address: hook.address, ok: hookOk });

    console.log("\n" + "=".repeat(64));
    console.log("  RESULTS");
    console.log("=".repeat(64));
    let allPassed = true;
    for (const r of results) {
        console.log(`  ${r.ok ? "✅" : "❌"}  ${r.name}`);
        if (!r.ok) allPassed = false;
    }
    console.log("=".repeat(64));

    if (allPassed) {
        console.log("\n  All contracts verified via Sourcify! ✅");
        console.log("  BSCScan links (Sourcify badge visible in ~1 min):");
        for (const r of results) {
            console.log(`    ${r.name}: https://bscscan.com/address/${r.address}#code`);
        }
    } else {
        console.log("\n  Some verifications failed. Falling back to manual flatten...");
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("\n❌ Fatal:", err.message);
        process.exit(1);
    });
