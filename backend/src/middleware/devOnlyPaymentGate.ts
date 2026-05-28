import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

/**
 * When FACILITATOR_URL is unset but insecure dev is enabled, require dev_ proof
 * so /scan is not fully open while testing locally without a facilitator.
 */
export function devOnlyPaymentGate(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== "POST" || req.path !== "/scan") {
    next();
    return;
  }

  const proof = req.header("x-payment-proof");
  if (proof?.startsWith("dev_")) {
    res.locals.x402 = { payer: "dev-mode", txHash: "dev-mode-tx" };
    next();
    return;
  }

  res.status(402).json({
    error: "Payment Required",
    message:
      "Set FACILITATOR_URL for real x402 USDC payments, or send x-payment-proof: dev_* when X402_ALLOW_INSECURE_DEV=true.",
    payment: {
      protocol: "x402",
      chainId: env.PHAROS_CHAIN_ID,
      network: env.x402Network,
      chainName: "Pharos Mainnet",
      rpcUrl: env.PHAROS_RPC,
      tokenSymbol: env.USDC_NAME,
      tokenAddress: env.USDC_ADDRESS,
      amount: env.SCAN_FEE_USDC.toFixed(6),
      payTo: env.PAY_TO_ADDRESS
    }
  });
}
