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
  return `${SMARTNFTS}/#c=${encodeURIComponent(collectionId)}&h=${encodeURIComponent(sitePubKey)}${aff}`
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

  render(data)
}

/** Buyer's all-in cost (covenant fees + refundable bond), for price sorting. */
function priceOf (it) { return Number(it.priceSats || 0) + Number(it.bondSats || 0) }

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

/** Render the catalog, optionally filtered to a single tag. */
function buildCard (it, data) {
  const link = listingLink(it.collectionId, data.sitePubKey, data.affRefCode)
  // Real cost to a buyer = the covenant fees + the refundable bond locked into their own copy, + network fee.
  const fees = Number(it.priceSats || 0)
  const bond = Number(it.bondSats || 0)
  const sub = (bond > 1 ? `incl. ${bond.toLocaleString()} refundable bond · ` : '') + '+ network fee'
  const priceHtml = it.priceSats != null
    ? `<span class="price">${(fees + bond).toLocaleString()} sats<span class="sub">${sub}</span></span>`
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
  card.innerHTML =
    `<a class="cover" href="${link}" target="_blank" rel="noopener">` +
      (it.cover ? `<img loading="lazy" src="${escapeHtml(it.cover)}" alt="${escapeHtml(it.title || '')}" onerror="this.remove()">` : '') +
    `</a>` +
    `<div class="body">` +
      `<h2>${escapeHtml(it.title || 'Untitled')}</h2>` +
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
}

// Endless scroll: render the catalog in batches, adding more as a sentinel scrolls into view (à la IG/TikTok).
const SCROLL_BATCH = 12
let scrollObs = null
function render (data) {
  renderCats(data)
  renderTagbar(data)
  const grid = document.getElementById('grid')
  const q = TAG_QUERY.toLowerCase()
  const items = (data.listings || []).filter(it =>
    (CURRENT_CAT == null || (it.category || 'other') === CURRENT_CAT) &&
    (q === '' || (it.tags || []).some(t => t.toLowerCase().includes(q)))
  )
  sortListings(items)
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
 * them. Head <title>/<meta> stay static in index.html (crawlers don't run JS — edit those per fork for social). */
async function applyBrand () {
  let b
  try { b = await (await fetch('brand.json', { cache: 'no-cache' })).json() } catch { return } // keep the HTML fallback
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

applyBrand()
load()
