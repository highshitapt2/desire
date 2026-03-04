// api/scrape.js  — Vercel serverless function
// Runs on the SERVER so no CORS issues, no blocked requests.
// Called by the PWA frontend: POST /api/scrape { url: "https://..." }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "url required" });

  const cleanUrl = url.trim().startsWith("http") ? url.trim() : "https://" + url.trim();
  let domain = "";
  try { domain = new URL(cleanUrl).hostname.replace("www.", ""); } catch {
    return res.status(400).json({ error: "invalid url" });
  }

  // ── Fetch the page HTML ──────────────────────────
  let html = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      }
    });
    clearTimeout(timeout);
    html = await r.text();
  } catch (e) {
    return res.status(502).json({ error: "fetch failed", detail: e.message });
  }

  // ── Extract meta tags ────────────────────────────
  const meta = (property) => {
    const patterns = [
      new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, "i"),
      new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, "i"),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]) return m[1].trim();
    }
    return null;
  };

  const ogImage    = meta("og:image") || meta("twitter:image") || meta("twitter:image:src");
  const ogTitle    = meta("og:title") || meta("twitter:title");
  const ogPrice    = meta("product:price:amount") || meta("og:price:amount");
  const ogCurrency = meta("product:price:currency") || meta("og:price:currency");
  const ogBrand    = meta("og:brand") || meta("product:brand");
  const ogDesc     = meta("og:description") || meta("twitter:description");

  // ── Title fallback from <title> tag ─────────────
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle  = ogTitle || (titleMatch ? titleMatch[1].trim() : null);

  // ── Price from JSON-LD schema ────────────────────
  let schemaPrice = null;
  let schemaImage = null;
  try {
    const jsonLdMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const match of jsonLdMatches) {
      try {
        const schema = JSON.parse(match[1]);
        const items = Array.isArray(schema) ? schema : [schema];
        for (const item of items) {
          const s = item["@type"] === "Product" ? item : item?.mainEntity;
          if (!s) continue;
          const offer = Array.isArray(s.offers) ? s.offers[0] : s.offers;
          if (offer?.price) schemaPrice = offer.price + (offer.priceCurrency ? " " + offer.priceCurrency : "");
          if (s.image) schemaImage = Array.isArray(s.image) ? s.image[0] : s.image;
        }
      } catch {}
    }
  } catch {}

  const finalImage = ogImage || schemaImage || null;
  const rawPrice   = ogPrice ? `${ogPrice}${ogCurrency ? " " + ogCurrency : ""}` : schemaPrice;

  return res.status(200).json({
    url: cleanUrl,
    domain,
    image: finalImage,
    title: pageTitle,
    price: rawPrice,
    brand: ogBrand,
    description: ogDesc,
  });
}
