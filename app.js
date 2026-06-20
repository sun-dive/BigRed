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

  // "New to BSV?" fund-up link — Orange Gateway signup carrying the site's referral code, so unfunded
  // visitors can get a little BSV (and the site earns the signup referral).
  const fund = document.getElementById('fund')
  if (fund != null && data.affRefCode) {
    fund.querySelector('a').href = 'https://exchange.orangegateway.com/signup?ref-code=' + encodeURIComponent(data.affRefCode)
    fund.hidden = false
  }

  if (!data.sitePubKey || /^PASTE/i.test(data.sitePubKey)) {
    grid.innerHTML = '<p class="empty">Set <code>sitePubKey</code> in <code>listings.json</code> (the site’s cold public key), then add listings.</p>'
    return
  }
  const items = Array.isArray(data.listings) ? data.listings : []
  if (items.length === 0) { grid.innerHTML = '<p class="empty">No listings yet — add entries to <code>listings.json</code>.</p>'; return }

  render(data, null) // null = no tag filter (show all)
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
function render (data, activeTag) {
  renderFilters(data, activeTag)
  const grid = document.getElementById('grid')
  const items = (data.listings || []).filter(it => activeTag == null || (it.tags || []).includes(activeTag))
  if (items.length === 0) { grid.innerHTML = '<p class="empty">Nothing in that category yet.</p>'; return }
  grid.innerHTML = ''
  for (const it of items) {
    const link = listingLink(it.collectionId, data.sitePubKey, data.affRefCode)
    const price = it.priceSats != null ? `${Number(it.priceSats).toLocaleString()} sats` : ''
    const tags = (it.tags || []).map(t => `<button class="tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('')
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
        `<div class="row">` +
          (price ? `<span class="price">${price}<span class="sub"> + network fee</span></span>` : '<span></span>') +
          `<a class="buy" href="${link}" target="_blank" rel="noopener">Get a copy ↗</a>` +
        `</div>` +
      `</div>`
    grid.appendChild(card)
  }
  grid.querySelectorAll('.tag').forEach(b => { b.onclick = () => render(data, b.dataset.tag) }) // tap a card's tag to filter
}

load()
