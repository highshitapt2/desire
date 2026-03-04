[README.md](https://github.com/user-attachments/files/25733379/README.md)
# desire — fashion wishlist PWA

A free, installable fashion wishlist that works like Pinterest.
Paste any product link → scrapes real image + price → save to collections.

## How it works

```
User shares link from Myntra/Meesho/Zara
        ↓
/api/scrape (Vercel serverless) — fetches page server-side, no CORS
        ↓
Extracts og:image, og:title, price from JSON-LD schema
        ↓
Claude AI cleans up title, detects category, infers color/material
        ↓
Preview sheet slides up with real product photo
        ↓
User saves to desires / collections
```

---

## Deploy in 5 minutes (100% free)

### Step 1 — Get the code on GitHub
1. Create a free account at github.com
2. Create a new repository called `desire`
3. Upload all these files maintaining the folder structure:
   ```
   desire/
   ├── api/
   │   └── scrape.js
   ├── public/
   │   ├── index.html
   │   ├── manifest.json
   │   └── sw.js
   └── vercel.json
   ```

### Step 2 — Deploy to Vercel (free)
1. Go to vercel.com → sign up free with GitHub
2. Click "Add New Project" → import your `desire` repo
3. Vercel auto-detects everything — just click **Deploy**
4. You'll get a URL like `https://desire-yourname.vercel.app`

That's it. Your app is live. ✓

---

## Add icons (optional but looks polished)

Create a folder `public/icons/` and add:
- `icon-192.png` — 192×192px app icon
- `icon-512.png` — 512×512px app icon

Use any square image. Free tools: canva.com, favicon.io

---

## Install on Android (Chrome)

1. Open `https://desire-yourname.vercel.app` in Chrome
2. Tap the **"Install"** banner that appears at the top
   — OR — tap the 3-dot menu → "Add to Home Screen"
3. It installs like a native app. Full screen, no browser bar.

**Enable share sheet (Android):**
Once installed, when you tap Share on any product in Myntra/Meesho/Zara,
"Desire" will appear as a share target automatically.

---

## Install on iPhone (Safari)

1. Open the URL in **Safari** (must be Safari, not Chrome)
2. Tap the Share button (box with arrow) at the bottom
3. Scroll down → tap **"Add to Home Screen"**
4. Tap Add

> Note: iOS does not support the Web Share Target API,
> so you can't share directly from Myntra. The workaround:
> copy the product link → open Desire → paste → preview.
> A native iOS app (React Native) would solve this properly.

---

## Costs

| Service | Plan | Cost |
|---------|------|------|
| Vercel hosting | Hobby | Free |
| Vercel serverless | 100GB-hrs/month | Free |
| Domain (optional) | — | ~$10/year |

**Total: $0.** No API keys needed. No accounts other than GitHub + Vercel.

---

## File structure

```
api/scrape.js          ← Vercel serverless: scrapes og:image server-side
public/index.html      ← The entire PWA app (vanilla JS, no build step)
public/manifest.json   ← PWA manifest (icons, share target, install)
public/sw.js           ← Service worker (offline support, caching)
vercel.json            ← Routing + headers config
```
