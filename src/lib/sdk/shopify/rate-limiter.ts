export class RateLimiter {
  private currentlyAvailable = 1000;
  private restoreRate = 50;
  private lastUpdate = Date.now();

  /**
   * Tracks the leaky bucket cost returned by Shopify GraphQL API.
   */
  updateCost(extensions?: any) {
    if (extensions?.cost?.throttleStatus) {
      this.currentlyAvailable = extensions.cost.throttleStatus.currentlyAvailable;
      this.restoreRate = extensions.cost.throttleStatus.restoreRate;
      this.lastUpdate = Date.now();
    }
  }

  /**
   * Before sending a request, wait if the bucket doesn't have enough capacity.
   * Assumes an average query cost of 50 if unknown.
   */
  async awaitCapacity(requestedCost = 50): Promise<void> {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastUpdate) / 1000;
    const estimatedAvailable = Math.min(
      1000,
      this.currentlyAvailable + elapsedSeconds * this.restoreRate,
    );

    if (estimatedAvailable < requestedCost) {
      const deficit = requestedCost - estimatedAvailable;
      const waitMs = Math.ceil((deficit / this.restoreRate) * 1000);
      await new Promise((r) => setTimeout(r, waitMs));

      // Assume capacity replenished
      this.currentlyAvailable = requestedCost;
      this.lastUpdate = Date.now();
    }
  }
}

/**
 * Standard exponential backoff wrapper.
 */
export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 5,
  baseDelayMs = 1000,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err: any) {
      const isThrottled = err.message?.includes("429") || err.message?.includes("THROTTLED");
      const isServerError =
        err.message?.includes("500") ||
        err.message?.includes("502") ||
        err.message?.includes("503");

      if ((isThrottled || isServerError) && attempt < maxRetries) {
        attempt++;
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `[ShopifySDK] Rate limited or server error. Retrying in ${delay}ms... (Attempt ${attempt})`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}
