import _ from 'lodash';

export class MemoryCache<Value = any> {
  private readonly store = new Map<string, Value>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly delay = 10_000) {}

  set(key: string, value: Value, delay = this.delay) {
    this.store.set(key, value);

    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    const timeout = setTimeout(() => {
      this.store.delete(key);
      this.timers.delete(key);
    }, delay);

    this.timers.set(key, timeout);
  }

  get(key: string): Value | null {
    return this.store.get(key) ?? null;
  }

  reset() {
    _.forEach(_.keys(this.timers), (key) => {
      clearTimeout(this.timers.get(key));
    });

    this.timers.clear();
    this.store.clear();
  }
}
