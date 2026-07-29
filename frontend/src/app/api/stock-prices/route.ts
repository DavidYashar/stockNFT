/**
 * GET /api/stock-prices
 * Robinhood Stock Token API — 12 tokenized stocks.
 * Docs: https://docs.robinhood.com/chain/stock-token-apis
 * Cached 1 hour.
 */
const SYMBOLS = ["AAPL","GOOGL","TSLA","MSFT","NVDA","AMZN","META","XOM","NFLX","INTC","AMD","QCOM"];

export async function GET() {
  const results: { symbol: string; price: string; change: string; up: boolean }[] = [];

  await Promise.all(SYMBOLS.map(async (symbol) => {
    try {
      const res = await fetch(`https://api.robinhood.com/rhj/prices/${symbol}`, {
        headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const q = (await res.json())?.quotes?.[0];
      if (!q) return;
      const bid = parseFloat(q.bid), ask = parseFloat(q.ask), mid = (bid + ask) / 2;
      results.push({
        symbol,
        price: bid.toFixed(2),
        change: ((Math.abs(ask - bid) / mid) * 100).toFixed(2),
        up: ask >= bid,
      });
    } catch { /* skip */ }
  }));

  return Response.json(results, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=60",
    },
  });
}
