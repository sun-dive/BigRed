<?php
  // Host-aware <head>: one deployment serves nft.sale and its mirror NFTsale.com. Crawlers don't run JS, so the
  // per-domain title + social image are branched here (the visible page is themed client-side by app.js from
  // brand.json / brand.nftsale.json). Everything below <body> is identical for both hosts.
  $host    = $_SERVER['HTTP_HOST'] ?? 'nft.sale';
  $nftsale = strpos($host, 'nftsale.com') !== false;
  $name    = $nftsale ? 'NFTsale.com' : 'nft.sale';
  $base    = $nftsale ? 'https://nftsale.com' : 'https://nft.sale';
  $title   = $nftsale ? 'NFTsale.com — Buy it. Own it. Resell it.' : 'nft.sale — the SMART NFT sales ring';
  $desc    = $nftsale
    ? 'Real digital ownership on-chain: buy a copy, keep it, resell it — the creator is paid every time.'
    : 'Buy your own copy of curated SMART NFT editions in one click, on-chain — no account, no middleman.';
  $img     = $base . ($nftsale ? '/brand/og-banner-nftsale.jpg' : '/brand/og-banner.jpg');
  $e = function ($s) { return htmlspecialchars($s, ENT_QUOTES); };
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title><?= $e($title) ?></title>
  <meta name="description" content="<?= $e($desc) ?>" />
  <link rel="icon" type="image/svg+xml" href="brand/favicon.svg" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="<?= $e($name) ?>" />
  <meta property="og:title" content="<?= $e($title) ?>" />
  <meta property="og:description" content="<?= $e($desc) ?>" />
  <meta property="og:url" content="<?= $e($base) ?>/" />
  <meta property="og:image" content="<?= $e($img) ?>" />
  <meta property="og:image:width" content="1344" />
  <meta property="og:image:height" content="768" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="<?= $e($title) ?>" />
  <meta name="twitter:description" content="<?= $e($desc) ?>" />
  <meta name="twitter:image" content="<?= $e($img) ?>" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="site-head">
    <h1 class="brand"><img class="brand-horse" src="brand/favicon.svg" alt="" />⚡ nft.sale</h1>
    <p class="tagline">Buy with <b>1 click</b>, <b>Instant delivery!</b></p>
    <p class="howto">Browse curated Smart NFT editions, then mint your own copy, on-chain — no account, no middleman.</p>
    <p class="fund" id="fund" hidden>New to BSV? <a target="_blank" rel="noopener">Get a little and start shopping →</a></p>
  </header>

  <main>
    <nav id="cats" class="cats" aria-label="Categories"></nav>
    <div class="tagbar" id="tagbar" hidden>
      <input id="tagSearch" class="tag-search" type="search" placeholder="🔎  Search hashtags…" autocomplete="off" aria-label="Search hashtags" />
      <nav id="poptags" class="poptags" aria-label="Popular hashtags"></nav>
    </div>
    <div class="sortbar" id="sortbar" hidden>
      <label for="sort">Sort</label>
      <select id="sort">
        <option value="sold">🔥 Most sold</option>
        <option value="new">🆕 Newest</option>
        <option value="price-asc">Price: low → high</option>
        <option value="price-desc">Price: high → low</option>
      </select>
    </div>
    <section id="grid" class="grid"><p class="empty">Loading listings…</p></section>
  </main>

  <section class="sell" id="sell" hidden>
    <h2>Got a SMART NFT? Sell it here.</h2>
    <p id="sellText">List your edition for one-click resale on nft.sale — you keep earning your publisher fee on every sale.</p>
    <a class="sell-cta" id="sellLink" target="_blank" rel="noopener">📤 List your NFT here →</a>
    <p class="sell-key">Opens your wallet ready to send a copy here. Or paste this address into <b>Onboard partner</b> yourself:<br>
      <code id="sellPub"></code> <button id="sellCopy" class="sell-copy">Copy</button></p>
  </section>

  <footer class="site-foot">
    <a href="https://whatsonchain.com" target="_blank" rel="noopener" aria-label="Powered by WhatsOnChain">
      <img src="brand/powered-by-whatsonchain-white.svg" alt="Powered by WhatsOnChain" class="woc-badge" />
    </a>
    <a class="bb-badge" href="https://bananablocks.com" target="_blank" rel="noopener" aria-label="Powered by BananaBlocks">Powered by <img src="brand/bananablocks-logo.png" alt="" class="bb-logo" /> <span class="bb-word">BananaBlocks</span></a>
    <p>Checkout is powered by <a href="https://smartnfts.com" target="_blank" rel="noopener">SMART NFTs</a> on the Bitcoin SV blockchain.</p>
    <p class="flavour"><b>BIGRED</b> — <b>B</b>uy <b>I</b>nstantly <b>G</b>enuine <b>R</b>esellable <b>E</b>dition <b>D</b>rops</p>
    <p class="flavour">🐎 after the champion, Phar Lap.</p>
  </footer>

  <script src="app.js"></script>
</body>
</html>
