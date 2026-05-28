import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

/** Populates res.locals.x402 when local dev bypass proof is used (grantAccess path). */
export function devPaymentLocals(req: Request, res: Response, next: NextFunction): void {
  if (!env.allowInsecureDev) {
    next();
    return;
  }

  const devProof = req.header("x-payment-proof");
  if (devProof?.startsWith("dev_")) {
    res.locals.x402 = {
      payer: "dev-mode",
      txHash: "dev-mode-tx"
    };
  }

  next();
}
