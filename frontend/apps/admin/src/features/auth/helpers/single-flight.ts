export type Flight<V> = {
  promise: Promise<V>;
  settledAt?: number;
  value?: V;
};

/**
 * One call per key: a caller that asks while the call is in flight, or up to `graceMs` after it
 * succeeded, gets the same promise instead of a call of its own. A failure is not kept — the next
 * caller tries again. In-process only: two server processes each make their own call.
 *
 * The `flights` map may be passed in, so that it can outlive this object: state kept in one place,
 * behaviour always from the current code.
 */
export class SingleFlight<V> {
  constructor(
    private readonly graceMs: number,
    private readonly now: () => number = Date.now,
    private readonly flights = new Map<string, Flight<V>>(),
  ) {}

  run(key: string, call: () => Promise<V>): Promise<V> {
    this.prune();

    const current = this.flights.get(key);

    if (current) {
      return current.promise;
    }

    // Async, so a call that throws before its first await is a rejection like any other.
    const flight: Flight<V> = { promise: (async () => call())() };
    this.flights.set(key, flight);

    flight.promise.then(
      (value) => {
        flight.settledAt = this.now();
        flight.value = value;
      },
      () => {
        if (this.flights.get(key) === flight) {
          this.flights.delete(key);
        }
      },
    );

    return flight.promise;
  }

  /**
   * Drops every flight that `match` picks — by its key, or by the result it succeeded with — so the
   * next caller of that key makes a call of its own.
   */
  forget(match: (key: string, value: V | undefined) => boolean): void {
    this.flights.forEach((flight, key) => {
      if (match(key, flight.value)) {
        this.flights.delete(key);
      }
    });
  }

  private prune(): void {
    const now = this.now();

    this.flights.forEach((flight, key) => {
      if (flight.settledAt !== undefined && now - flight.settledAt >= this.graceMs) {
        this.flights.delete(key);
      }
    });
  }
}
