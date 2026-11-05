# ring-sim

Browser-based consistent hashing / gossip / quorum simulator. No backend, so it hosts on GitHub Pages.

```
npm install
npm run dev      # local
npm test         # ring unit tests
npm run build    # outputs dist/
```

Deploy: put this folder at the root of a repo, push to `main`, and in
Settings -> Pages choose "GitHub Actions". The workflow in `.github/workflows/deploy.yml` does the rest.

## Roadmap (in order)
- [x] Hash ring with virtual nodes, replicas, tests
- [x] Canvas ring, add/kill node, key movement log
- [x] Fake network with seeded latency, drops, partitions (`network.ts`)
- [ ] Distribution histogram (`ring.ts` TODOs)
- [ ] Replication factor + quorum sliders (N, R, W) and stale-read demo
- [ ] Gossip failure detection (`gossip.ts` TODOs), wired through `FakeNetwork`
- [ ] Partition button + which-writes-fail display (CAP demo)
- [ ] Shareable URL hash scenarios + preset buttons
- [ ] README GIFs + design-tradeoffs section
