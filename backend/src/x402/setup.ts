import { paymentMiddlewareFromHTTPServer } from "@x402/express";
import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
  type RoutesConfig
} from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

function pharosNetwork(): Network {
  return `eip155:${env.PHAROS_CHAIN_ID}` as Network;
}

function buildFacilitatorClient(): HTTPFacilitatorClient {
  const apiKey = env.X402_FACILITATOR_API_KEY;

  if (!apiKey) {
    return new HTTPFacilitatorClient({ url: env.FACILITATOR_URL });
  }

  return new HTTPFacilitatorClient({
    url: env.FACILITATOR_URL,
    createAuthHeaders: async () => ({
      verify: { Authorization: `Bearer ${apiKey}` },
      settle: { Authorization: `Bearer ${apiKey}` },
      supported: { Authorization: `Bearer ${apiKey}` }
    })
  });
}

function buildScanRoutes(network: Network): RoutesConfig {
  return {
    "POST /scan": {
      accepts: {
        scheme: "exact",
        price: String(env.SCAN_FEE_USDC),
        network,
        payTo: env.PAY_TO_ADDRESS
      },
      description: "Pharos RealFi Security Scout — onchain contract risk scan",
      mimeType: "application/json"
    }
  };
}

/**
 * Official Pharos x402 payment gate for POST /scan.
 * Uses HTTPFacilitatorClient against FACILITATOR_URL (verify + settle on Pharos mainnet).
 */
export async function createX402PaymentMiddleware(): Promise<
  (req: Request, res: Response, next: NextFunction) => Promise<void>
> {
  if (!env.FACILITATOR_URL) {
    throw new Error("FACILITATOR_URL is required for x402 payment verification.");
  }

  const network = pharosNetwork();
  const facilitatorClient = buildFacilitatorClient();
  const resourceServer = new x402ResourceServer(facilitatorClient);
  const evmScheme = new ExactEvmScheme();

  evmScheme.registerMoneyParser(async (amount, net) => {
    if (net !== network) {
      return null;
    }

    return {
      amount: Math.round(amount * 1e6).toString(),
      asset: env.USDC_ADDRESS,
      extra: {
        token: env.USDC_NAME,
        name: env.USDC_NAME,
        version: "2"
      }
    };
  });

  resourceServer.register(network, evmScheme);

  const httpServer = new x402HTTPResourceServer(resourceServer, buildScanRoutes(network));

  if (env.allowInsecureDev) {
    httpServer.onProtectedRequest(async (context) => {
      const devProof = context.adapter.getHeader("x-payment-proof");
      if (devProof?.startsWith("dev_")) {
        return { grantAccess: true };
      }
    });
  }

  // Eager init so startup fails fast with a clear message if facilitator is down.
  await httpServer.initialize();

  return paymentMiddlewareFromHTTPServer(httpServer, undefined, undefined, false);
}
