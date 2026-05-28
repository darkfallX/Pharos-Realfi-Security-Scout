/**
 * Waits until the self-hosted x402 facilitator is reachable.
 */
export async function waitForFacilitator(
  baseUrl: string,
  options: { attempts?: number; delayMs?: number } = {}
): Promise<void> {
  const attempts = options.attempts ?? 30;
  const delayMs = options.delayMs ?? 1000;
  const healthUrl = `${baseUrl.replace(/\/$/, "")}/health`;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    `Facilitator not reachable at ${baseUrl}. Start it first in another terminal:\n  cd backend && npm run start:facilitator`
  );
}
