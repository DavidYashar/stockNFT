/**
 * Generate Merkle trees for GTD and FCFS whitelist phases.
 * 
 * Output:
 *   backend/data/gtd-merkle.json  → { root, proofs: { "0xaddr": ["0x...","0x..."] } }
 *   backend/data/fcfs-merkle.json → same format
 */

const fs = require("fs");
const path = require("path");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const DATA_DIR = path.join(__dirname, "..", "data");

// ─── Load master WL ───
const masterPath = path.join(DATA_DIR, "wl-master.json");
const master = JSON.parse(fs.readFileSync(masterPath, "utf8").replace(/^\uFEFF/, ""));

// ─── Separate GTD vs FCFS ───
// GTD: entries with list = "GTD" or "GTD+FCFS"
// FCFS: entries with list = "FCFS" only (GTD+FCFS goes to GTD)
const gtdAddrs: string[] = [];
const fcfsAddrs: string[] = [];

for (const entry of master) {
  const addr = entry.address.toLowerCase();
  const list = entry.list;
  if (list === "GTD" || list === "GTD+FCFS") {
    gtdAddrs.push(addr);
  } else if (list === "FCFS") {
    fcfsAddrs.push(addr);
  }
}

console.log(`GTD addresses: ${gtdAddrs.length}`);
console.log(`FCFS addresses: ${fcfsAddrs.length}`);
console.log(`Total: ${gtdAddrs.length + fcfsAddrs.length}`);

// ─── Generate GTD Merkle tree ───
console.log("\nGenerating GTD Merkle tree...");
const gtdLeaves = gtdAddrs.map(addr => keccak256(addr));
const gtdTree = new MerkleTree(gtdLeaves, keccak256, { sortPairs: true });
const gtdRoot = "0x" + gtdTree.getRoot().toString("hex");
console.log(`GTD Root: ${gtdRoot}`);

const gtdProofs: Record<string, string[]> = {};
for (const addr of gtdAddrs) {
  const leaf = keccak256(addr);
  const proof = gtdTree.getHexProof(leaf);
  gtdProofs[addr] = proof;
}

const gtdOutput = { root: gtdRoot, proofs: gtdProofs };
fs.writeFileSync(path.join(DATA_DIR, "gtd-merkle.json"), JSON.stringify(gtdOutput, null, 2));
console.log(`Saved gtd-merkle.json (${Object.keys(gtdProofs).length} proofs)`);

// ─── Generate FCFS Merkle tree ───
console.log("\nGenerating FCFS Merkle tree...");
const fcfsLeaves = fcfsAddrs.map(addr => keccak256(addr));
const fcfsTree = new MerkleTree(fcfsLeaves, keccak256, { sortPairs: true });
const fcfsRoot = "0x" + fcfsTree.getRoot().toString("hex");
console.log(`FCFS Root: ${fcfsRoot}`);

const fcfsProofs: Record<string, string[]> = {};
for (const addr of fcfsAddrs) {
  const leaf = keccak256(addr);
  const proof = fcfsTree.getHexProof(leaf);
  fcfsProofs[addr] = proof;
}

const fcfsOutput = { root: fcfsRoot, proofs: fcfsProofs };
fs.writeFileSync(path.join(DATA_DIR, "fcfs-merkle.json"), JSON.stringify(fcfsOutput, null, 2));
console.log(`Saved fcfs-merkle.json (${Object.keys(fcfsProofs).length} proofs)`);

// ─── Verify: test a few addresses ───
console.log("\n─── Verification ───");
const testGtd = gtdAddrs[0];
console.log(`GTD test: ${testGtd}`);
console.log(`  Verified: ${gtdTree.verify(gtdTree.getHexProof(keccak256(testGtd)), keccak256(testGtd), gtdTree.getRoot())}`);

const testFcfs = fcfsAddrs[0];
console.log(`FCFS test: ${testFcfs}`);
console.log(`  Verified: ${fcfsTree.verify(fcfsTree.getHexProof(keccak256(testFcfs)), keccak256(testFcfs), fcfsTree.getRoot())}`);

console.log("\n✅ Done. Roots for contracts:");
console.log(`   setGtdRoot(${gtdRoot});`);
console.log(`   setFcfsRoot(${fcfsRoot});`);
