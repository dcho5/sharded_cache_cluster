# raft-kv

Replicated key-value store with Raft-style leader election.

```
docker compose up --build
curl -X PUT -d 'world' localhost:8081/kv/hello   # must hit the leader
curl localhost:8081/status                        # role, term, leader
```

## Status
- [x] HTTP API, `/status`
- [x] Terms, randomized election timeouts, majority votes, heartbeats, step-down
- [ ] Replicate writes to followers; ack on majority (search `TODO(replication)`)
- [ ] Redirect/proxy writes from followers to the leader
- [ ] Log-up-to-date check on votes (`TODO(safety)`)
- [ ] Decide strong vs. eventual reads and document why (`TODO(consistency)`)
- [ ] Tests: partition a node (`docker network disconnect`), kill the leader, restart a node
- [ ] Architecture diagram + design-tradeoffs section (CAP, what you'd change for production)

Reference: Raft paper, and the visualization at https://raft.github.io
