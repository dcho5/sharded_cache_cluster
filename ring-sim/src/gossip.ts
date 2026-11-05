import type { FakeNetwork } from "./network";

export type Status = "alive" | "suspect" | "dead";
export type Member = { heartbeat: number; status: Status; lastUpdated: number };

/**
 * Gossip membership skeleton.
 * Each tick: bump own heartbeat, pick a random peer, send our member table.
 * On receive: merge, keeping the higher heartbeat per node.
 * Failure detection: no heartbeat increase for T1 ticks => suspect, T2 => dead.
 */
export class GossipNode {
  members = new Map<string, Member>();
  constructor(public id: string, private net: FakeNetwork) {
    this.members.set(id, { heartbeat: 0, status: "alive", lastUpdated: 0 });
    net.register(id, (m) => this.onMessage(m));
  }

  tick() {
    // TODO: increment own heartbeat
    // TODO: pick a random alive peer (use net.rand, not Math.random)
    // TODO: net.send({ from: this.id, to: peer, type: "gossip", payload: this.members })
    // TODO: mark members suspect/dead based on net.now - lastUpdated
  }

  private onMessage(m: { type: string; payload?: unknown }) {
    // TODO: merge m.payload into this.members (higher heartbeat wins)
  }
}
