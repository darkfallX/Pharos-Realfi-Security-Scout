/**
 * Test Case 1: MAXIMUM-RISK contract scan
 *
 * Target: USDC (Circle-deployed) on Pharos mainnet
 * Address: 0xC879C018dB60520F4355C26eD1a6D572cdAC1815
 *
 * Why this should score very HIGH:
 *   - owner() returns a live admin address (centralized control)
 *   - Proxy pattern detected (EIP-1967 upgrade capability)
 *   - No timelock delay functions
 *   - External CALL and DELEGATECALL opcodes present
 *   - No standard reentrancy guard signature
 *   - No AccessControl role-management selectors detected
 *   - ALL six checks trigger warnings → maximum score (100)
 *
 * This is an excellent test because it shows the scanner correctly
 * flagging maximum structural risk from the perspective of an
 * autonomous agent: upgradeable + centrally owned + no timelock.
 *
 * Usage:
 *   npm run test:scan:high
 */
import { config } from "dotenv";
import { scanContract } from "../services/securityScanner.js";

config();

const USDC_ADDRESS = "0xC879C018dB60520F4355C26eD1a6D572cdAC1815";

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Pharos RealFi Security Scout — MAXIMUM-RISK Test");
  console.log("═══════════════════════════════════════════════════════\n");
  console.log(`Target:   USDC (Circle-deployed stablecoin)`);
  console.log(`Address:  ${USDC_ADDRESS}`);
  console.log(`Chain:    Pharos Mainnet (1672)`);
  console.log(`Expected: High risk score (≥ 90) — all flags warn\n`);

  const report = await scanContract(USDC_ADDRESS, "RWA vault pre-deposit risk gate — USDC stablecoin audit");

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

  // Expect High risk with owner detected
  const passed = report.riskLevel === "High" && report.metadata.ownerDetected === true;
  if (passed) {
    console.log("✅ TEST PASSED — USDC scored High with owner privilege detected.");
  } else {
    console.log(`⚠️  TEST NOTE — Score: ${report.riskScore} (${report.riskLevel}), Owner: ${report.metadata.ownerDetected}.`);
    console.log("   Expected High risk with owner detected.");
  }
  console.log("═══════════════════════════════════════════════════════\n");

  if (!passed) process.exit(1);
}

main().catch((error) => {
  console.error("Scan failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
