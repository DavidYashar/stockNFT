// GET /api/googl-price — proxies Yahoo Finance NASDAQ:GOOGL price (server-side, no CORS)
export async function GET() {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/GOOGL?range=1d&interval=1d"
    );
    if (!res.ok) throw new Error("Yahoo fetch failed");
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price === "number" && price > 0) {
      return Response.json({ price });
    }
    throw new Error("Invalid price");
  } catch {
    return Response.json({ price: null }, { status: 502 });
  }
}
