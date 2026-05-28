import { Router } from "express";
import { z } from "zod";
import { scanContract } from "../services/securityScanner.js";

const bodySchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "contractAddress must be a valid address"),
  context: z.string().max(500).optional()
});

export const scanRouter = Router();

scanRouter.post("/scan", async (req, res, next) => {
  try {
    const payload = bodySchema.parse(req.body);
    const report = await scanContract(payload.contractAddress, payload.context);

    res.json({
      ok: true,
      payment: res.locals.x402,
      report
    });
  } catch (error) {
    next(error);
  }
});
