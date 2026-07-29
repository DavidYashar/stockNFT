/**
 * Whitelist Submission Routes
 *
 * POST /api/whitelist/submit      → Submit whitelist entry
 * GET  /api/whitelist/submissions  → List all submissions (admin)
 * GET  /api/whitelist/submission?address=0x... → Check if wallet submitted
 */

import * as http from "http";
import { submitWhitelist, getSubmission, getAllSubmissions, isDuplicate } from "../services/submission.service";

const TWITTER_URL_RE = /^https?:\/\/(x\.com|twitter\.com)\/[a-zA-Z0-9_]+\/status\/\d+/;
const TWITTER_USERNAME_RE = /^@?[a-zA-Z0-9_]{1,15}$/;

function sendJson(res: http.ServerResponse, code: number, data: any) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sanitize(input: string): string {
  // Allow only URL-safe characters, Twitter handles, and standard ASCII
  return input.replace(/[^a-zA-Z0-9@_\-\.\/\:\?\=\&\%\#]/g, "").slice(0, 500);
}

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    let size = 0;
    const MAX = 8192;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX) { resolve(null); req.destroy(); return; }
      body += chunk.toString();
    });
    req.on("end", () => {
      if (size > MAX) { resolve(null); return; }
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on("error", () => resolve(null));
  });
}

export async function handleWhitelistRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname;

  // ---- POST /api/whitelist/submit ----
  if (pathname === "/api/whitelist/submit" && req.method === "POST") {
    const body = await parseBody(req);
    const { twitterUsername, retweetUrl, tweetUrl, walletAddress } = body;

    if (!twitterUsername || !retweetUrl || !tweetUrl || !walletAddress) {
      sendJson(res, 400, { error: "All fields required: twitterUsername, retweetUrl, tweetUrl, walletAddress" });
      return true;
    }

    if (!walletAddress.startsWith("0x") || walletAddress.length !== 42) {
      sendJson(res, 400, { error: "Invalid wallet address" });
      return true;
    }

    // Sanitize inputs
    const sanitizedUsername = sanitize(twitterUsername);
    const sanitizedRetweet = sanitize(retweetUrl);
    const sanitizedTweet = sanitize(tweetUrl);

    // Validate Twitter username
    if (!TWITTER_USERNAME_RE.test(sanitizedUsername)) {
      sendJson(res, 400, { error: "Invalid Twitter username. Use @handle format." });
      return true;
    }

    // Validate URLs point to Twitter/X
    if (!TWITTER_URL_RE.test(sanitizedRetweet)) {
      sendJson(res, 400, { error: "Retweet URL must be a valid Twitter/X status link." });
      return true;
    }
    if (!TWITTER_URL_RE.test(sanitizedTweet)) {
      sendJson(res, 400, { error: "Tweet URL must be a valid Twitter/X status link." });
      return true;
    }

    // Check for duplicate wallet or Twitter username
    const dup = isDuplicate(walletAddress, sanitizedUsername);
    if (dup.wallet) {
      sendJson(res, 409, { error: "This wallet address has already been submitted." });
      return true;
    }
    if (dup.twitter) {
      sendJson(res, 409, { error: "This Twitter account has already been used for another wallet." });
      return true;
    }

    const entry = submitWhitelist({
      twitterUsername: sanitizedUsername,
      retweetUrl: sanitizedRetweet,
      tweetUrl: sanitizedTweet,
      walletAddress,
      submittedAt: "",
    });

    sendJson(res, 200, { success: true, entry });
    return true;
  }

  // ---- GET /api/whitelist/submissions (admin) ----
  if (pathname === "/api/whitelist/submissions" && req.method === "GET") {
    const subs = getAllSubmissions();
    sendJson(res, 200, { count: subs.length, submissions: subs });
    return true;
  }

  // ---- GET /api/whitelist/submission?address=0x... ----
  if (pathname === "/api/whitelist/submission" && req.method === "GET") {
    const address = url.searchParams.get("address")?.toLowerCase();
    if (!address) {
      sendJson(res, 400, { error: "address required" });
      return true;
    }
    const sub = getSubmission(address);
    sendJson(res, 200, sub ? { submitted: true, ...sub } : { submitted: false });
    return true;
  }

  return false;
}
