package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Role string

const (
	Follower  Role = "follower"
	Candidate Role = "candidate"
	Leader    Role = "leader"
)

type Node struct {
	mu        sync.Mutex
	id        string
	peers     []string // host:port of the other nodes
	role      Role
	term      int
	votedFor  string
	leader    string
	lastHeard time.Time
	store     map[string]string
}

type VoteReq struct {
	Term        int    `json:"term"`
	CandidateID string `json:"candidateId"`
}
type VoteResp struct {
	Term    int  `json:"term"`
	Granted bool `json:"granted"`
}
type BeatReq struct {
	Term     int    `json:"term"`
	LeaderID string `json:"leaderId"`
	// TODO(replication): add log entries or a key/value snapshot here
}
type BeatResp struct {
	Term int `json:"term"`
}

func main() {
	id := flag.String("id", "n1", "node id")
	addr := flag.String("addr", ":8080", "listen address")
	peers := flag.String("peers", "", "comma-separated peer host:port list")
	flag.Parse()

	n := &Node{id: *id, role: Follower, lastHeard: time.Now(), store: map[string]string{}}
	if *peers != "" {
		n.peers = strings.Split(*peers, ",")
	}

	http.HandleFunc("/raft/vote", n.handleVote)
	http.HandleFunc("/raft/heartbeat", n.handleBeat)
	http.HandleFunc("/kv/", n.handleKV)
	http.HandleFunc("/status", n.handleStatus)

	go n.electionLoop()
	log.Printf("[%s] listening on %s, peers=%v", n.id, *addr, n.peers)
	log.Fatal(http.ListenAndServe(*addr, nil))
}

// ---------- election ----------

func (n *Node) electionLoop() {
	timeout := randTimeout()
	for range time.Tick(25 * time.Millisecond) {
		n.mu.Lock()
		expired := n.role != Leader && time.Since(n.lastHeard) > timeout
		n.mu.Unlock()
		if expired {
			n.startElection()
			timeout = randTimeout() // re-randomize to avoid split votes
		}
	}
}

func randTimeout() time.Duration {
	return time.Duration(300+rand.Intn(300)) * time.Millisecond
}

func (n *Node) startElection() {
	n.mu.Lock()
	n.term++
	n.role = Candidate
	n.votedFor = n.id
	n.lastHeard = time.Now()
	term := n.term
	n.mu.Unlock()
	log.Printf("[%s] starting election for term %d", n.id, term)

	votes := 1 // our own
	var vmu sync.Mutex
	for _, p := range n.peers {
		go func(p string) {
			var resp VoteResp
			if err := post(p, "/raft/vote", VoteReq{term, n.id}, &resp); err != nil {
				return
			}
			n.mu.Lock()
			defer n.mu.Unlock()
			if resp.Term > n.term {
				n.stepDown(resp.Term)
				return
			}
			if resp.Granted && n.role == Candidate && n.term == term {
				vmu.Lock()
				votes++
				won := votes > (len(n.peers)+1)/2
				vmu.Unlock()
				if won {
					n.role = Leader
					n.leader = n.id
					log.Printf("[%s] became LEADER for term %d", n.id, term)
					go n.heartbeatLoop(term)
				}
			}
		}(p)
	}
}

func (n *Node) stepDown(term int) { // caller holds n.mu
	n.term = term
	n.role = Follower
	n.votedFor = ""
}

func (n *Node) heartbeatLoop(term int) {
	for range time.Tick(100 * time.Millisecond) {
		n.mu.Lock()
		if n.role != Leader || n.term != term {
			n.mu.Unlock()
			return
		}
		n.mu.Unlock()
		for _, p := range n.peers {
			go func(p string) {
				var resp BeatResp
				if err := post(p, "/raft/heartbeat", BeatReq{term, n.id}, &resp); err != nil {
					return
				}
				n.mu.Lock()
				if resp.Term > n.term {
					n.stepDown(resp.Term)
				}
				n.mu.Unlock()
			}(p)
		}
	}
}

func (n *Node) handleVote(w http.ResponseWriter, r *http.Request) {
	var req VoteReq
	json.NewDecoder(r.Body).Decode(&req)
	n.mu.Lock()
	defer n.mu.Unlock()
	if req.Term > n.term {
		n.stepDown(req.Term)
	}
	granted := req.Term == n.term && (n.votedFor == "" || n.votedFor == req.CandidateID)
	// TODO(safety): also require the candidate's log to be at least as up-to-date as ours
	if granted {
		n.votedFor = req.CandidateID
		n.lastHeard = time.Now()
	}
	json.NewEncoder(w).Encode(VoteResp{n.term, granted})
}

func (n *Node) handleBeat(w http.ResponseWriter, r *http.Request) {
	var req BeatReq
	json.NewDecoder(r.Body).Decode(&req)
	n.mu.Lock()
	defer n.mu.Unlock()
	if req.Term >= n.term {
		if req.Term > n.term || n.role != Follower {
			n.stepDown(req.Term)
		}
		n.leader = req.LeaderID
		n.lastHeard = time.Now()
		// TODO(replication): apply entries / snapshot from the leader here
	}
	json.NewEncoder(w).Encode(BeatResp{n.term})
}

// ---------- key/value API ----------

func (n *Node) handleKV(w http.ResponseWriter, r *http.Request) {
	key := strings.TrimPrefix(r.URL.Path, "/kv/")
	n.mu.Lock()
	defer n.mu.Unlock()
	switch r.Method {
	case http.MethodPut:
		if n.role != Leader {
			// TODO: proxy to the leader or return its address so clients can retry
			http.Error(w, fmt.Sprintf("not leader; try %s", n.leader), http.StatusMisdirectedRequest)
			return
		}
		body, _ := io.ReadAll(r.Body)
		n.store[key] = string(body)
		// TODO(replication): send to followers, wait for a majority of acks, THEN respond
		fmt.Fprintln(w, "ok")
	case http.MethodGet:
		// TODO(consistency): decide and document: serve local (stale ok) or leader-only (strong)?
		v, ok := n.store[key]
		if !ok {
			http.NotFound(w, r)
			return
		}
		fmt.Fprintln(w, v)
	}
}

func (n *Node) handleStatus(w http.ResponseWriter, r *http.Request) {
	n.mu.Lock()
	defer n.mu.Unlock()
	json.NewEncoder(w).Encode(map[string]any{
		"id": n.id, "role": n.role, "term": n.term, "leader": n.leader, "keys": len(n.store),
	})
}

// ---------- helpers ----------

var client = &http.Client{Timeout: 200 * time.Millisecond}

func post(peer, path string, in, out any) error {
	b, _ := json.Marshal(in)
	resp, err := client.Post("http://"+peer+path, "application/json", bytes.NewReader(b))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return json.NewDecoder(resp.Body).Decode(out)
}
