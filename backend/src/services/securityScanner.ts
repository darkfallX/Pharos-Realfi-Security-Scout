import { Interface, JsonRpcProvider, getAddress, id, isAddress } from "ethers";
import { env } from "../config/env.js";
import type { RiskFlag, RiskLevel, SecurityReport } from "../types/risk.js";

const provider = new JsonRpcProvider(env.PHAROS_RPC, env.PHAROS_CHAIN_ID);

const ownerProbeInterface = new Interface([
  "function owner() view returns (address)",
  "function admin() view returns (address)",
  "function getOwner() view returns (address)",
  "function pendingOwner() view returns (address)",
  "function getMinDelay() view returns (uint256)",
  "function minDelay() view returns (uint256)",
  "function delay() view returns (uint256)"
]);

const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dcA3e2076cc3735a920a3ca505d382bbc";
const EIP1967_ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

async function safeEthCall(contractAddress: string, functionName: string): Promise<string | null> {
  try {
    const data = ownerProbeInterface.encodeFunctionData(functionName);
    const output = await provider.call({ to: contractAddress, data });
    if (!output || output === "0x") {
      return null;
    }
    return output;
  } catch {
    return null;
  }
}

function parseAddressResult(functionName: string, hex: string | null): string | null {
  if (!hex) return null;
  try {
    const decoded = ownerProbeInterface.decodeFunctionResult(functionName, hex);
    const value = decoded[0] as string;
    if (!value || value === "0x0000000000000000000000000000000000000000") return null;
    return getAddress(value);
  } catch {
    return null;
  }
}

function parseDelayResult(functionName: string, hex: string | null): bigint | null {
  if (!hex) return null;
  try {
    const decoded = ownerProbeInterface.decodeFunctionResult(functionName, hex);
    const value = decoded[0] as bigint;
    return value;
  } catch {
    return null;
  }
}

function hasOpcode(bytecode: string, opcodeHex: string): boolean {
  return bytecode.toLowerCase().includes(opcodeHex.toLowerCase());
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function estimateTargetType(context?: string): SecurityReport["targetType"] {
  if (!context) return "Unknown";
  const normalized = context.toLowerCase();
  if (normalized.includes("vault") || normalized.includes("rwa") || normalized.includes("yield")) return "RealFiPosition";
  if (normalized.includes("strategy") || normalized.includes("orderbook") || normalized.includes("pool")) return "RealFiPosition";
  return "SmartContract";
}

export async function scanContract(contractAddressInput: string, context?: string): Promise<SecurityReport> {
  if (!isAddress(contractAddressInput)) {
    throw new Error("Invalid contractAddress. Expected a valid EVM address.");
  }

  const contractAddress = getAddress(contractAddressInput);
  const bytecode = await provider.getCode(contractAddress);

  if (!bytecode || bytecode === "0x") {
    throw new Error("No contract bytecode found at the supplied address on Pharos mainnet.");
  }

  const flags: RiskFlag[] = [];
  let riskScore = 5;

  const ownerHex = await safeEthCall(contractAddress, "owner");
  const adminHex = await safeEthCall(contractAddress, "admin");
  const getOwnerHex = await safeEthCall(contractAddress, "getOwner");
  const pendingOwnerHex = await safeEthCall(contractAddress, "pendingOwner");

  const owner = parseAddressResult("owner", ownerHex);
  const admin = parseAddressResult("admin", adminHex);
  const getOwner = parseAddressResult("getOwner", getOwnerHex);
  const pendingOwner = parseAddressResult("pendingOwner", pendingOwnerHex);

  const controlAddresses = [owner, admin, getOwner, pendingOwner].filter((item): item is string => Boolean(item));
  if (controlAddresses.length > 0) {
    riskScore += 18;
    flags.push({
      check: "Owner / admin privileges",
      status: "warn",
      scoreImpact: 18,
      details: "Privileged roles are present. This is normal for many protocols, but trust assumptions exist.",
      evidence: [...new Set(controlAddresses)]
    });
  } else {
    flags.push({
      check: "Owner / admin privileges",
      status: "pass",
      scoreImpact: 0,
      details: "No common owner/admin getter responded. Privileged control may still exist via custom roles."
    });
  }

  const implementationSlot = await provider.getStorage(contractAddress, EIP1967_IMPLEMENTATION_SLOT);
  const adminSlot = await provider.getStorage(contractAddress, EIP1967_ADMIN_SLOT);
  const implementationAddress = `0x${implementationSlot.slice(26)}`;
  const adminAddress = `0x${adminSlot.slice(26)}`;

  const proxyDetected = implementationAddress !== "0x0000000000000000000000000000000000000000" || hasOpcode(bytecode, "f4");
  if (proxyDetected) {
    riskScore += 22;
    flags.push({
      check: "Upgradeable proxy detection",
      status: "warn",
      scoreImpact: 22,
      details: "Upgradeable or delegatecall behavior detected; implementation can potentially change over time.",
      evidence: [implementationAddress, adminAddress].filter((value) => value !== "0x0000000000000000000000000000000000000000")
    });
  } else {
    flags.push({
      check: "Upgradeable proxy detection",
      status: "pass",
      scoreImpact: 0,
      details: "No direct proxy indicators found in common EIP-1967 slots."
    });
  }

  const delayValues = [
    parseDelayResult("getMinDelay", await safeEthCall(contractAddress, "getMinDelay")),
    parseDelayResult("minDelay", await safeEthCall(contractAddress, "minDelay")),
    parseDelayResult("delay", await safeEthCall(contractAddress, "delay"))
  ].filter((item): item is bigint => item !== null);

  const maxDelay = delayValues.length > 0 ? delayValues.reduce((a, b) => (a > b ? a : b), 0n) : null;
  if (maxDelay === null) {
    riskScore += 15;
    flags.push({
      check: "Timelock / delay checks",
      status: "warn",
      scoreImpact: 15,
      details: "No timelock delay function detected from common signatures. Sensitive actions may execute immediately."
    });
  } else if (maxDelay < 3600n) {
    riskScore += 8;
    flags.push({
      check: "Timelock / delay checks",
      status: "warn",
      scoreImpact: 8,
      details: `Timelock exists but appears short (${maxDelay.toString()} seconds).`
    });
  } else {
    flags.push({
      check: "Timelock / delay checks",
      status: "pass",
      scoreImpact: 0,
      details: `Timelock detected with at least ${maxDelay.toString()} seconds delay.`
    });
  }

  const hasCall = hasOpcode(bytecode, "f1");
  const hasDelegateCall = hasOpcode(bytecode, "f4");
  const hasStaticCall = hasOpcode(bytecode, "fa");
  const hasSelfDestruct = hasOpcode(bytecode, "ff");

  if (hasCall || hasDelegateCall) {
    const impact = hasDelegateCall ? 14 : 9;
    riskScore += impact;
    flags.push({
      check: "External call risks",
      status: "warn",
      scoreImpact: impact,
      details: "Low-level external calls exist; runtime interactions can introduce integration and dependency risk.",
      evidence: [
        hasCall ? "CALL opcode" : "",
        hasDelegateCall ? "DELEGATECALL opcode" : "",
        hasStaticCall ? "STATICCALL opcode" : "",
        hasSelfDestruct ? "SELFDESTRUCT opcode" : ""
      ].filter(Boolean)
    });
  } else {
    flags.push({
      check: "External call risks",
      status: "pass",
      scoreImpact: 0,
      details: "No low-level call opcodes found in runtime bytecode."
    });
  }

  const hasAccessControlHints =
    bytecode.toLowerCase().includes(id("DEFAULT_ADMIN_ROLE()").slice(2, 10).toLowerCase()) ||
    bytecode.toLowerCase().includes(id("grantRole(bytes32,address)").slice(2, 10).toLowerCase());

  if (hasAccessControlHints) {
    flags.push({
      check: "Basic access control patterns",
      status: "info",
      scoreImpact: 0,
      details: "Role-based access control hints detected in bytecode (likely AccessControl-like design)."
    });
  } else {
    riskScore += 10;
    flags.push({
      check: "Basic access control patterns",
      status: "warn",
      scoreImpact: 10,
      details: "No obvious role-management signatures found. Verify custom access restrictions manually."
    });
  }

  const hasReentrancyGuardHint = bytecode.toLowerCase().includes(id("_reentrancyGuardEntered()").slice(2, 10).toLowerCase());
  if (hasCall && !hasReentrancyGuardHint) {
    riskScore += 18;
    flags.push({
      check: "Reentrancy risk flags",
      status: "warn",
      scoreImpact: 18,
      details: "External call pattern present while common reentrancy guard signature not detected."
    });
  } else if (hasCall && hasReentrancyGuardHint) {
    riskScore += 6;
    flags.push({
      check: "Reentrancy risk flags",
      status: "info",
      scoreImpact: 6,
      details: "External call pattern present, but reentrancy guard signature hints were also detected."
    });
  } else {
    flags.push({
      check: "Reentrancy risk flags",
      status: "pass",
      scoreImpact: 0,
      details: "No clear external call signal requiring a reentrancy warning."
    });
  }

  riskScore = Math.max(0, Math.min(100, riskScore));
  const riskLevel = scoreToLevel(riskScore);

  const headline =
    riskLevel === "High"
      ? "High risk profile: strong caution before moving funds."
      : riskLevel === "Medium"
        ? "Moderate risk profile: proceed with controls and limits."
        : "Low observed onchain risk from lightweight static scan.";

  const executiveSummary =
    `Pharos RealFi Security Scout evaluated ${contractAddress} on chain ${env.PHAROS_CHAIN_ID} using bytecode and ` +
    `onchain state signals. The contract scored ${riskScore}/100 (${riskLevel}). ${
      riskLevel === "High"
        ? "Delay deposits until admin powers, upgradeability, and timelocks are independently validated."
        : "Use this report as an instant pre-trade safety gate before autonomous agent execution."
    }`;

  const recommendations = [
    "If TVL is meaningful, run a full source-level audit in addition to this lightweight scan.",
    "Set conservative spend limits and staged execution for autonomous agents.",
    "Prefer contracts with transparent timelocks and documented governance controls.",
    "Monitor implementation changes for upgradeable contracts before each major position change."
  ];

  const adminFunctionsDetected: string[] = [];
  if (owner) adminFunctionsDetected.push("owner");
  if (admin) adminFunctionsDetected.push("admin");
  if (getOwner) adminFunctionsDetected.push("getOwner");
  if (pendingOwner) adminFunctionsDetected.push("pendingOwner");

  return {
    chainId: env.PHAROS_CHAIN_ID,
    network: "Pharos Mainnet",
    contractAddress,
    scannedAt: new Date().toISOString(),
    context,
    targetType: estimateTargetType(context),
    riskScore,
    riskLevel,
    headline,
    executiveSummary,
    flags,
    recommendations,
    metadata: {
      bytecodeSize: (bytecode.length - 2) / 2,
      proxyDetected,
      ownerDetected: controlAddresses.length > 0,
      timelockDetected: maxDelay !== null,
      adminFunctionsDetected
    }
  };
}
