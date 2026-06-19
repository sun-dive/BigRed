# Big Red — the SMART NFT sales ring (nft.sale)

> Codename **`bigred`** (after Phar Lap's nickname); public brand **nft.sale**. Phar Lap is the wallet you
> stable him in; Big Red is the ring where he's sold.

A **static** content-listing / resale site for [SMART NFTs](https://smartnfts.com) (Phar Lap) V1 editions.
It curates editions and links to the SMART NFTs sales page for one-click checkout. The site holds a copy of
each listed edition (as a reseller) and **earns the covenant-enforced reseller fee on every sale it drives** —
with **no live wallet** (it never signs; it earns passively).

> **Design rule:** keep this site purely static — no on-chain code. Cover/title/price are cached values you
> populate at curation time. The on-chain buy logic stays in Phar Lap; the embeddable buy core arrives later
> (Option C / M3). So nothing here becomes redundant — the catalog data model carries straight into Option C.

## Files
- `index.html` / `style.css` / `app.js` — the catalog page (renders cards from `listings.json`).
- `listings.json` — your curated catalog + the site's public key.
- `covers/` — cover images (static files; cached hard by the CDN/host).
- `.htaccess` — cache headers for Namecheap/Apache.

## One-time setup
1. **Create the site's wallet, cold.** In Phar Lap (smartnfts.com) → **New wallet** (ideally offline). Write the
   seed down and keep it OFFLINE. Copy the **Public key**. That pubkey is the site's identity here.
   - **Never** put the site's seed / WIF on the server or in this repo. Only the *public* key goes in
     `listings.json`.
2. Set `sitePubKey` in `listings.json` to that public key.
3. *(Optional)* set `affRefCode` to your Orange Gateway referral code → buyers who fund up via your links also
   earn you the signup referral.

## Adding a listing
1. In Phar Lap, mint (or hold) the edition, then on its card click **🤝 Onboard partner** → paste the site's
   `sitePubKey` → confirm. This transfers a copy to the site and shows the listing link. You need the
   **collection ID** from it (`#c=<collectionId>&h=…`).
2. Add a row to `listings.json`:
   ```json
   { "collectionId": "<TX1 id>", "title": "…", "description": "…", "priceSats": 6000, "cover": "covers/<id>.jpg" }
   ```
   `priceSats` = publisher fee + holder fee (V1, fixed). Save the cover image into `covers/` (export it from the
   collection's SMART NFTs sales page or from Phar Lap).
3. Remove the placeholder example entry.

## Deploy (Namecheap / cPanel)
Upload the folder contents to `public_html` (or your domain/subdomain's docroot) via cPanel File Manager, FTP,
or git deploy. Point your idle domain at it. That's it — browsing makes **zero** blockchain calls; checkout
happens on smartnfts.com.

## Collecting earnings
The site earns the reseller fee passively to `sitePubKey`. To monitor: load the **public key** in Phar Lap's
**👁 Watch a wallet** (watch-only, no key). To withdraw: sign a sweep on your offline machine via the
**air-gapped signing** flow. The private key never needs to touch the server.
