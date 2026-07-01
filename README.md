# Big Red — the SMART NFT sales ring (nft.sale)

> Codename **`bigred`** (after Phar Lap's nickname); public brand **nft.sale**. Phar Lap is the wallet you
> stable him in; Big Red is the ring where he's sold.

A **static** content-listing / resale site for [SMART NFTs](https://smartnfts.com) (Phar Lap) editions.
It curates editions and links to the SMART NFTs sales page for one-click checkout. The site holds a copy of
each listed edition (as a reseller) and **earns the covenant-enforced reseller fee on every sale it drives** —
with **no live wallet** (it never signs; it earns passively).

The catalog is **auto-curated**: the **cold site wallet IS the registry**. A publisher onboards a copy of their
edition to the site wallet, and a **server-side cron** scans the wallet's held editions and auto-writes
`listings.json` + `covers/` straight into the web root. There is no manual editing and no git for the catalog.

> **Design rule:** keep this front-end purely static — no on-chain code. Cover/title/price are cached values the
> curator populates at curation time. The on-chain buy logic stays in Phar Lap; the embeddable buy core arrives
> later (Option C / M3). So nothing here becomes redundant — the catalog data model carries straight into Option C.

## Files
- `index.html` / `style.css` / `app.js` — the catalog page (renders cards from `listings.json`).
- `listings.json` — the catalog + the site's public key. **Written by the curation cron — don't hand-edit.**
- `covers/` — cover images (written by the curator; cached hard by the CDN/host).
- `r/` — short-link redirect pages (`nft.sale/r/<slug>`), each with Open Graph / Twitter Card tags for rich
  previews. Also written by the curator.
- `.htaccess` — cache headers for Namecheap/Apache.

## One-time setup
1. **Create the site's wallet, cold.** In Phar Lap (smartnfts.com) → **New wallet** (ideally offline). Write the
   seed down and keep it OFFLINE. Copy the **Public key**. That pubkey is the site's identity here.
   - **Never** put the site's seed / WIF on the server or in this repo. Only the *public* key goes in
     `listings.json`.
2. Set `sitePubKey` in `listings.json` to that public key. (The curator reuses this file's `sitePubKey` /
   `affRefCode`; it only overwrites the `listings` array + `covers/`.)
3. *(Optional)* set `affRefCode` to your Orange Gateway referral code → buyers who fund up via your links also
   earn you the signup referral.
4. Stand up the **curation cron** on the server (a bundled curator that scans the site wallet and writes
   `listings.json` + `covers/` into the web root). Setup lives in **SERVER_CURATION.md** in the Phar Lap repo.

## Adding a listing (automated)
There is **no manual editing** — the site wallet is the registry, and the cron does the rest.
1. **Publish your seller note first.** In Phar Lap, on the edition's card, set/publish the on-chain **seller
   note** (heading → listing title, text → description, tags → category tags). Do this *before* onboarding so it's
   propagated by the time the copy lands.
2. **Onboard a copy** to the site wallet — either in Phar Lap via **🤝 Onboard partner** (paste the site's
   `sitePubKey`), or from the site's **"Sell here"** deep link (`smartnfts.com/#list=<sitePubKey>`), which opens
   the wallet ready to send a copy.
3. **Wait ~15 min.** The cron scans the site wallet's held editions and auto-writes the listing — cover, title,
   description, tags, price, validated-genesis date, and sales count — straight into the web root.

Per listing, the curator pulls fields from the publisher's on-chain seller note (heading → title, text →
description, tags → tags), falling back to TX1 metadata when a note is absent. It's efficient and safe on large
mints: it reads only the small template / storefront outputs, never a mint's tens-of-MB content. Listings that
fail covenant verification are hidden.

## Catalog features (front-end)
The page is purely static — browsing makes **zero** blockchain calls — but the curator bakes in a lot:
- **Validated-genesis badge** — each card shows a **✓ Genesis · issued &lt;date&gt;** pill linking to
  WhatsOnChain, verified at curation time. Listings that fail covenant verification never appear.
- **Sales tracking + sort** — each card shows a **🔥 N sold** count (copies sold through the site, counted from
  the site wallet's replicate history), plus a **Sort** control (Most sold / Newest / Price low↔high).
- **Short links + rich previews** — static redirect pages at `nft.sale/r/<slug>` (and a hex code) carry Open
  Graph / Twitter Card tags so shared links render rich previews. Each card has a **🔗 Copy share link** button.
- **Category tag filters** + **infinite scroll** (progressive card rendering).
- **"Sell here"** publisher onboarding — links to `smartnfts.com/#list=<sitePubKey>`, opening the wallet ready to
  onboard a copy (plus the raw pubkey to paste into **Onboard partner**).

## Deploy (Namecheap / cPanel)
Upload the folder contents to `public_html` (or your domain/subdomain's docroot) via cPanel File Manager, FTP,
or git deploy, and set up the curation cron (see **SERVER_CURATION.md**). Point your idle domain at it. That's it —
browsing makes **zero** blockchain calls; checkout happens on smartnfts.com. The cron owns `listings.json` +
`covers/` + `r/` in the web root, so leave those to it.

## Collecting earnings
The site earns the reseller fee passively to `sitePubKey`. To monitor: load the **public key** in Phar Lap's
**👁 Watch a wallet** (watch-only, no key). To withdraw: sign a sweep on your offline machine via the
**air-gapped signing** flow. The private key never needs to touch the server.
