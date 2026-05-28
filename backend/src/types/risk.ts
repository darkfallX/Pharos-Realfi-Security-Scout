export type RiskLevel = "Low" | "Medium" | "High";

export interface RiskFlag {
  check: string;
  status: "pass" | "warn" | "fail" | "info";
  scoreImpact: number;
  details: string;
  evidence?: string[];
}

export interface SecurityReport {
  chainId: number;
  network: string;
  contractAddress: string;
  scannedAt: string;
  context?: string;
  targetType: "SmartContract" | "RealFiPosition" | "Unknown";
  riskScore: number;
  riskLevel: RiskLevel;
  headline: string;
  executiveSummary: string;
  flags: RiskFlag[];
  recommendations: string[];
  metadata: {
    bytecodeSize: number;
    proxyDetected: boolean;
    ownerDetected: boolean;
    timelockDetected: boolean;
    adminFunctionsDetected: string[];
  };
}
