/*
 * SMART NFT Listings — Option A catalog renderer.
 *
 * INTENTIONALLY STATIC: this reads a curated listings.json and renders cards that link to the SMART NFTs
 * (smartnfts.com) sales page for checkout. It does NO on-chain work — cover/title/price are cached values you
 * populate at curation time. (The on-chain buy logic lives in Phar Lap; the embeddable buy core arrives later
 * at "Option C / M3" — so there's no chain code here to become redundant.)
 *
 * Each card links to:  https://smartnfts.com/#c=<collectionId>&h=<sitePubKey>[&aff=<affRefCode>]
 * Buyers who open it replicate from the SITE's held copy → the site earns the reseller fee (no signing).
 */
const SMARTNFTS = 'https://smartnfts.com'
let CURRENT_CAT = null // active content-type category filter (null = all)
let TAG_QUERY = ''     // active hashtag filter (substring; set by the search box or a popular-tag chip)
// A shared short link redirects to /?n=<slug>, which spotlights that one NFT here (instead of bouncing straight
// to the slow checkout). The buy still happens on smartnfts.com — but only when the visitor clicks "Get a copy".
let FOCUS_SLUG = new URLSearchParams(location.search).get('n') || ''
let FOCUSED = null // the resolved spotlighted listing (or null when there's no /?n= or it doesn't match)
let FOCUS_SHARED = true // opened via a shared/direct ?n= link (true) vs a card click (false) — tweaks the badge
let CATALOG = null // the loaded listings, kept for back/forward (popstate) redraws

// Content-type categories — same taxonomy as Phar Lap's "My NFTs". Each listing's `category` key is written by
// the curator (from the NFT's on-chain content MIME); the chip row shows only categories that are present.
const CATS = [
  { key: 'image', label: 'Images', icon: '🖼️' },
  { key: 'audio', label: 'Audio', icon: '🎵' },
  { key: 'video', label: 'Video', icon: '🎬' },
  { key: 'document', label: 'Documents', icon: '📄' },
  { key: 'text', label: 'Text', icon: '📝' },
  { key: 'archive', label: 'Archives', icon: '🗜️' },
  { key: 'other', label: 'Other', icon: '🎴' }
]

function escapeHtml (s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function listingLink (collectionId, sitePubKey, affRefCode) {
  const aff = affRefCode ? `&aff=${encodeURIComponent(affRefCode)}` : ''
  // Pass THIS site's hostname so the smartnfts.com sales page can pull the cover/title/description from this
  // site's cache for an instant paint (works for any niche BigRed site — no per-site config).
  const src = (typeof location !== 'undefined' && location.hostname) ? `&src=${encodeURIComponent(location.hostname)}` : ''
  return `${SMARTNFTS}/#c=${encodeURIComponent(collectionId)}&h=${encodeURIComponent(sitePubKey)}${aff}${src}`
}

async function load () {
  const grid = document.getElementById('grid')
  let data
  try {
    const res = await fetch('listings.json', { cache: 'no-cache' })
    data = await res.json()
  } catch {
    grid.innerHTML = '<p class="empty">Couldn’t load listings.json.</p>'
    return
  }

  // "New to BSV?" on-ramp — SimpleSwap: swap any crypto — incl. stablecoins (USDT/USDC) — for BSV, delivered to your wallet.
  // Shown to everyone; carries the site's SimpleSwap referral code (data.affRefCode) when set, so swaps driven
  // from here earn a small commission. (Orange Gateway shut down; SimpleSwap is the replacement.)
  const fund = document.getElementById('fund')
  if (fund != null) {
    // Pre-select a ~0.001 BTC (≈ $60 of BSV) BTC → BSV swap so newcomers land ready to buy BSV (buyers can
    // switch the source coin — BTC/ETH/USDT are easy to find — and the amount). Without to=bsv-bsv they'd have
    // to scroll a huge coin list; without amount they'd get SimpleSwap's wild 0.1 BTC default.
    const ref = data.affRefCode ? 'ref=' + encodeURIComponent(data.affRefCode) + '&' : ''
    fund.querySelector('a').href = 'https://simpleswap.io/?' + ref + 'from=btc-btc&to=bsv-bsv&amount=0.001'
    fund.hidden = false
  }

  if (!data.sitePubKey || /^PASTE/i.test(data.sitePubKey)) {
    grid.innerHTML = '<p class="empty">Set <code>sitePubKey</code> in <code>listings.json</code> (the site’s cold public key), then add listings.</p>'
    return
  }

  // "Sell here" — a deep link that opens the wallet ready to onboard a copy to this site, plus the raw pubkey.
  const sell = document.getElementById('sell')
  if (sell) {
    document.getElementById('sellLink').href = SMARTNFTS + '/#list=' + encodeURIComponent(data.sitePubKey)
    document.getElementById('sellPub').textContent = data.sitePubKey
    const copyBtn = document.getElementById('sellCopy')
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(data.sitePubKey)
        const o = copyBtn.textContent; copyBtn.textContent = '✓ Copied'; setTimeout(() => { copyBtn.textContent = o }, 1500)
      } catch { window.prompt('Copy this address:', data.sitePubKey) }
    }
    sell.hidden = false
  }

  const items = Array.isArray(data.listings) ? data.listings : []
  if (items.length === 0) { grid.innerHTML = '<p class="empty">No listings yet — add entries to <code>listings.json</code>.</p>'; return }

  // Sort control (Most sold / Newest / Price). Re-renders within the current category on change.
  const sortbar = document.getElementById('sortbar')
  const sortSel = document.getElementById('sort')
  if (sortbar && sortSel) { sortbar.hidden = false; sortSel.onchange = () => render(data) }

  renderFocus(data) // must run before render(): sets FOCUSED so the grid can lead with tag-matches
  render(data)
}

/** Buyer's all-in cost (covenant fees + refundable bond), for price sorting. */
function priceOf (it) { return Number(it.priceSats || 0) + Number(it.bondSats || 0) }

/** Readable price: large amounts as BSV (0.485 BSV / 1.25 BSV, ≥ 0.01 BSV), small ones as whole sats. */
function fmtPrice (sats) {
  const s = Math.round(Number(sats) || 0)
  return s >= 1000000 ? (s / 1e8).toFixed(3).replace(/\.?0+$/, '') + ' BSV' : s.toLocaleString() + ' sats'
}

/** Sort listings in place by the active sort mode. "Most sold" leads with bestsellers, newest breaks ties. */
function sortListings (items) {
  const sel = document.getElementById('sort')
  const mode = sel ? sel.value : 'sold'
  const fns = {
    sold: (a, b) => (b.salesCount || 0) - (a.salesCount || 0) || (b.issuedAt || 0) - (a.issuedAt || 0),
    new: (a, b) => (b.issuedAt || 0) - (a.issuedAt || 0),
    'price-asc': (a, b) => priceOf(a) - priceOf(b),
    'price-desc': (a, b) => priceOf(b) - priceOf(a)
  }
  items.sort(fns[mode] || fns.sold)
}

/** Count listings per content-type category (only categories that actually occur). */
function catCounts (data) {
  const m = new Map()
  for (const it of data.listings || []) { const k = it.category || 'other'; m.set(k, (m.get(k) || 0) + 1) }
  return m
}

/** Render the category chip row (All + one chip per present category, in CATS order). Hidden unless ≥2
 *  categories exist — a single-category catalog needs no category filter. */
function renderCats (data) {
  const bar = document.getElementById('cats')
  if (bar == null) return
  const counts = catCounts(data)
  const present = CATS.filter(c => counts.get(c.key))
  if (present.length < 2) { bar.innerHTML = ''; return }
  const total = (data.listings || []).length
  const chip = (label, key, n) => `<button class="chip${key === CURRENT_CAT ? ' active' : ''}" data-cat="${escapeHtml(key ?? '')}">${escapeHtml(label)}<span class="n">${n}</span></button>`
  bar.innerHTML = chip('All', null, total) + present.map(c => chip(`${c.icon} ${c.label}`, c.key, counts.get(c.key))).join('')
  bar.querySelectorAll('.chip').forEach(b => { b.onclick = () => { CURRENT_CAT = b.dataset.cat || null; render(data) } })
}

/** Count listings per hashtag → drives the "popular hashtags" list (most-used first). */
function tagCounts (data) {
  const m = new Map()
  for (const it of data.listings || []) for (const t of it.tags || []) m.set(t, (m.get(t) || 0) + 1)
  return m
}

/** Render the hashtag search box + a short "popular hashtags" chip list. Hidden when no listing has tags. */
const POPULAR_TAGS = 10
function renderTagbar (data) {
  const bar = document.getElementById('tagbar')
  const pop = document.getElementById('poptags')
  const search = document.getElementById('tagSearch')
  if (bar == null || pop == null) return
  const counts = tagCounts(data)
  if (counts.size === 0) { bar.hidden = true; return }
  bar.hidden = false
  const popular = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, POPULAR_TAGS).map(([t]) => t)
  const active = TAG_QUERY.toLowerCase()
  const chip = t => `<button class="chip${active && t.toLowerCase() === active ? ' active' : ''}" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`
  pop.innerHTML = popular.map(chip).join('')
  pop.querySelectorAll('.chip').forEach(b => { b.onclick = () => setTagQuery(data, b.dataset.tag) })
  if (search && !search.dataset.wired) { search.dataset.wired = '1'; search.oninput = () => setTagQuery(data, search.value.trim(), true) }
}

/** Set the active hashtag filter (from a chip or the search box) and re-render. `fromSearch` avoids
 *  clobbering the text the user is actively typing into the box. */
function setTagQuery (data, q, fromSearch) {
  TAG_QUERY = q || ''
  const search = document.getElementById('tagSearch')
  if (search && !fromSearch) search.value = TAG_QUERY
  render(data)
}

/** Human filename for a downloaded preview — the listing title ("Artist - Track.mp3") instead of the
 *  content-addressed clip url (clips/<id>.<txid>.mp3). Strips characters illegal in filenames. */
function previewDownloadName (it) {
  const raw = (String(it.previewClip || '').split('.').pop() || 'mp3').toLowerCase()
  const ext = ['mp3', 'm4a'].includes(raw) ? raw : 'mp3'
  const base = (it.title || 'preview').replace(/[\/\\:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'preview'
  return `${base}.${ext}`
}

// ── Mockup mix-and-match: composite a design onto a prop, in the browser, via the shared MockupRender ──────────
/** Load an image as a Promise. */
function loadImg (src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img ' + src)); i.src = src }) }

/** Find a listing by collection id (catalog list, or the current spotlighted hero). */
function findListing (data, id) {
  return (data.listings || []).find(l => l.collectionId === id) || (FOCUSED && FOCUSED.collectionId === id ? FOCUSED : null)
}

/** Composite a design onto a prop base on a <canvas> via MockupRender. `m` = a listing.mockup, or a swap override
 *  { clean, base, place, warp, fabric } when the shopper picks a different prop. Falls back to the flat cover. */
async function compositeMockup (canvas, m) {
  const R = window.MockupRender
  if (!R || !m || !m.base || !m.clean) return fallbackCover(canvas)
  try {
    const [base, design] = await Promise.all([loadImg(m.base), loadImg(m.clean)])
    const W = base.naturalWidth || base.width, H = base.naturalHeight || base.height
    canvas.width = W; canvas.height = H
    const p = m.place || { x: 0.5, y: 0.5, scale: 1, rot: 0, skewX: 0, skewY: 0 }
    const dAsp = (design.naturalWidth || design.width) / (design.naturalHeight || design.height)
    const box = { cx: p.x * W, cy: p.y * H, w: p.scale * W, h: (p.scale * W) / dAsp, rot: p.rot || 0, skewX: p.skewX || 0, skewY: p.skewY || 0 }
    R.renderCover(canvas.getContext('2d'), { base, design, maps: {}, stageW: W, stageH: H, dpr: 1, box, warp: m.warp || [], fabric: m.fabric == null ? 0.8 : m.fabric })
    canvas.classList.add('ready')
  } catch { fallbackCover(canvas) }
}

/** A failed composite (missing renderer / prop image) degrades to the flat watermarked cover (data-cover). */
function fallbackCover (canvas) {
  const src = canvas.dataset.cover
  if (src) { const img = new Image(); img.loading = 'lazy'; img.src = src; img.alt = ''; canvas.replaceWith(img) } else canvas.remove()
}

/** Composite every not-yet-done mockup canvas in a container (idempotent — skips ready/in-flight ones). */
function compositeMockups (root, data) {
  root.querySelectorAll('canvas.cover-cv:not(.ready):not(.pending)').forEach(cv => {
    const card = cv.closest('.card'); if (!card) return
    const it = findListing(data, card.dataset.collection)
    if (!it || !it.mockup) { fallbackCover(cv); return }
    cv.classList.add('pending')
    compositeMockup(cv, it.mockup)
  })
}

// ── Prop switcher (mix-and-match on the spotlight) ────────────────────────────────────────────────────────────
let PROPS = null // props.json cache (every self-describing prop the curator resolved), loaded once
async function loadProps () {
  if (PROPS) return PROPS
  try { const j = await (await fetch('props.json', { cache: 'no-cache' })).json(); PROPS = Array.isArray(j.props) ? j.props : [] } catch { PROPS = [] }
  return PROPS
}

/** On a mockup listing's spotlight, offer every prop matching the design's ratio as a swatch; tapping one
 *  re-composites the hero cover live (same design, swapped prop). Hidden when fewer than 2 props share the ratio. */
async function addPropSwitcher (host, it) {
  if (!it || !it.mockup || !window.MockupRender) return
  const hero = host.querySelector('canvas.cover-cv'); if (!hero) return
  const props = (await loadProps()).filter(p => p.ratio === it.mockup.ratio && p.base)
  if (props.length < 2) return // nothing to switch between yet
  const swap = p => ({ clean: it.mockup.clean, base: p.base, place: p.place, warp: p.warp, fabric: p.fabric })
  const bar = document.createElement('div'); bar.className = 'prop-switcher'
  bar.innerHTML = '<span class="prop-switcher-label">See it on…</span>'
  const row = document.createElement('div'); row.className = 'prop-swatches'
  for (const p of props) {
    const sw = document.createElement('button'); sw.type = 'button'; sw.className = 'prop-swatch'
    if (p.name) sw.title = p.name
    if (p.txid === it.mockup.prop) sw.classList.add('active')
    const cv = document.createElement('canvas'); cv.className = 'prop-swatch-cv'; sw.appendChild(cv)
    sw.onclick = () => {
      row.querySelectorAll('.prop-swatch').forEach(s => s.classList.remove('active')); sw.classList.add('active')
      compositeMockup(hero, swap(p)) // re-render the big cover with the chosen prop
    }
    row.appendChild(sw)
    compositeMockup(cv, swap(p)) // the swatch previews the design on that prop
  }
  bar.appendChild(row)
  const coverBox = host.querySelector('.card .cover-box')
  if (coverBox) coverBox.after(bar)
}

/** Render the catalog, optionally filtered to a single tag. */
function buildCard (it, data) {
  const link = listingLink(it.collectionId, data.sitePubKey, data.affRefCode)
  // Clicking the cover/title opens the on-site spotlight (full sales note) rather than jumping to checkout; the
  // href is a real /?n= url (so open-in-new-tab / share still work), intercepted for an in-place open.
  const openKey = it.slug || it.collectionId
  const openHref = '/?n=' + encodeURIComponent(openKey)
  // Real cost to a buyer = the covenant fees + the refundable bond locked into their own copy, + network fee.
  const fees = Number(it.priceSats || 0)
  const bond = Number(it.bondSats || 0)
  const sub = (bond > 1 ? `incl. ${fmtPrice(bond)} refundable bond · ` : '') + '+ network fee'
  const priceHtml = it.priceSats != null
    ? `<span class="price" title="${(fees + bond).toLocaleString()} sats">${fmtPrice(fees + bond)}<span class="sub">${sub}</span></span>`
    : '<span></span>'
  const tags = (it.tags || []).map(t => `<button class="tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('')
  // Validated-genesis badge: the curator verified this descends from its genesis mint and recorded the issue
  // date (genesis block time). Links to the genesis tx on WhatsOnChain so anyone can check it independently.
  const genesisId = it.genesisTxid || it.collectionId
  const issued = it.issuedAt ? new Date(it.issuedAt * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''
  const genesisHtml = it.genesisTxid
    ? `<a class="genesis" href="https://whatsonchain.com/tx/${encodeURIComponent(genesisId)}" target="_blank" rel="noopener" title="Genesis mint verified at listing — view it on WhatsOnChain">✓ Genesis${issued ? ' · issued ' + escapeHtml(issued) : ''} ↗</a>`
    : ''
  // Social proof: copies sold through nft.sale (curator counts replicates sourced from the site wallet).
  const sold = Number(it.salesCount || 0)
  const soldHtml = sold > 0 ? `<span class="sold" title="Copies sold through nft.sale">🔥 ${sold.toLocaleString()} sold</span>` : ''
  // Short, pasteable share link (nft.sale/r/<slug>). Falls back to the full link until the curator has run.
  const shortUrl = it.slug ? `${location.origin}/r/${it.slug}` : link
  const card = document.createElement('article')
  card.className = 'card'
  card.dataset.collection = it.collectionId
  // A mockup listing paints its cover as a live canvas COMPOSITE (clean design × prop, in the browser). The flat
  // watermarked `it.cover` stays as the data fallback (used if the renderer/canvas fails). Non-mockups: plain img.
  const coverEl = it.mockup
    ? `<canvas class="cover-cv" data-cover="${escapeHtml(it.cover || '')}"></canvas>`
    : (it.cover ? `<img loading="lazy" src="${escapeHtml(it.cover)}" alt="${escapeHtml(it.title || '')}" onerror="this.remove()">` : '')
  card.innerHTML =
    `<div class="cover-box${it.backCover ? ' has-back' : ''}">` +
      `<div class="cover-inner">` +
        `<a class="cover cover-front" href="${openHref}" data-open="${escapeHtml(openKey)}">` +
          coverEl +
        `</a>` +
        (it.backCover ? `<div class="cover-back"><img class="cover-back-img" data-src="${escapeHtml(it.backCover)}" alt="" /></div>` : '') +
      `</div>` +
      (it.backCover ? `<button class="cover-flip" type="button" title="Flip cover" aria-label="Flip cover">⟲</button>` : '') +
    `</div>` +
    `<div class="body">` +
      (it.previewClip ? `<div class="preview" data-clip="${escapeHtml(it.previewClip)}" data-dl="${escapeHtml(previewDownloadName(it))}"><button class="preview-btn" type="button">🎧 Preview</button></div>` : '') +
      `<h2 class="card-title"><a href="${openHref}" data-open="${escapeHtml(openKey)}">${escapeHtml(it.title || 'Untitled')}</a></h2>` +
      (it.description ? `<p class="desc">${escapeHtml(it.description)}</p>` : '') +
      (tags ? `<div class="tags">${tags}</div>` : '') +
      (genesisHtml || soldHtml ? `<div class="badges">${genesisHtml}${soldHtml}</div>` : '') +
      `<div class="row">` +
        priceHtml +
        `<a class="buy" href="${link}" target="_blank" rel="noopener">Get a copy ↗</a>` +
      `</div>` +
      `<button class="copylink" data-url="${escapeHtml(shortUrl)}">🔗 Copy share link</button>` +
    `</div>`
  return card
}

// Wire the interactive bits on the cards now in the grid (idempotent — onclick assignment overwrites).
function wireCards (grid, data) {
  grid.querySelectorAll('.tag').forEach(b => { b.onclick = () => setTagQuery(data, b.dataset.tag) }) // tap a card tag to filter
  // Cover / title → open the on-site spotlight in place (full sales note), instead of jumping to checkout. The
  // href stays a real /?n= url, so Ctrl/⌘-click or middle-click still open it in a new tab.
  grid.querySelectorAll('[data-open]').forEach(el => {
    el.onclick = e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return // let new-tab clicks through
      e.preventDefault()
      openFocus(data, el.dataset.open)
    }
  })
  grid.querySelectorAll('.copylink').forEach(b => {
    b.onclick = async () => {
      const url = b.dataset.url
      try {
        await navigator.clipboard.writeText(url)
        const orig = b.textContent; b.textContent = '✓ Copied!'; b.classList.add('ok')
        setTimeout(() => { b.textContent = orig; b.classList.remove('ok') }, 1500)
      } catch { window.prompt('Copy this link:', url) }
    }
  })
  // Cover flip: an animated 3D flip toggled by the .flipped class — the rotation gives instant feedback while
  // the (large) back image downloads. The back image is lazy-loaded on the first flip.
  grid.querySelectorAll('.cover-flip').forEach(b => {
    const box = b.closest('.cover-box')
    if (!box) return
    const backImg = box.querySelector('.cover-back-img')
    b.onclick = () => {
      if (backImg && !backImg.getAttribute('src') && backImg.dataset.src) backImg.src = backImg.dataset.src
      box.classList.toggle('flipped')
    }
  })
  // Lazy audio preview: the clip only downloads when a shopper hits play (never preloaded across the catalog).
  grid.querySelectorAll('.preview-btn').forEach(b => {
    b.onclick = () => {
      const wrap = b.closest('.preview'); if (!wrap) return
      const audio = document.createElement('audio')
      audio.controls = true; audio.autoplay = true; audio.className = 'preview-audio'
      audio.setAttribute('controlsList', 'nodownload') // hide the native download — it uses the ugly clip-id url
      audio.src = wrap.dataset.clip
      // Our own download link so the file saves as the listing title ("Artist - Track.mp3"), not the id. The
      // clip is same-origin, so the download attribute's filename is honoured.
      const dl = document.createElement('a')
      dl.className = 'preview-dl'; dl.href = wrap.dataset.clip; dl.download = wrap.dataset.dl || ''
      dl.textContent = '⬇ Download'; dl.title = 'Download the preview clip'
      wrap.replaceChildren(audio, dl)
    }
  })
  // Paint mockup covers as live browser composites (design × prop). Idempotent across lazy-scroll batches.
  compositeMockups(grid, data)
}

/** How many of `it`'s tags are in the spotlighted NFT's tag set — drives "more like this" ordering. */
function sharedTags (it, tagSet) { let n = 0; for (const t of it.tags || []) if (tagSet.has(t.toLowerCase())) n++; return n }

/** Spotlight the shared NFT (from /?n=<slug>) as a large highlighted hero above the catalog. Reuses buildCard
 *  (so flip / preview / copy-link / Get-a-copy all work) but renders it large with the full, unclamped
 *  description. Rendered once per page load; the grid below re-renders freely on filter/sort without disturbing
 *  it. A "Browse all" button dismisses the spotlight and clears the ?n= param. */
function renderFocus (data) {
  const main = document.querySelector('main')
  const existing = document.getElementById('focus')
  FOCUSED = FOCUS_SLUG
    ? (data.listings || []).find(it => it.slug === FOCUS_SLUG || it.collectionId === FOCUS_SLUG || (it.collectionId || '').slice(0, 8) === FOCUS_SLUG)
    : null
  if (!FOCUSED) { if (existing) existing.remove(); return } // stale/absent link → just show the full catalog
  const host = existing || document.createElement('section')
  host.id = 'focus'; host.className = 'focus'
  if (!existing) main.insertBefore(host, main.firstChild) // very top of the content area
  host.innerHTML = `<div class="focus-head"><span class="focus-badge">${FOCUS_SHARED ? '★ Shared with you' : '★ Now viewing'}</span>` +
    '<button class="focus-close" type="button">✕ Browse all listings</button></div>'
  host.appendChild(buildCard(FOCUSED, data))
  wireCards(host, data)
  if (FOCUSED.mockup) addPropSwitcher(host, FOCUSED) // mix-and-match: swap the prop under the design
  host.querySelector('.focus-close').onclick = () => {
    FOCUS_SLUG = ''; FOCUSED = null
    history.replaceState(null, '', location.pathname + location.hash) // drop ?n= so a refresh shows everything
    host.remove()
    render(data)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Open a listing's on-site spotlight in place (from a card click). A real /?n= url is pushed so Back returns to
// the grid; buying still happens on smartnfts.com via the spotlight's "Get a copy".
function openFocus (data, key) {
  if (!key) return
  FOCUS_SLUG = key; FOCUS_SHARED = false
  history.pushState({ n: key }, '', '/?n=' + encodeURIComponent(key))
  renderFocus(data)
  render(data)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Endless scroll: render the catalog in batches, adding more as a sentinel scrolls into view (à la IG/TikTok).
const SCROLL_BATCH = 12
let scrollObs = null
function render (data) {
  CATALOG = data // keep a handle for back/forward redraws
  renderCats(data)
  renderTagbar(data)
  const grid = document.getElementById('grid')
  const q = TAG_QUERY.toLowerCase()
  let items = (data.listings || []).filter(it =>
    (CURRENT_CAT == null || (it.category || 'other') === CURRENT_CAT) &&
    (q === '' || (it.tags || []).some(t => t.toLowerCase().includes(q)))
  )
  if (FOCUSED) {
    // Spotlight is up: drop the shared NFT from the grid and lead with listings that share its tags
    // ("more like this"), then the rest of the catalog. Stable sort keeps the base order within each tier.
    const ftags = new Set((FOCUSED.tags || []).map(t => t.toLowerCase()))
    items = items.filter(it => it !== FOCUSED)
    sortListings(items)
    items.sort((a, b) => sharedTags(b, ftags) - sharedTags(a, ftags))
  } else {
    sortListings(items)
  }
  if (scrollObs) { scrollObs.disconnect(); scrollObs = null }
  document.querySelectorAll('.scroll-sentinel').forEach(s => s.remove())
  if (items.length === 0) { grid.innerHTML = '<p class="empty">Nothing matches — try clearing the filters.</p>'; return }
  grid.innerHTML = ''

  const sentinel = document.createElement('div')
  sentinel.className = 'scroll-sentinel'
  grid.after(sentinel)
  let shown = 0
  const showMore = () => {
    const frag = document.createDocumentFragment()
    for (const it of items.slice(shown, shown + SCROLL_BATCH)) frag.appendChild(buildCard(it, data))
    grid.appendChild(frag)
    shown = Math.min(shown + SCROLL_BATCH, items.length)
    wireCards(grid, data)
    if (shown >= items.length) { if (scrollObs) { scrollObs.disconnect(); scrollObs = null } sentinel.remove() }
  }
  showMore()
  if (shown < items.length) {
    scrollObs = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) showMore() }, { rootMargin: '800px' })
    scrollObs.observe(sentinel)
  }
}

/* Theme layer — apply the site's identity from brand.json (colours + all header/footer text), so a niche BigRed
 * fork is a one-file re-theme. The HTML carries the flagship values as a no-JS/crawler fallback; this overrides
 * them. The per-host <head> <title>/<meta> (crawlers don't run JS) is handled server-side in index.php. */
async function applyBrand () {
  let b
  // Same deployment serves nft.sale and its mirror NFTsale.com; pick the brand config by hostname.
  const brandFile = location.hostname.includes('nftsale.com') ? 'brand.nftsale.json' : 'brand.json'
  try { b = await (await fetch(brandFile, { cache: 'no-cache' })).json() } catch { return } // keep the HTML fallback
  if (b.colors) { const s = document.documentElement.style; for (const k in b.colors) s.setProperty('--' + k, b.colors[k]) }
  const set = (sel, html) => { const el = document.querySelector(sel); if (el != null && html != null) el.innerHTML = html }
  const brand = document.querySelector('.brand')
  if (brand && b.wordmark != null) {
    brand.innerHTML = '<img class="brand-horse" src="brand/favicon.svg" alt="" />' + (b.lightning ? '⚡ ' : '') + b.wordmark
  }
  set('.tagline', b.tagline)
  set('.howto', b.howto)
  set('.sell h2', b.sellHeading)
  set('#sellText', b.sellText)
  const fl = document.querySelectorAll('.site-foot .flavour')
  if (Array.isArray(b.footer)) b.footer.forEach((t, i) => { if (fl[i] && t != null) fl[i].innerHTML = t })
}

// Back/forward between the grid and a spotlight (?n=) — resync the view from the URL.
window.addEventListener('popstate', () => {
  if (!CATALOG) return
  FOCUS_SLUG = new URLSearchParams(location.search).get('n') || ''; FOCUS_SHARED = false
  renderFocus(CATALOG)
  render(CATALOG)
  window.scrollTo({ top: 0 })
})

applyBrand()
load()
