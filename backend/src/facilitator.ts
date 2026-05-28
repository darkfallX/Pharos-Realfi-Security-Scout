/**
 * Self-hosted x402 facilitator for Pharos mainnet.
 * Based on https://docs.pharos.xyz/resources/x402
 */
import { config } from "dotenv";
import express from "express";
import { x402Facilitator } from "@x402/core/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import { createWalletClient, defineChain, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadEvmPrivateKey } from "./utils/evmKey.js";

config();

const PHAROS_CHAIN_ID = 1672;
const PHAROS_NETWORK = "eip155:1672" as const;
const PHAROS_RPC = process.env.PHAROS_RPC ?? "https://rpc.pharos.xyz";
const USDC_ADDRESS = (process.env.USDC_ADDRESS ??
  "0xC879C018dB60520F4355C26eD1a6D572cdAC1815") as `0x${string}`;

let privateKey: `0x${string}`;
try {
  privateKey = loadEvmPrivateKey(process.env.EVM_PRIVATE_KEY);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error("\nFacilitator cannot start without a valid EVM_PRIVATE_KEY.");
  console.error("This wallet pays gas on Pharos mainnet when settling USDC payments.");
  process.exit(1);
}

const pharosMainnet = defineChain({
  id: PHAROS_CHAIN_ID,
  name: "Pharos Mainnet",
  nativeCurrency: { name: "PHRS", symbol: "PHRS", decimals: 18 },
  rpcUrls: { default: { http: [PHAROS_RPC] } }
});

const account = privateKeyToAccount(privateKey);
const client = createWalletClient({
  account,
  chain: pharosMainnet,
  transport: http(PHAROS_RPC, { timeout: 30_000 })
}).extend(publicActions);

const signer = toFacilitatorEvmSigner({
  address: account.address,
  getCode: (args) => client.getCode(args),
  readContract: (args) => client.readContract({ ...args, args: args.args ?? [] }),
  verifyTypedData: (args) => client.verifyTypedData(args as Parameters<typeof client.verifyTypedData>[0]),
  writeContract: (args) => client.writeContract({ ...args, args: args.args ?? [] }),
  sendTransaction: (args) => client.sendTransaction(args),
  waitForTransactionReceipt: (args) => client.waitForTransactionReceipt(args)
});

const facilitator = new x402Facilitator();
facilitator.register(PHAROS_NETWORK, new ExactEvmScheme(signer, { deployERC4337WithEIP6492: true }));

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "pharos-x402-facilitator",
    chainId: PHAROS_CHAIN_ID,
    network: PHAROS_NETWORK,
    rpc: PHAROS_RPC,
    usdc: USDC_ADDRESS,
    signer: account.address
  });
});

app.post("/verify", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "verify failed" });
  }
});

app.post("/settle", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "settle failed" });
  }
});

app.get("/supported", (_req, res) => {
  res.json(facilitator.getSupported());
});

const port = Number(process.env.FACILITATOR_PORT ?? process.env.PORT ?? 3001);
const host = process.env.FACILITATOR_HOST ?? "0.0.0.0";

app.listen(port, host, () => {
  console.log(`Pharos x402 facilitator listening on http://127.0.0.1:${port}`);
  console.log(`Network: ${PHAROS_NETWORK} (chain ${PHAROS_CHAIN_ID})`);
  console.log(`RPC: ${PHAROS_RPC}`);
  console.log(`USDC: ${USDC_ADDRESS}`);
  console.log(`Signer (pays settle gas): ${account.address}`);
  console.log(`Endpoints: GET /health, GET /supported, POST /verify, POST /settle`);
});
