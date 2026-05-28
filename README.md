# Pharos RealFi Security Scout

Production-grade Pharos Skill for the Agent Centre Skill Builder Campaign.

This project delivers an x402-paid onchain security scout that lets AI agents perform a fast, professional risk check before interacting with a smart contract or RealFi position on Pharos mainnet.

## Why this matters for Pharos RealFi + agent economy

- Autonomous agents can move capital in seconds; this adds a mandatory safety checkpoint before execution.
- x402 micro-fees create sustainable security-as-a-service economics in native USDC.
- Lightweight onchain checks keep latency low while still catching high-impact risk patterns.
- RealFi workflows (RWA vaults, yield strategies, Agra orderbook, rcPC, pAlpha) gain safer machine-speed decisioning.

## Architecture

- Backend: Node.js + TypeScript + Express
- Chain: Pharos mainnet (`chainId=1672`, RPC `https://rpc.pharos.xyz`)
- Payment gate: x402-compatible `HTTP 402 Payment Required` middleware on `POST /scan`
- Scanner engine: ethers.js onchain reads + bytecode rule checks (no heavy ML)
- API hardening: rate limit + schema validation + centralized error handling

## Risk checks implemented

- Reentrancy risk flags
- Owner/admin privilege detection
- Upgradeable proxy detection
- Timelock/delay checks
- External call risk signals
- Basic access control pattern hints
- Final risk score + Low/Medium/High classification

## Project structure

- `backend/` Express API service
- `SKILL.md` campaign skill definition and prompts
- `README.md` setup, demo, and submission copy

## Local setup

1. Install dependencies:
   - `cd backend`
   - `npm install`
2. Configure environment:
   - `copy .env.example .env` (Windows) or `cp .env.example .env` (macOS/Linux)
   - `PAY_TO_ADDRESS` default: `0xdd29E2aD19292C1Eb2844ea07888c987a6D13B74`
   - `USDC_ADDRESS` default (official): `0xC879C018dB60520F4355C26eD1a6D572cdAC1815`
   - For local dev, leave `X402_VERIFY_URL` empty
   - For production, set `X402_VERIFY_URL` to your verifier service URL
3. Run dev server:
   - `npm run dev`
4. Health check:
   - `GET http://localhost:8787/health`

## Demo instructions

1. Trigger a scan without payment proof:
   - `POST http://localhost:8787/scan`
   - Body: `{ "contractAddress": "0x..." }`
   - You receive `402 Payment Required` with x402 payment instructions.
2. For local testing, set `X402_ALLOW_INSECURE_DEV=true` and send:
   - Header: `x-payment-proof: dev_local_test_payment`
3. Submit request:
   - Body example:
     ```json
     {
       "contractAddress": "0x1234567890abcdef1234567890abcdef12345678",
       "context": "RWA vault pre-deposit risk gate for autonomous strategy"
     }
     ```
4. Receive full JSON report including:
   - executive summary
   - individual risk flags
   - final risk score and level
   - practical recommendations

## Deploy (production)

- Deploy `backend` to your preferred Node host (Railway, Fly.io, Render, ECS, etc.).
- Set secure environment values:
  - `NODE_ENV=production`
  - `PHAROS_RPC=https://rpc.pharos.xyz`
  - `PHAROS_CHAIN_ID=1672`
  - `USDC_ADDRESS=<official Circle USDC on Pharos>`
  - `PAY_TO_ADDRESS=<treasury address>`
  - `X402_VERIFY_URL=<your verifier endpoint>`
  - `X402_ALLOW_INSECURE_DEV=false`
- Build and run:
  - `npm run build`
  - `npm run start`

## API: scan endpoint

- Method: `POST /scan`
- Headers:
  - `Content-Type: application/json`
  - `x-payment-proof: <x402-proof>`
- Body:
  - `contractAddress` (required, EVM address)
  - `context` (optional string)

## Campaign submission (exact text for Discord)

Copy-paste the message below into `#skill-submission`:

```text
Skill Name: Pharos RealFi Security Scout

Description:
An x402-powered onchain security skill for Pharos agents. Agents pay a tiny USDC micro-fee to instantly get a professional risk report before interacting with any contract or RealFi position (RWA vaults, yield strategies, Agra orderbook, rcPC, pAlpha, etc.). The report includes reentrancy signals, admin privilege checks, proxy/upgradeability detection, timelock coverage, external call risk, access control hints, and an overall Low/Medium/High risk score with plain-English recommendations.

GitHub Repo:
https://github.com/darkfallX/Pharos-Realfi-Security-Scout

How to Run:
1) cd backend && npm install
2) copy .env.example .env
3) fill PAY_TO_ADDRESS and USDC_ADDRESS
4) npm run dev
5) POST /scan with x-payment-proof and contractAddress

Why It Matters:
This skill gives Pharos agents a machine-speed safety checkpoint before moving money, reducing avoidable exploits while creating sustainable security micro-economics via x402 + native USDC.
```
