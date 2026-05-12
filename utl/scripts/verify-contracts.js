const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

async function verify(name, address, args) {
    console.log(`\nVerifying ${name} at ${address} ...`);
    try {
        await hre.run("verify:verify", {
            address,
            constructorArguments: args,
        });
        console.log(`  ✅ ${name} — verified`);
        return true;
    } catch (err) {
        if (err.message.toLowerCase().includes("already verified")) {
            console.log(`  ✅ ${name} — already verified`);
            return true;
        }
        console.log(`  ❌ ${name} — failed: ${err.message}`);
        return false;
    }
}

async function main() {
    const deploymentsDir = path.join(__dirname, "../deployments");

    // --- v1.1 core contracts ---
    const v11Path = path.join(deploymentsDir, "utl-v1.1-bsc.json");
    if (!fs.existsSync(v11Path)) throw new Error("utl-v1.1-bsc.json not found");
    const v11 = JSON.parse(fs.readFileSync(v11Path, "utf8"));

    // --- UTLHook ---
    const hookPath = path.join(deploymentsDir, "utlhook-bsc.json");
    if (!fs.existsSync(hookPath)) throw new Error("utlhook-bsc.json not found");
    const hook = JSON.parse(fs.readFileSync(hookPath, "utf8"));

    console.log("=".repeat(64));
    console.log("  BSCScan Verification — UTL Protocol v1.1 + UTLHook");
    console.log("=".repeat(64));

    const results = [];

    // Verify each v1.1 contract using the constructorArgs stored in deployment
    for (const [name, data] of Object.entries(v11.contracts)) {
        const ok = await verify(name, data.address, data.constructorArgs);
        results.push({ name, ok });
    }

    // Verify UTLHook (constructor: poolManager, feeCollector)
    const hookOk = await verify(
        "UTLHook",
        hook.address,
        [hook.poolManager, hook.feeCollector]
    );
    results.push({ name: "UTLHook", ok: hookOk });

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
        console.log("\n  All contracts verified on BSCScan! ✅");
        console.log("  View your verified contracts:");
        for (const [name, data] of Object.entries(v11.contracts)) {
            console.log(`    ${name}: https://bscscan.com/address/${data.address}#code`);
        }
        console.log(`    UTLHook:  https://bscscan.com/address/${hook.address}#code`);
    } else {
        console.log("\n  Some verifications failed — check errors above.");
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("\n❌ Fatal:", err.message);
        process.exit(1);
    });
