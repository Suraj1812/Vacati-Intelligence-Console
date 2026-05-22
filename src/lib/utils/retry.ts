export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    attempts?: number;
    delayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {},
): Promise<T> {
  const attempts = options.attempts ?? 2;
  const delayMs = options.delayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || options.shouldRetry?.(error) === false) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError;
}
