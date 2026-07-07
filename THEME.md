# Theming a BigRed site

BigRed is a **template**: one codebase, many self-branded niche marketplaces (a music ring, an AI-agents ring,
a photography ring…), each pointed at its own on-chain inventory. `nft.sale` is the flagship / reference theme.

Re-theming is a fork + a few edits. The site's whole identity lives in **`brand.json`** (applied at load by
`app.js`), plus a couple of static files that search/social crawlers read directly.

## To spin up a new site

1. **Fork/copy the repo.**

2. **Edit `brand.json`** — the one file that drives the live UI:
   - `wordmark` — the name shown in the header (e.g. `"musicvault"`)
   - `lightning` — `true`/`false` to show the ⚡ next to the logo
   - `tagline`, `howto` — the two header lines (HTML allowed)
   - `sellHeading`, `sellText` — the "sell here" band copy
   - `footer` — the two flavour lines (HTML allowed)
   - `colors` — the full palette (`accent` = brand/identity red, `cta` = purchase-button colour, `link`, `bg`,
     `panel`, `line`, `fg`, `muted`, plus the `-fg` text colours). These map straight to CSS variables.

3. **Swap two brand assets** (keep the same filenames):
   - `brand/favicon.svg` — the logo (shows in the tab *and* the header)
   - `brand/og-banner.jpg` — the social/link-preview image (1344×768)

4. **Edit the `<head>` block in `index.html`** — `<title>`, `<meta name="description">`, and the `og:`/`twitter:`
   tags. Crawlers don't run JS, so these must be static for correct search results + link previews.

5. **Point `listings.json` at your OWN site key** — set `sitePubKey` to a fresh **air-gapped cold public key**
   (never reuse another site's), and `affRefCode` to your SimpleSwap referral. Then onboard your inventory to
   that wallet and run the curator (see `SERVER_CURATION.md`), which fills in the listings + covers from chain.

That's it — colors, logo, banner, copy, and inventory, all swapped.

## Notes
- `brand.json` values are trusted HTML (the site owner controls the file) — that's why `<b>`/emoji work in them.
- The HTML in `index.html` keeps the flagship values as a **fallback** (for no-JS + the first paint); `brand.json`
  overrides them once loaded. A fork can update those fallbacks too for a flash-free first paint, but it's optional.
- `colors` in `brand.json` mirror the defaults in `style.css :root`. Editing either works; `brand.json` wins.
- Checkout always routes to the shared SMART NFTs wallet at **smartnfts.com** — that part isn't per-site.
