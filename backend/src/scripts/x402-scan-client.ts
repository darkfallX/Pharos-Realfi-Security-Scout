/**
 * Pays real USDC via x402 and calls POST /scan.
 *
 * Usage:
 *   npm run test:x402:scan
 *   npm run test:x402:scan -- http://localhost:8787/scan 0xYourContract...
 *
 * Requires in .env:
 *   EVM_PRIVATE_KEY — payer wallet (USDC + PHRS for gas on Pharos)
 *   PAY_TO_ADDRESS  — receives the scan fee (can differ from payer)
 */
import { config } from "dotenv";
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { loadEvmPrivateKey } from "../utils/evmKey.js";

config();

const PHAROS_NETWORK = "eip155:1672";
const scanUrl = process.argv[2] ?? "http://localhost:8787/scan";
const contractAddress =
  process.argv[3] ?? process.env.USDC_ADDRESS ?? "0xC879C018dB60520F4355C26eD1a6D572cdAC1815";

const privateKey = loadEvmPrivateKey(process.env.EVM_PRIVATE_KEY);
const signer = privateKeyToAccount(privateKey);

const client = new x402Client();
client.register(PHAROS_NETWORK, new ExactEvmScheme(signer));

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

async function main(): Promise<void> {
  console.log(`Payer: ${signer.address}`);
  console.log(`POST ${scanUrl}`);
  console.log(`Contract: ${contractAddress}`);
  console.log("Paying scan fee in USDC via x402...\n");

  const response = await fetchWithPayment(scanUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractAddress,
      context: "Real USDC x402 integration test"
    })
  });

  const body = await response.json();
  console.log(`Status: ${response.status}`);
  console.log(JSON.stringify(body, null, 2));

  const paymentHeader = response.headers.get("PAYMENT-RESPONSE");
  if (paymentHeader) {
    const settlement = decodePaymentResponseHeader(paymentHeader);
    console.log("\nSettlement:");
    console.log(JSON.stringify(settlement, null, 2));
  }

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("x402 scan failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
