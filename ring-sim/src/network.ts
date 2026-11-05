export type Msg = { from: string; to: string; type: string; payload?: unknown };
type Handler = (m: Msg) => void;

/** Seeded PRNG so demos are reproducible. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tick-based fake network: latency, drops, dead nodes, partitions. */
export class FakeNetwork {
  now = 0;
  rand: () => number;
  private queue: { at: number; msg: Msg }[] = [];
  private handlers = new Map<string, Handler>();
  private down = new Set<string>();
  private groups: Set<string>[] | null = null;

  constructor(
    public cfg = { minLatency: 1, maxLatency: 5, dropRate: 0 },
    seed = 1,
  ) {
    this.rand = mulberry32(seed);
  }

  register(id: string, h: Handler) { this.handlers.set(id, h); }
  setDown(id: string, isDown: boolean) { isDown ? this.down.add(id) : this.down.delete(id); }
  /** partition([["a","b"],["c"]]) splits the network; partition(null) heals it. */
  partition(groups: string[][] | null) { this.groups = groups && groups.map((g) => new Set(g)); }

  canReach(a: string, b: string) {
    if (this.down.has(a) || this.down.has(b)) return false;
    if (!this.groups) return true;
    return this.groups.some((g) => g.has(a) && g.has(b));
  }

  send(msg: Msg) {
    if (!this.canReach(msg.from, msg.to)) return;
    if (this.rand() < this.cfg.dropRate) return;
    const { minLatency, maxLatency } = this.cfg;
    const at = this.now + minLatency + Math.floor(this.rand() * (maxLatency - minLatency + 1));
    this.queue.push({ at, msg });
  }

  /** Advance virtual time by one tick and deliver due messages. */
  step() {
    this.now++;
    const due = this.queue.filter((q) => q.at <= this.now);
    this.queue = this.queue.filter((q) => q.at > this.now);
    for (const { msg } of due) {
      if (this.canReach(msg.from, msg.to)) this.handlers.get(msg.to)?.(msg);
    }
  }
}
