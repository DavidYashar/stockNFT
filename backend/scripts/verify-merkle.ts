const fs = require("fs");
const path = require("path");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const DATA_DIR = path.join(__dirname, "..", "data");

const gtdMerkle = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "gtd-merkle.json"), "utf8"));
const fcfsMerkle = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "fcfs-merkle.json"), "utf8"));
const master = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "wl-master.json"), "utf8").replace(/^\uFEFF/, ""));

const gtdRoot = gtdMerkle.root;
const fcfsRoot = fcfsMerkle.root;
const gtdProofs = gtdMerkle.proofs;
const fcfsProofs = fcfsMerkle.proofs;

let gtdOk = 0, gtdFail = 0;
let fcfsOk = 0, fcfsFail = 0;
let crossFail = 0;

// Verify all GTD
for (const [addr, proof] of Object.entries(gtdProofs)) {
  const leaf = keccak256(addr);
  const ok = gtdMerkle.root === "0x" + (new MerkleTree([leaf], keccak256, { sortPairs: true })).constructor.prototype.bufferToHex ? false : false;
  // Use merkletreejs verify
  const tree = new MerkleTree([], keccak256, { sortPairs: true });
  const verified = tree.verify(proof, leaf, Buffer.from(gtdRoot.slice(2), "hex"));
  if (verified) gtdOk++; else { gtdFail++; if (gtdFail <= 3) console.log(`  GTD FAIL: ${addr}`); }
}

// Verify all FCFS
for (const [addr, proof] of Object.entries(fcfsProofs)) {
  const leaf = keccak256(addr);
  const tree = new MerkleTree([], keccak256, { sortPairs: true });
  const verified = tree.verify(proof, leaf, Buffer.from(fcfsRoot.slice(2), "hex"));
  if (verified) fcfsOk++; else { fcfsFail++; if (fcfsFail <= 3) console.log(`  FCFS FAIL: ${addr}`); }
}

// Cross-check: FCFS addresses should NOT verify against GTD root
let crossOk = 0, crossErr = 0;
for (const [addr] of Object.entries(fcfsProofs).slice(0, 100)) {
  const leaf = keccak256(addr);
  const tree = new MerkleTree([], keccak256, { sortPairs: true });
  const verified = tree.verify(gtdProofs[addr] || [], leaf, Buffer.from(gtdRoot.slice(2), "hex"));
  if (verified) crossErr++;
  else crossOk++;
}

// Check overlap addresses
let inGtd = 0, inFcfs = 0;
for (const entry of master) {
  if (entry.list === "GTD+FCFS") {
    if (gtdProofs[entry.address]) inGtd++;
    if (fcfsProofs[entry.address]) inFcfs++;
  }
}

console.log("=== Verification Report ===");
console.log(`GTD proofs: ${gtdOk} OK, ${gtdFail} FAIL`);
console.log(`FCFS proofs: ${fcfsOk} OK, ${fcfsFail} FAIL`);
console.log(`Cross-check (FCFS vs GTD root): ${crossOk} correctly rejected, ${crossErr} incorrectly accepted`);
console.log(`Overlap (GTD+FCFS): ${inGtd} in GTD tree, ${inFcfs} in FCFS tree (should be: ${inGtd} in GTD, 0 in FCFS)`);
console.log(`\nTotal GTD proofs: ${Object.keys(gtdProofs).length}`);
console.log(`Total FCFS proofs: ${Object.keys(fcfsProofs).length}`);
console.log(`Master total: ${master.length}`);
console.log(`\nGTD Root: ${gtdRoot}`);
console.log(`FCFS Root: ${fcfsRoot}`);
