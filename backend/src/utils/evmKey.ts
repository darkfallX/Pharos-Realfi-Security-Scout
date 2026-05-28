/**
 * Validates and normalizes an EVM private key from environment variables.
 */
export function loadEvmPrivateKey(raw: string | undefined, label = "EVM_PRIVATE_KEY"): `0x${string}` {
  if (!raw || raw.trim().length === 0) {
    throw new Error(
      `${label} is missing. Add a 32-byte hex private key to backend/.env, e.g. EVM_PRIVATE_KEY=0xabc...`
    );
  }

  let key = raw.trim();
  if (!key.startsWith("0x")) {
    key = `0x${key}`;
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      `${label} is invalid. Expected 0x followed by 64 hex characters (32 bytes). Check for extra spaces or quotes in .env.`
    );
  }

  return key as `0x${string}`;
}
