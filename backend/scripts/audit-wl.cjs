const fs = require("fs");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const BASE = "c:/Users/yasha/vsCode/GoogleStockNFT/backend/data";

const gtd = JSON.parse(fs.readFileSync(BASE + "/gtd-merkle.json", "utf8"));
const fcfs = JSON.parse(fs.readFileSync(BASE + "/fcfs-merkle.json", "utf8"));
const master = JSON.parse(fs.readFileSync(BASE + "/wl-master.json", "utf8").replace(/^\uFEFF/, ""));

const gtdSet = new Set(Object.keys(gtd.proofs));
const fcfsSet = new Set(Object.keys(fcfs.proofs));

console.log("=== Full WL Audit ===\n");

// 1. Basic counts
console.log("1. COUNTS");
console.log("   GTD Merkle proofs: " + gtdSet.size);
console.log("   FCFS Merkle proofs: " + fcfsSet.size);
console.log("   Master WL entries: " + master.length);
console.log("   GTD+FCFS combined (unique): " + new Set([...gtdSet, ...fcfsSet]).size);

// 2. Overlap check
const common = [...gtdSet].filter(a => fcfsSet.has(a));
console.log("\n2. OVERLAP (addresses in BOTH trees - should be 0)");
console.log("   Count: " + common.length);
if (common.length > 0) {
    console.log("   ⚠️  ADDRESSES IN BOTH TREES:");
    common.slice(0, 10).forEach(a => console.log("   " + a));
}

// 3. Master WL consistency
let masterGtd = 0, masterFcfs = 0, masterBoth = 0;
let notInAnyTree = 0;
for (const e of master) {
    const a = e.address.toLowerCase();
    const inGtd = gtdSet.has(a);
    const inFcfs = fcfsSet.has(a);
    
    if (inGtd && inFcfs) masterBoth++;
    else if (inGtd) masterGtd++;
    else if (inFcfs) masterFcfs++;
    else notInAnyTree++;
}
console.log("\n3. MASTER WL vs MERKLE TREES");
console.log("   In GTD tree: " + masterGtd);
console.log("   In FCFS tree: " + masterFcfs);
console.log("   In both trees: " + masterBoth + " (should be 0)");
console.log("   NOT in any tree: " + notInAnyTree + " (should be 0)");

// 4. Overlap addresses from master (GTD+FCFS tag)
const overlapMasters = master.filter(e => e.list === "GTD+FCFS");
console.log("\n4. GTD+FCFS OVERLAP from master");
console.log("   Count: " + overlapMasters.length);
let inGtdOk = 0, inFcfsWrong = 0;
for (const e of overlapMasters) {
    if (gtdSet.has(e.address.toLowerCase())) inGtdOk++;
    if (fcfsSet.has(e.address.toLowerCase())) inFcfsWrong++;
}
console.log("   In GTD tree: " + inGtdOk + " (should be " + overlapMasters.length + ")");
console.log("   In FCFS tree: " + inFcfsWrong + " (should be 0)");

// 5. Duplicate check within each tree
const gtdArr = [...gtdSet];
const fcfsArr = [...fcfsSet];
console.log("\n5. DUPLICATES within trees");
console.log("   GTD unique: " + gtdArr.length + " (expected: " + gtdArr.length + ")");
console.log("   FCFS unique: " + fcfsArr.length + " (expected: " + fcfsArr.length + ")");

// 6. Merkle verification
console.log("\n6. MERKLE VERIFICATION (spot check)");
const gtdLeaves = gtdArr.map(a => keccak256(a));
const gtdTree = new MerkleTree(gtdLeaves, keccak256, { sortPairs: true });
const gtdRootOk = "0x" + gtdTree.getRoot().toString("hex") === gtd.root;

const fcfsLeaves = fcfsArr.map(a => keccak256(a));
const fcfsTree = new MerkleTree(fcfsLeaves, keccak256, { sortPairs: true });
const fcfsRootOk = "0x" + fcfsTree.getRoot().toString("hex") === fcfs.root;

console.log("   GTD root verified: " + gtdRootOk);
console.log("   FCFS root verified: " + fcfsRootOk);

// Verify all proofs
let gtdOk = 0;
for (const a of gtdArr) {
    const leaf = keccak256(a);
    const proof = gtdTree.getProof(leaf);
    if (gtdTree.verify(proof, leaf, gtdTree.getRoot())) gtdOk++;
}
let fcfsOk = 0;
for (const a of fcfsArr) {
    const leaf = keccak256(a);
    const proof = fcfsTree.getProof(leaf);
    if (fcfsTree.verify(proof, leaf, fcfsTree.getRoot())) fcfsOk++;
}
console.log("   GTD proofs valid: " + gtdOk + "/" + gtdArr.length + " " + (gtdOk === gtdArr.length ? "✅" : "❌"));
console.log("   FCFS proofs valid: " + fcfsOk + "/" + fcfsArr.length + " " + (fcfsOk === fcfsArr.length ? "✅" : "❌"));

// 7. Final summary
console.log("\n=== FINAL SUMMARY ===");
console.log("Total unique WL: " + new Set([...gtdSet, ...fcfsSet]).size);
console.log("GTD: " + gtdSet.size);
console.log("FCFS: " + fcfsSet.size);
console.log("Overlap between trees: " + common.length);
console.log("\nGTD root:  " + gtd.root);
console.log("FCFS root: " + fcfs.root);
