/* Capsule Builder — "View your capsule" page (v1.6.0).
   Buyer-facing, read-only. The capsule travels inside the link, nothing is stored anywhere:
     ?l=RF|OIYK  &i=SKU:pieces,SKU:pieces,...  &a=<number of buyer's picks at the front of i>
     &u=r (reorder)  &st=<store>  &n=<capsule name>  &p=1 (show wholesale prices)  &rep=<rep code>  &cap=<capsule ID>
   Shown on onlyifyouknow.com/pages/capsule (unlisted, noindex), which passes the link through to this page. */
(function () {
  "use strict";
  const BASE = window.CAPSULE_CONFIG;
  const { Engine, CATS, label } = window.CapsuleEngine;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (v) => "$" + (v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money0 = (v) => "$" + Math.round(v || 0).toLocaleString("en-US");
  const CAT_LABEL = { necklace: "Necklaces", bracelet: "Bracelets", earring: "Earrings" };

  const P = new URLSearchParams(location.search);
  const L = String(P.get("l") || "").toUpperCase();
  const src = { RF: window.CATALOG_RF, OIYK: window.CATALOG_OIYK }[L];
  function fail(msg) {
    $("app").innerHTML = `<div class="empty"><b>This capsule link didn't open.</b>${esc(msg)}<br><br>Call or text 917-830-7220 and we'll resend it.</div>`;
  }
  if (!src) { fail("The link is incomplete or was cut off in the email."); return; }

  const cfg = Object.assign({}, BASE, BASE.lines[L]);
  const op = (window.ORDER_PAGE || {})[L];
  if (cfg.orderPage && op) cfg.orderPage = Object.assign({}, cfg.orderPage, { skus: op.skus });
  const engine = new Engine({ items: src.items, flags: [] }, cfg);
  const clean = (v, re, n) => { v = String(v || "").trim().slice(0, n); return re.test(v) ? v : ""; };
  const rep = clean(P.get("rep"), /^[A-Za-z0-9-]+$/, 20).toUpperCase();
  const cap = clean(P.get("cap"), /^[A-Za-z0-9-]+$/, 24);
  const reorder = P.get("u") === "r";
  const showPrices = P.get("p") === "1";
  const store = String(P.get("st") || "").trim().slice(0, 80);
  const title = String(P.get("n") || "").trim().slice(0, 90) || (store ? `Curated for ${store}` : "Your curated capsule");

  // the pieces and quantities from the link; unknown SKUs are listed, never guessed
  const lines = [], gone = [];
  String(P.get("i") || "").split(",").forEach((t) => {
    const b = t.split(":"), sku = String(b[0] || "").trim().toUpperCase(), q = Math.max(0, Math.min(999, Math.round(+b[1] || 0)));
    if (!sku) return;
    const it = engine.bySku.get(sku);
    if (!it) { gone.push(sku); return; }
    if (!lines.some((x) => x.it.sku === sku)) lines.push({ it, q: q || engine.unitsFor(it, reorder ? "reorder" : "first") });
  });
  if (!lines.length) { fail("None of the styles in the link are in our current catalog."); return; }
  const nA = Math.max(1, Math.min(2, lines.length, parseInt(P.get("a"), 10) || 1));
  const anchors = lines.slice(0, nA).map((x) => x.it);
  const H = engine.halfTerms();
  const halves = new Set(H ? lines.filter((x) => x.q === H.units).map((x) => x.it.sku) : []);
  engine.halfSet = halves;
  const restored = engine.restore(anchors.map((a) => a.sku), lines.slice(nA).map((x) => x.it.sku), { minQty: cfg.minQty });
  // the engine's reasons say "the anchor"; buyers read "your pick"
  const buyerWords = (r) => String(r || "").replace(/\bthe anchor (necklace|bracelet|earrings|earring)\b/g, "your $1").replace(/\bthe anchor's\b/g, "your pick's").replace(/\bthe anchor\b/g, "your pick").replace(/the buyer's two picks/g, "your two picks").replace(/the buyer's pick/g, "your pick");
  const reasonOf = new Map(restored.picks.map((p) => [p.item.sku, buyerWords(p.reason)]));
  const qtyWord = (n) => (H ? (n === 6 ? "½ dozen" : n % 12 === 0 ? `${n / 12} dozen` : `${n} pcs`) : n % 12 === 0 ? `${n / 12} dozen (${n} pcs)` : `${n} pcs`);

  // order link: same format as the builder's (RF page takes dozens, OIYK pieces), with the rep code and capsule ID
  function orderLink() {
    const o = cfg.orderPage;
    if (!o) return null;
    const listed = new Set(o.skus || []);
    const parts = lines.filter((x) => !o.skus || listed.has(x.it.sku.toUpperCase())).map((x) => `${encodeURIComponent(x.it.sku)}:${o.qtyIn === "pieces" ? x.q : Math.round((x.q / 12) * 2) / 2}`);
    let url = `${o.url}?cart=${parts.join(",")}`;
    if (reorder) url += "&reorder=1";
    if (store) url += `&store=${encodeURIComponent(store)}`;
    if (rep) url += `&rep=${encodeURIComponent(rep)}`;
    if (cap) url += `&cap=${encodeURIComponent(cap)}`;
    return url;
  }

  // terms, as on the line sheet
  const t = cfg.terms || {};
  const terms = [
    ["Minimum", t.orderMinimum ? `${money0(t.orderMinimum)} on a first order` : ""],
    ["Quantities", reorder ? `Reorder: ${engine.reorderUnits()} pieces per style.` : t.unitsNote],
    ["Pricing", showPrices && t.tiered ? t.tierNote : ""],
    ["Payment", t.paymentTerms], ["Shipping", t.shipping], ["Returns", t.returns], ["Retail", t.retailNote],
  ].filter((r) => r[1]);

  // totals
  let tot = 0, retail = 0, pcs = 0;
  const priced = lines.map((x) => { const each = engine.priceEach(x.it, x.q); tot += each * x.q; retail += (x.it.msrp || 0) * x.q; pcs += x.q; return Object.assign({ each }, x); });
  const cnt = { necklace: 0, bracelet: 0, earring: 0 }; lines.forEach((x) => cnt[x.it.cat]++);
  const why0 = engine.explain(anchors, lines.map((x) => x.it), halves, { minQty: cfg.minQty });
  const why = { family: why0.family.map(buyerWords), colorways: why0.colorways, sisters: why0.sisters, balance: why0.balance };

  document.title = `${title} · ${cfg.name}`;
  document.documentElement.style.setProperty("--accent", L === "OIYK" ? "#8d7bb8" : "#cf4331");
  const ol = orderLink();
  const ul = (a) => `<ul>${a.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`;
  let h = `<header class="hd"><img src="${esc(cfg.logo)}" alt="${esc(cfg.name)}"><div class="tag">${esc(cfg.sheetTagline || cfg.name)}</div>
    <h1>${esc(title)}</h1>
    <div class="meta">${lines.length} styles · ${CATS.filter((c) => cnt[c]).map((c) => `${cnt[c]} ${cnt[c] === 1 ? c : CAT_LABEL[c].toLowerCase()}`).join(" · ")} · ${reorder ? "reorder" : "first order"}${store ? ` · prepared for ${esc(store)}` : ""}</div>
    <div class="acts">${ol ? `<a class="btn primary" href="${esc(ol)}" target="_top" rel="noopener">Order this capsule</a>` : ""}<a class="btn" href="#why">&#9432; Why these pieces</a><button class="btn" id="printBtn">Print / save as PDF</button></div>
    ${ol ? `<p class="small">Opens our wholesale order page with these ${lines.length} styles filled in. Adjust quantities there, add your details and submit.</p>` : ""}</header>`;
  if (showPrices) h += `<div class="tot"><div><span>${reorder ? "Reorder" : "First order"}</span><b>${money(tot)}</b><small>${pcs} pieces</small></div><div><span>Retail value</span><b>${money0(retail)}</b><small>${tot ? (retail / tot).toFixed(1) + "× your cost" : ""}</small></div></div>`;
  for (const c of CATS) {
    const xs = priced.filter((x) => x.it.cat === c);
    if (!xs.length) continue;
    h += `<section class="grp"><h2>${CAT_LABEL[c]} <span>${xs.length}</span></h2><div class="grid">` + xs.map((x) => {
      const isA = anchors.includes(x.it);
      const r = isA ? (anchors.length > 1 ? "One of your picks." : "Your pick. Everything else was chosen to go with it.") : reasonOf.get(x.it.sku) || "";
      return `<div class="card${isA ? " a" : ""}"><div class="im"><img src="${esc(x.it.img)}" alt="${esc(x.it.name)}" loading="lazy">${isA ? '<span class="yp">Your pick</span>' : ""}</div>
        <div class="b"><div class="nm">${esc(x.it.name)}</div><div class="sku">${esc(x.it.sku)} · ${esc(qtyWord(x.q))}</div>
        ${showPrices ? `<div class="px">${money(x.each)} each · ${money(x.each * x.q)}${x.it.msrp ? ` · retail ${money(x.it.msrp)}` : ""}</div>` : ""}
        <div class="why">${esc(r)}</div></div></div>`;
    }).join("") + `</div></section>`;
  }
  if (gone.length) h += `<p class="small warn">No longer in our catalog, so left out: ${esc(gone.join(", "))}.</p>`;
  h += `<section class="whybox" id="why"><h2>Why these pieces</h2>
    <h3>The family</h3>${ul(why.family)}
    ${why.colorways.length ? `<h3>Colorways</h3><p class="small">A colorway is the same design in a different color. Showing a style in two or three colorways lets each customer find her color without a new design; switching a colorway changes the color, not the fit or the price.</p>${ul(why.colorways)}` : ""}
    ${why.sisters.length ? `<h3>Sister pieces</h3><p class="small">Pieces made to be worn together: the same collection, motif or material across categories.</p>${ul(why.sisters)}` : ""}
    <h3>Balance</h3>${ul(why.balance)}</section>`;
  h += `<section class="terms"><h2>Terms</h2><dl>${terms.map((r) => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join("")}</dl></section>`;
  h += `<footer>${esc(cfg.lineSheet.contactLine)}${rep ? ` · Your rep code: ${esc(rep)}` : ""}${cap ? ` · Capsule ${esc(cap)}` : ""}</footer>`;
  $("app").innerHTML = h;
  $("printBtn").onclick = () => window.print();
  window.__view = { lines: priced, orderLink: ol, why, terms, total: tot };
})();
