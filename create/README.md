# create.nft.sale — the casual front-door app

A friendly, casual-first web app: **Wallet · Draw · Messages**, served on the `create.nft.sale`
subdomain of Big Red. Multi-page (real URLs per section) so the **back button works** — unlike an SPA
where back exits the app.

## Structure (static, no build step)

```
create/
├── index.html          → redirects to ./draw/
├── draw/index.html     → the constrained-SVG collaborative-canvas draw tool  ← the live piece
├── wallet/index.html   → stub ("coming soon")
└── messages/index.html → stub ("coming soon")
```

- **Self-contained pages** — each page inlines its own CSS/JS; the shared nav is duplicated (a few lines)
  so there are no cross-file asset paths to break. Links between sections are relative (`../draw/`, …).
- **Same origin = one wallet.** All three sections live under `create.nft.sale`, so a wallet stored in
  `localStorage`/`IndexedDB` is shared across pages — the Draw page can mint using the Wallet page's keys.
- **Draw auto-saves** to `localStorage` (key `createNftSale.draw.v1`) — in-progress + committed marks
  survive a reload / navigating away and back.

## What's real vs. stubbed

- **Draw** — fully working: constrained SVG brush + shapes, themed palettes (theme = canvas identity),
  additive-only commit (marks lock), N/50 seal, live "buy price", `</> SVG` viewer, ultra-HQ PNG export.
  No chain / no payment yet — this is the *drawing-feel* slice.
- **Wallet / Messages** — placeholder pages, present so the nav + back-button structure is real.

## Deploy (server-side, your step)

1. In cPanel (or DNS), create the subdomain **`create.nft.sale`** and point its document root at this
   `create/` directory (e.g. `.../BigRed/create`).
2. That's it — static files, nothing to build or run. `create.nft.sale/` lands on the Draw canvas.
3. (Optional) the same `.htaccess` cache policy as the main site applies if inherited; not required.

## Notes

- Roadmap / rationale: `PolePosition/docs/SCENE-ENGINE-PLAN.md` (CHOSEN MVP section) and the app-architecture
  memory. Everything here is an early MVP and **subject to revision.**
