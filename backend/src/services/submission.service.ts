/**
 * Whitelist Submission Service
 *
 * Simple JSON file store for whitelist submissions.
 * Each entry: twitterUsername, retweetUrl, tweetUrl, walletAddress, submittedAt.
 */

import * as fs from "fs";
import * as path from "path";

// ---- Types ----
export interface SubmittedEntry {
  twitterUsername: string;
  retweetUrl: string;
  tweetUrl: string;
  walletAddress: string;
  submittedAt: string;
}

const SUBMIT_PATH = path.join(__dirname, "..", "..", "data", "whitelist-submitted.json");

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readSubmissions(): SubmittedEntry[] {
  try { ensureDir(SUBMIT_PATH); return JSON.parse(fs.readFileSync(SUBMIT_PATH, "utf8")); }
  catch { return []; }
}

function writeSubmissions(s: SubmittedEntry[]) {
  fs.writeFileSync(SUBMIT_PATH, JSON.stringify(s, null, 2));
}

export function submitWhitelist(entry: SubmittedEntry): SubmittedEntry {
  const subs = readSubmissions();
  // Deduplicate by wallet address
  const existing = subs.findIndex(
    s => s.walletAddress.toLowerCase() === entry.walletAddress.toLowerCase()
  );
  const record: SubmittedEntry = {
    ...entry,
    walletAddress: entry.walletAddress.toLowerCase(),
    submittedAt: new Date().toISOString(),
  };
  if (existing >= 0) {
    subs[existing] = record;
  } else {
    subs.push(record);
  }
  writeSubmissions(subs);
  return record;
}

/** Check if wallet OR Twitter username already exists */
export function isDuplicate(walletAddress: string, twitterUsername: string): { wallet: boolean; twitter: boolean } {
  const subs = readSubmissions();
  const addr = walletAddress.toLowerCase();
  const tw = twitterUsername.trim().toLowerCase().replace(/^@/, "");
  return {
    wallet: subs.some(s => s.walletAddress.toLowerCase() === addr),
    twitter: subs.some(s => s.twitterUsername.trim().toLowerCase().replace(/^@/, "") === tw),
  };
}

export function getSubmission(address: string): SubmittedEntry | null {
  return readSubmissions().find(
    s => s.walletAddress.toLowerCase() === address.toLowerCase()
  ) || null;
}

export function getAllSubmissions(): SubmittedEntry[] {
  return readSubmissions();
}
