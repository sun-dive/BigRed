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
let CURRENT_TAG = null // remembered so the sort control can re-render within the active category

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

  // "New to BSV?" on-ramp — SimpleSwap: swap any crypto for BSV (or buy with card), delivered to your wallet.
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
  if (sortbar && sortSel) { sortbar.hidden = false; sortSel.onchange = () => render(data, CURRENT_TAG) }

  render(data, null) // null = no tag filter (show all)
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

/** All distinct tags across listings (sorted) — drives the filter bar. */
function allTags (data) {
  return [...new Set((data.listings || []).flatMap(it => it.tags || []))].sort()
}

/** Render the category filter chips (All + one per tag). Hidden when no listing has tags. */
function renderFilters (data, activeTag) {
  const bar = document.getElementById('filters')
  if (bar == null) return
  const tags = allTags(data)
  if (tags.length === 0) { bar.innerHTML = ''; return }
  const chip = (label, tag) => `<button class="chip${tag === activeTag ? ' active' : ''}" data-tag="${escapeHtml(tag ?? '')}">${escapeHtml(label)}</button>`
  bar.innerHTML = chip('All', null) + tags.map(t => chip('#' + t, t)).join('')
  bar.querySelectorAll('.chip').forEach(b => { b.onclick = () => render(data, b.dataset.tag || null) })
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
  grid.querySelectorAll('.tag').forEach(b => { b.onclick = () => render(data, b.dataset.tag) }) // tap a tag to filter
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
function render (data, activeTag) {
  CURRENT_TAG = activeTag
  renderFilters(data, activeTag)
  const grid = document.getElementById('grid')
  const items = (data.listings || []).filter(it => activeTag == null || (it.tags || []).includes(activeTag))
  sortListings(items)
  if (scrollObs) { scrollObs.disconnect(); scrollObs = null }
  document.querySelectorAll('.scroll-sentinel').forEach(s => s.remove())
  if (items.length === 0) { grid.innerHTML = '<p class="empty">Nothing in that category yet.</p>'; return }
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

load()
