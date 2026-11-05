import { hash32 } from "./hash";

type Point = { pos: number; node: string };

export class HashRing {
  private points: Point[] = [];

  constructor(public vnodes = 50) {}

  addNode(id: string) {
    for (let i = 0; i < this.vnodes; i++) {
      this.points.push({ pos: hash32(`${id}#${i}`), node: id });
    }
    this.points.sort((a, b) => a.pos - b.pos);
  }

  removeNode(id: string) {
    this.points = this.points.filter((p) => p.node !== id);
  }

  nodes(): string[] {
    return [...new Set(this.points.map((p) => p.node))];
  }

  /** The first `n` distinct nodes clockwise from the key's position. */
  getReplicas(key: string, n = 1): string[] {
    if (this.points.length === 0) return [];
    const h = hash32(key);
    let lo = 0, hi = this.points.length;
    while (lo < hi) { // first point with pos >= h
      const mid = (lo + hi) >> 1;
      if (this.points[mid].pos < h) lo = mid + 1; else hi = mid;
    }
    const out: string[] = [];
    for (let i = 0; i < this.points.length && out.length < n; i++) {
      const node = this.points[(lo + i) % this.points.length].node;
      if (!out.includes(node)) out.push(node);
    }
    return out;
  }

  /** Positions for drawing (one per vnode). */
  getPoints(): readonly Point[] {
    return this.points;
  }

  // TODO: distribution(keys: string[]) => Map<node, count> for the histogram
  // TODO: diff(before, after) => keys that moved, for the "aha" panel
}
