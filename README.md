# Big Red — the SMART NFT sales ring (nft.sale)

> Codename **`bigred`** (after Phar Lap's nickname); public brand **nft.sale**. Phar Lap is the wallet you
> stable him in; Big Red is the ring where he's sold.

A **static** content-listing / resale site for [SMART NFTs](https://smartnfts.com) (Phar Lap editions) — including
**Block Media Format** media atoms and BMC sets. It curates editions and links to the SMART NFTs sales page for
one-click checkout. The site holds a copy of each listed edition (as a reseller) and **earns the
covenant-enforced reseller fee on every sale it drives** — with **no live wallet** (it never signs; it earns
passively). Owned, not claimed.

Big Red is the **sell** corner of the trinity: **[Phar Lap](https://smartnfts.com)** (own/mint) · **Big Red**
(sell) · **[Pole Position](https://github.com/sun-dive/PolePosition)** (create).

**Big Red is open — run your own.** Anyone can stand up a Big Red site; each is a self-owned reseller that earns
the covenant reseller fee on the sales it drives. Expect many — niche catalogs curated for different audiences.
See **Run your own**, below.

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
- `.htaccess` — cache headers + a CORS allowance so the smartnfts.com sales page can fast-paint from this catalog.

## One-time setup
1. **Create the site's wallet, cold.** In Phar Lap (smartnfts.com) → **New wallet** (ideally offline). Write the
   seed down and keep it OFFLINE. Copy the **Public key** — that pubkey is the site's identity here.
   - **Never** put the site's seed / WIF on the server or in this repo. Only the *public* key goes in
     `listings.json`.
2. Set `sitePubKey` in `listings.json` to that public key. (The curator reuses this file's `sitePubKey` /
   `affRefCode`; it only overwrites the `listings` array + `covers/`.)
3. *(Optional)* set `affRefCode` to your **SimpleSwap** referral code → buyers who fund up with BSV via your
   links also earn you the signup referral.
4. Stand up the **curation cron** on the server (a bundled curator that scans the site wallet and writes
   `listings.json` + `covers/` into the web root). Setup lives in **SERVER_CURATION.md** in the Phar Lap repo.

## Adding a listing (automated)
There is **no manual editing** — the site wallet is the registry, and the cron does the rest.
1. **Publish your seller note first.** In Phar Lap, on the edition's card, set/publish the on-chain **seller
   note** (heading → listing title, text → description, tags → category tags). Do this *before* onboarding so it's
   propagated by the time the copy lands. The note is authored by your **identity wallet** and stays yours to
   update any time — re-publish to re-tag or re-title a listing, across every site that lists you.
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
- **🎧 Free preview** — music listings get a lazy "listen before you buy" clip player (an on-chain seller-note
  preview when present, else an auto-sliced 30s cover for MP3 content).
- **⟲ Back-cover flip** — listings minted with a back cover get an animated 3D card flip (front ⇄ back).
- **Sales tracking + sort** — each card shows a **🔥 N sold** count (copies sold through the site, from the site
  wallet's replicate history), plus a **Sort** control (Most sold / Newest / Price low↔high).
- **Short links + rich previews** — static redirect pages at `nft.sale/r/<slug>` (and a hex code) carry Open
  Graph / Twitter Card tags so shared links render rich previews, plus an on-site **spotlight** view
  (`/?n=<slug>`). Each card has a **🔗 Copy share link** button.
- **Fast checkout hand-off** — the "Get a copy" link passes `&src=<host>` so the smartnfts.com sales page paints
  this catalog's cached cover/title/description instantly, instead of waiting on the chain.
- **Category tag filters** + **infinite scroll** (progressive card rendering).
- **"Sell here"** publisher onboarding — links to `smartnfts.com/#list=<sitePubKey>`, opening the wallet ready to
  onboard a copy (plus the raw pubkey to paste into **Onboard partner**).

## Run your own — especially publishers

Big Red is meant to be forked. For a **content publisher**, running your own is an **owned distribution
channel**: a self-hosted catalog of your work, on a domain **you** control, with built-in **shareable short
links + rich social previews** (`your.domain/r/<slug>`, Open Graph / Twitter cards) — the easy, on-brand way to
push your releases across social media instead of relying on someone else's site. You also **capture the reseller
fee on your own sales** (your site is the reseller) on top of the publisher fee, and keep full control of the
storefront — theme, curation, and which editions appear. It's static, cheap to host, and needs no live wallet.

## Deploy (Namecheap / cPanel)
Upload the folder contents to `public_html` (or your domain/subdomain's docroot) via cPanel File Manager, FTP,
or git deploy, and set up the curation cron (see **SERVER_CURATION.md**). Point your idle domain at it. That's it —
browsing makes **zero** blockchain calls; checkout happens on smartnfts.com. The cron owns `listings.json` +
`covers/` + `r/` in the web root, so leave those to it.

## Collecting earnings
The site earns the reseller fee passively to `sitePubKey`. To monitor: load the **public key** in Phar Lap's
**👁 Watch a wallet** (watch-only, no key). To withdraw: sign a sweep on your offline machine via the
**air-gapped signing** flow. The private key never needs to touch the server.

## Ecosystem
- **[Phar Lap](https://smartnfts.com)** — the SMART NFT wallet + covenant mint engine ([repo](https://github.com/sun-dive/PharLap)).
- **[Pole Position](https://github.com/sun-dive/PolePosition)** — the create/authoring studio (ebooks, music, Block Media Format).
- **[Block Media Format](https://github.com/sun-dive/block-media-format)** — the open BMF/BMC spec (proposed BRC-145); Big Red lists BMF atoms and BMC sets like any other SMART NFT.

## License
© 2026 sun-dive. Licensed under the **Open BSV License Version 6** — see [LICENSE](./LICENSE). © BSV Association.
The software, and anything derived from it, **may only be used on the BSV Blockchain**.
