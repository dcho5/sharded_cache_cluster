import { describe, it, expect } from "vitest";
import { HashRing } from "./ring";

describe("HashRing", () => {
  it("is deterministic", () => {
    const r = new HashRing();
    ["a", "b", "c"].forEach((n) => r.addNode(n));
    expect(r.getReplicas("k", 2)).toEqual(r.getReplicas("k", 2));
  });

  it("returns distinct replicas", () => {
    const r = new HashRing();
    ["a", "b", "c"].forEach((n) => r.addNode(n));
    expect(new Set(r.getReplicas("k", 3)).size).toBe(3);
  });

  it("moves only a minority of keys when a node is added", () => {
    const r = new HashRing();
    ["a", "b", "c"].forEach((n) => r.addNode(n));
    const keys = Array.from({ length: 1000 }, (_, i) => `key${i}`);
    const before = keys.map((k) => r.getReplicas(k)[0]);
    r.addNode("d");
    const moved = keys.filter((k, i) => r.getReplicas(k)[0] !== before[i]).length;
    expect(moved).toBeLessThan(500); // ideal is ~25%
  });
});
