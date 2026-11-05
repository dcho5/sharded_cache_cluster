import { HashRing } from "./ring";
import { hash32, RING_SIZE } from "./hash";

const ring = new HashRing(30);
let nextId = 1;
const colors = ["#e63946", "#2a9d8f", "#e9c46a", "#457b9d", "#9b5de5", "#f4a261", "#06d6a0"];
const colorOf = (id: string) => colors[(parseInt(id.slice(1)) - 1) % colors.length];
const keys = new Map<string, string>(); // key -> owner at write time

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const logEl = document.getElementById("log")!;
const log = (s: string) => { logEl.prepend(Object.assign(document.createElement("div"), { textContent: s })); };

const angle = (pos: number) => (pos / RING_SIZE) * Math.PI * 2 - Math.PI / 2;

function draw() {
  const { width: w, height: h } = canvas;
  const cx = w / 2, cy = h / 2, r = w * 0.38;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#8886"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

  for (const p of ring.getPoints()) {
    const a = angle(p.pos);
    ctx.fillStyle = colorOf(p.node);
    ctx.beginPath(); ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 5, 0, 7); ctx.fill();
  }
  for (const [k, owner] of keys) {
    const a = angle(hash32(k));
    ctx.fillStyle = colorOf(owner);
    ctx.fillRect(cx + (r - 22) * Math.cos(a) - 4, cy + (r - 22) * Math.sin(a) - 4, 8, 8);
  }
}

function addNode() {
  const id = `n${nextId++}`;
  ring.addNode(id);
  log(`+ added ${id}`);
  rebalance();
}

function killRandom() {
  const nodes = ring.nodes();
  if (!nodes.length) return;
  const id = nodes[Math.floor(Math.random() * nodes.length)];
  ring.removeNode(id);
  log(`x killed ${id}`);
  rebalance();
}

/** Recompute owners and log which keys moved. */
function rebalance() {
  for (const [k, oldOwner] of keys) {
    const [newOwner] = ring.getReplicas(k, 1);
    if (newOwner && newOwner !== oldOwner) {
      log(`  key "${k}" moved ${oldOwner} -> ${newOwner}`);
      keys.set(k, newOwner);
    }
  }
  draw();
}

(document.getElementById("add") as HTMLElement).onclick = addNode;
(document.getElementById("kill") as HTMLElement).onclick = killRandom;
(document.getElementById("put") as HTMLElement).onclick = () => {
  const input = document.getElementById("key") as HTMLInputElement;
  const [owner] = ring.getReplicas(input.value, 1);
  if (!owner) return log("no nodes!");
  keys.set(input.value, owner);
  log(`PUT "${input.value}" -> ${owner}`);
  draw();
};

// TODO: replication factor + quorum sliders (N, R, W) and stale-read demo
// TODO: wire FakeNetwork + GossipNode so "kill" is detected via gossip, not instantly
// TODO: URL hash params (#nodes=5&replicas=3&seed=7) for shareable scenarios
// TODO: preset scenario buttons

addNode(); addNode(); addNode();
