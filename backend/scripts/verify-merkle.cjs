const fs = require("fs");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const BASE = "c:/Users/yasha/vsCode/GoogleStockNFT/backend/data";
const gtd = JSON.parse(fs.readFileSync(BASE + "/gtd-merkle.json", "utf8"));
const fcfs = JSON.parse(fs.readFileSync(BASE + "/fcfs-merkle.json", "utf8"));
const master = JSON.parse(fs.readFileSync(BASE + "/wl-master.json", "utf8").replace(/^\uFEFF/, ""));

const gtdAddrs = Object.keys(gtd.proofs);
const fcfsAddrs = Object.keys(fcfs.proofs);

// Rebuild trees
const gtdLeaves = gtdAddrs.map(a => keccak256(a));
const gtdTree = new MerkleTree(gtdLeaves, keccak256, { sortPairs: true });
const fcfsLeaves = fcfsAddrs.map(a => keccak256(a));
const fcfsTree = new MerkleTree(fcfsLeaves, keccak256, { sortPairs: true });

// Verify roots match
const gtdRootOk = "0x" + gtdTree.getRoot().toString("hex") === gtd.root;
const fcfsRootOk = "0x" + fcfsTree.getRoot().toString("hex") === fcfs.root;
console.log("GTD root match: " + gtdRootOk);
console.log("FCFS root match: " + fcfsRootOk);

// Verify all proofs
let ok = 0, fail = 0;
for (const a of gtdAddrs) {
  const leaf = keccak256(a);
  const proof = gtdTree.getProof(leaf);
  if (gtdTree.verify(proof, leaf, gtdTree.getRoot())) ok++; else fail++;
}
console.log("\nGTD proofs: " + ok + " OK, " + fail + " FAIL");

ok = 0; fail = 0;
for (const a of fcfsAddrs) {
  const leaf = keccak256(a);
  const proof = fcfsTree.getProof(leaf);
  if (fcfsTree.verify(proof, leaf, fcfsTree.getRoot())) ok++; else fail++;
}
console.log("FCFS proofs: " + ok + " OK, " + fail + " FAIL");

// Cross check: FCFS addresses should NOT verify against GTD
let crossFails = 0;
for (const a of fcfsAddrs.slice(0, 500)) {
  const leaf = keccak256(a);
  if (gtdTree.verify([], leaf, gtdTree.getRoot())) crossFails++;
}
console.log("Cross-check (500 FCFS vs GTD): " + crossFails + " wrongly accepted");

// Overlap: GTD+FCFS should be in GTD only
const fsSet = new Set(fcfsAddrs);
let overlapErrors = 0;
for (const e of master) {
  if (e.list === "GTD+FCFS" && fsSet.has(e.address)) overlapErrors++;
}
console.log("Overlap in FCFS tree: " + overlapErrors + " (should be 0)");

console.log("\n=== Summary ===");
console.log("GTD addresses: " + gtdAddrs.length);
console.log("FCFS addresses: " + fcfsAddrs.length);
console.log("Master total: " + master.length);
