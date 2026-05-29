/**
 * Test Case 2: MEDIUM-RISK contract scan (lower score, different flag profile)
 *
 * Target: WETH (Wrapped ETH) on Pharos mainnet
 * Address: 0x1f4b7011Ee3d53969bb67F59428a9ec0477856E9
 *
 * Why this produces a DIFFERENT outcome than the high-risk test:
 *   - No owner() / admin() — no centralized control  → PASS
 *   - AccessControl role-management selectors detected → INFO (not warn)
 *   - Proxy behavior still flagged (bytecode contains f4)
 *   - No timelock delay functions
 *   - External call opcodes present
 *   - No reentrancy guard signature
 *
 * Key difference vs USDC (test:scan:high):
 *   USDC scores 100 with ALL warn flags (including owner + access-control)
 *   WETH scores ~74 with owner=PASS and access-control=INFO
 *   → Different score, different flag statuses, same High classification
 *
 * This validates the scanner's ability to differentiate between
 * fully centralized and access-controlled contracts.
 *
 * Usage:
 *   npm run test:scan:medium
 */
import { config } from "dotenv";
import { scanContract } from "../services/securityScanner.js";

config();

const WETH_ADDRESS = "0x1f4b7011Ee3d53969bb67F59428a9ec0477856E9";

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Pharos RealFi Security Scout — MEDIUM-RISK Test (WETH)");
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log(`Target:   WETH (Wrapped ETH)`);
  console.log(`Address:  ${WETH_ADDRESS}`);
  console.log(`Chain:    Pharos Mainnet (1672)`);
  console.log(`Expected: Lower score than USDC (~74), no owner flag, access control passes\n`);

  const report = await scanContract(WETH_ADDRESS, "yield strategy pool — WETH wrapper pre-interaction check");

  console.log("─── RESULT ─────────────────────────────────────────────");
  console.log(`Risk Score : ${report.riskScore}/100`);
  console.log(`Risk Level : ${report.riskLevel}`);
  console.log(`Target Type: ${report.targetType}`);
  console.log(`Headline   : ${report.headline}`);
  console.log();

  console.log("─── FLAGS ──────────────────────────────────────────────");
  for (const flag of report.flags) {
    const icon = flag.status === "pass" ? "✅" : flag.status === "warn" ? "⚠️" : flag.status === "info" ? "ℹ️" : "❌";
    console.log(`${icon}  [${flag.status.toUpperCase()}] ${flag.check} (+${flag.scoreImpact})`);
    console.log(`   ${flag.details}`);
    if (flag.evidence?.length) {
      console.log(`   Evidence: ${flag.evidence.join(", ")}`);
    }
  }

  console.log();
  console.log("─── METADATA ───────────────────────────────────────────");
  console.log(`Bytecode size    : ${report.metadata.bytecodeSize} bytes`);
  console.log(`Proxy detected   : ${report.metadata.proxyDetected}`);
  console.log(`Owner detected   : ${report.metadata.ownerDetected}`);
  console.log(`Timelock detected: ${report.metadata.timelockDetected}`);
  console.log(`Admin functions  : ${report.metadata.adminFunctionsDetected.join(", ") || "none"}`);
  console.log();

  console.log("─── EXECUTIVE SUMMARY ──────────────────────────────────");
  console.log(report.executiveSummary);
  console.log();

  // Expect: no owner detected AND lower score than USDC (which scores 100)
  const ownerNotDetected = report.metadata.ownerDetected === false;
  const lowerThanMax = report.riskScore < 100;
  const passed = ownerNotDetected && lowerThanMax;

  if (passed) {
    console.log(`✅ TEST PASSED — WETH scored ${report.riskScore}/100 (< 100), no owner privilege detected.`);
    console.log("   Successfully differentiated from the USDC high-risk profile.");
  } else {
    console.log(`⚠️  TEST NOTE — Score: ${report.riskScore}, Owner: ${report.metadata.ownerDetected}.`);
    console.log("   Expected score < 100 with no owner detected.");
  }
  console.log("═══════════════════════════════════════════════════════════\n");

  if (!passed) process.exit(1);
}

main().catch((error) => {
  console.error("Scan failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
