/**
 * POST /api/rpc
 * Proxies read-only JSON-RPC calls for the frontend.
 * Only allows eth_call, eth_getBalance, eth_getTransactionReceipt, eth_blockNumber.
 * Rate-limited: 100 requests per 60 seconds per IP.
 */

const ALLOWED_METHODS = new Set([
  "eth_call",
  "eth_getBalance",
  "eth_getTransactionReceipt",
  "eth_getTransactionCount",
  "eth_blockNumber",
  "eth_chainId",
  "eth_gasPrice",
  "eth_estimateGas",
]);

const rateMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= 100) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    entry.count++;
  } else {
    rateMap.set(ip, { count: 1, resetAt: now + 60_000 });
  }

  const body = await req.json();
  const method = body?.method;
  if (!method || !ALLOWED_METHODS.has(method)) {
    return Response.json({ error: `Method not allowed: ${method}` }, { status: 403 });
  }

  const rpcUrl = process.env.NEXT_PUBLIC_MAINNET_RPC;
  if (!rpcUrl) {
    return Response.json({ error: "RPC not configured" }, { status: 500 });
  }

  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data, {
    headers: { "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*" },
  });
}
