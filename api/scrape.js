// api/scrape.js — headless browser scraper for Vercel
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

let _browser = null;
async function getBrowser() {
  if (_browser) return _browser;
  _browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
  return _browser;
}

function titleFromPath(path) {
  const skip = new Set(["buy","mailers","p","dp","products","collections","dresses","tops","bags","footwear","dress","women","men","clothing"]);
  const parts = path.split("/").filter(p => p && !skip.has(p) && !/^\d+$/.test(p));
  const slug = parts.find(p => p.length > 8 && p.includes("-")) || parts[parts.length - 1] || "";
  return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()).slice(0, 80);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "url required" });

  const cleanUrl = url.trim().startsWith("http") ? url.trim() : "https://" + url.trim();
  let domain = "", pathname = "";
  try { const u = new URL(cleanUrl); domain = u.hostname.replace("www.", ""); pathname = u.pathname; }
  catch { return res.status(400).json({ error: "invalid url" }); }

  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", r => {
      if (["font","media","stylesheet"].includes(r.resourceType())) r.abort();
      else r.continue();
    });

    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-IN,en;q=0.9" });
    await page.goto(cleanUrl, { waitUntil: "networkidle2", timeout: 25000 });

    let image = null, price = null, title = null, brand = null;

    if (domain.includes("myntra.com")) {
      await page.waitForSelector(".pdp-price, .pdp-title, .image-grid-image", { timeout: 8000 }).catch(() => {});
      const d = await page.evaluate(() => {
        const img = document.querySelector(".image-grid-image img, img.content-image, .pdp-img img");
        const og  = document.querySelector('meta[property="og:image"]');
        const priceEl = document.querySelector(".pdp-price strong, .pdp-discount-container strong");
        const titleEl = document.querySelector(".pdp-title h1, h1.pdp-name");
        const brandEl = document.querySelector(".pdp-title h3, .pdp-brand-title");
        return {
          image: img?.src || og?.content || null,
          price: priceEl?.textContent?.trim() || null,
          title: titleEl?.textContent?.trim() || document.title?.split("|")[0]?.trim() || null,
          brand: brandEl?.textContent?.trim() || null,
        };
      });
      image = d.image; price = d.price; title = d.title; brand = d.brand;
    }

    else if (domain.includes("meesho.com")) {
      await page.waitForSelector('h4, p[class*="price"], img', { timeout: 8000 }).catch(() => {});
      const d = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll("img")].filter(i => i.src?.includes("meesho") && i.naturalWidth > 100);
        const priceEl = document.querySelector('h4[class*="Price"], span[class*="discountedPrice"], h5');
        const titleEl = document.querySelector('p[class*="ProductTitle"], h1');
        const og = document.querySelector('meta[property="og:image"]');
        return {
          image: imgs[0]?.src || og?.content || null,
          price: priceEl?.textContent?.trim() || null,
          title: titleEl?.textContent?.trim() || document.title?.split("|")[0]?.trim() || null,
          brand: "Meesho",
        };
      });
      image = d.image; price = d.price; title = d.title; brand = d.brand;
    }

    else if (domain.includes("ajio.com")) {
      await page.waitForSelector(".prod-name, .prod-sp", { timeout: 8000 }).catch(() => {});
      const d = await page.evaluate(() => ({
        image: document.querySelector(".rilrtl-product-img img, .prod-image img")?.src || document.querySelector('meta[property="og:image"]')?.content || null,
        price: document.querySelector(".prod-sp")?.textContent?.trim() || null,
        title: document.querySelector(".prod-name")?.textContent?.trim() || document.querySelector('meta[property="og:title"]')?.content || null,
        brand: document.querySelector(".brand-name")?.textContent?.trim() || "Ajio",
      }));
      image = d.image; price = d.price; title = d.title; brand = d.brand;
    }

    else {
      // Generic: og tags + JSON-LD
      const d = await page.evaluate(() => {
        let jsonPrice = null;
        for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
          try {
            for (const item of [].concat(JSON.parse(el.textContent))) {
              const prod = item["@type"] === "Product" ? item : item?.mainEntity;
              const offer = prod && [].concat(prod.offers)[0];
              if (offer?.price) { jsonPrice = (offer.priceCurrency || "") + " " + offer.price; break; }
            }
          } catch {}
          if (jsonPrice) break;
        }
        const amt = document.querySelector('meta[property="product:price:amount"]')?.content;
        const cur = document.querySelector('meta[property="product:price:currency"]')?.content || "";
        return {
          image: document.querySelector('meta[property="og:image"]')?.content || null,
          title: document.querySelector('meta[property="og:title"]')?.content || document.title?.split("|")[0]?.trim() || null,
          brand: document.querySelector('meta[property="og:brand"], meta[property="product:brand"]')?.content || null,
          price: amt ? cur + " " + amt : jsonPrice,
        };
      });
      image = d.image; price = d.price; title = d.title; brand = d.brand;
    }

    if (!title) title = titleFromPath(pathname);
    await page.close();
    return res.status(200).json({ url: cleanUrl, domain, image, title, price, brand });

  } catch (err) {
    if (page) await page.close().catch(() => {});
    console.error(err.message);
    return res.status(200).json({ url: cleanUrl, domain, image: null, title: titleFromPath(pathname), price: null, brand: null });
  }
}
