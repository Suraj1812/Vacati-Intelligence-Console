export class TtlCache<T> {
  private values = new Map<string, { expiresAt: number; value: T }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string) {
    if (this.ttlMs <= 0) {
      return undefined;
    }

    const entry = this.values.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt < Date.now()) {
      this.values.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T) {
    if (this.ttlMs <= 0) {
      return;
    }

    this.values.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  size() {
    return this.values.size;
  }
}
