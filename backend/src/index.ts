import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { devOnlyPaymentGate } from "./middleware/devOnlyPaymentGate.js";
import { devPaymentLocals } from "./middleware/devPaymentLocals.js";
import { scanRouter } from "./routes/scan.js";
import { createX402PaymentMiddleware } from "./x402/setup.js";
import { waitForFacilitator } from "./utils/facilitatorHealth.js";

async function bootstrap(): Promise<void> {
  const app = express();

  app.use(express.json({ limit: "256kb" }));

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "Too many requests",
        message: "Rate limit exceeded. Please slow down and retry."
      }
    })
  );

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "Pharos RealFi Security Scout",
      chainId: env.PHAROS_CHAIN_ID,
      network: env.x402Network,
      rpc: env.PHAROS_RPC,
      paymentProtocol: "x402",
      facilitatorConfigured: Boolean(env.FACILITATOR_URL),
      serverUrl: env.SERVER_URL
    });
  });

  if (env.FACILITATOR_URL) {
    console.log(`Waiting for x402 facilitator at ${env.FACILITATOR_URL} ...`);
    await waitForFacilitator(env.FACILITATOR_URL);
    const x402Middleware = await createX402PaymentMiddleware();
    app.use(x402Middleware);
    console.log("x402 payment middleware ready (real USDC on Pharos mainnet)");
  } else if (env.allowInsecureDev) {
    app.use(devOnlyPaymentGate);
  }

  app.use(devPaymentLocals);
  app.use("/", scanRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: "Validation error",
        details: err.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: "Internal server error", message });
  });

  app.listen(env.PORT, () => {
    console.log(`Pharos RealFi Security Scout listening on port ${env.PORT}`);
    console.log(`x402 network: ${env.x402Network}`);
    if (env.FACILITATOR_URL) {
      console.log(`x402 facilitator: ${env.FACILITATOR_URL}`);
    }
    if (env.allowInsecureDev) {
      console.log("x402 dev bypass: enabled (x-payment-proof: dev_*)");
    }
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
