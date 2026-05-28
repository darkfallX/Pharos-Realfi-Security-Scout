import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  PHAROS_RPC: z.string().url().default("https://rpc.pharos.xyz"),
  PHAROS_CHAIN_ID: z.coerce.number().int().positive().default(1672),
  USDC_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "USDC_ADDRESS must be a valid EVM address")
    .default("0x0000000000000000000000000000000000000000"),
  PAY_TO_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid PAY_TO_ADDRESS"),
  SCAN_FEE_USDC: z.coerce.number().positive().default(0.01),
  USDC_NAME: z.string().min(1).default("USDC"),
  SERVER_URL: z.string().url().default("http://localhost:8787"),
  PRIVATE_KEY: z.string().optional(),
  FACILITATOR_URL: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().url().optional()
  ),
  /** @deprecated Use FACILITATOR_URL */
  X402_VERIFY_URL: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().url().optional()
  ),
  X402_FACILITATOR_API_KEY: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().optional()
  ),
  X402_ALLOW_INSECURE_DEV: z.enum(["true", "false"]).default("false"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${formatted}`);
}

const facilitatorUrl = parsed.data.FACILITATOR_URL ?? parsed.data.X402_VERIFY_URL;

if (!facilitatorUrl && parsed.data.X402_ALLOW_INSECURE_DEV !== "true") {
  throw new Error(
    "FACILITATOR_URL is required when X402_ALLOW_INSECURE_DEV is false. Set the official Pharos x402 facilitator URL."
  );
}

export const env = {
  ...parsed.data,
  FACILITATOR_URL: facilitatorUrl,
  allowInsecureDev: parsed.data.X402_ALLOW_INSECURE_DEV === "true",
  x402Network: `eip155:${parsed.data.PHAROS_CHAIN_ID}` as const
};
