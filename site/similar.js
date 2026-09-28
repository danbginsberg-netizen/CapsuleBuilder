/* Capsule Builder v1.7.4 — Find similar · What she bought · Follow-up sheet (in the Her store tab).
   A buyer sends a photo or describes a look ("small faceted stone strands, in different stones"). The rep finds what we
   have that looks like it (same stones, same kind of strand, same size and colors), next to what she already bought, and
   sends her a one-page follow-up: "here's what you bought, and here's what we have in the stones you asked about."
   Lines never mix: results are shown per line and each line's follow-up is its own sheet. Nothing is looked up online;
   her photo stays on this device. No prices unless the rep turns them on. */
(function () {
  "use strict";
  const A = window.__cb, CE = window.CapsuleEngine;
  if (!A || !CE || !CE.parseLook) return;
  const { $, esc, state, money } = A;
  const KEY = "capsule_similar_v1";
  const MAX_ON_SHEET = 12;
  const LINES = ["RF", "OIYK"];
  const NAME = { RF: "Retro Forever", OIYK: "Only If You Know" };

  /* ---------------- state (kept in this browser) ---------------- */
  const DEF = { words: "", q: null, photos: [], orderText: "", orderRef: "", orderDate: "", sel: { RF: [], OIYK: [] }, touched: { RF: false, OIYK: false },
    ask: "", note: "", showPhoto: true, prices: false, link: true, missing: true, reorder: null, email: "", n: 12, ref: "" };
  let S = Object.assign(JSON.parse(JSON.stringify(DEF)), A.store.get(KEY, {}));
  S.sel = Object.assign({ RF: [], OIYK: [] }, S.sel); S.touched = Object.assign({ RF: false, OIYK: false }, S.touched);
  const save = () => { const ok = A.store.set(KEY, S); if (ok === false) A.toast("This browser is blocking local storage, so this search won't be kept."); };

  /* ---------------- engines for both lines (the other line's is built-in, read only) ---------------- */
  const OTHER = {};
  function eng(L) {
    if (L === A.line()) return A.engine();
    if (!OTHER[L]) {
      const BASE = window.CAPSULE_CONFIG, src = L === "RF" ? window.CATALOG_RF : window.CATALOG_OIYK;
      const cfg = Object.assign({}, BASE, BASE.lines[L] || {}), op = (window.ORDER_PAGE || {})[L];
      if (cfg.orderPage && op) cfg.orderPage = Object.assign({}, cfg.orderPage, { skus: op.skus });
      OTHER[L] = { e: new CE.Engine({ line: src.line, items: src.items.map((i) => Object.assign({}, i)) }, cfg), cfg };
    }
    return OTHER[L].e;
  }
  const cfgOf = (L) => (L === A.line() ? A.cfg() : (eng(L), OTHER[L].cfg));
  const minQtyOf = (L) => (L === A.line() ? state.minQty : cfgOf(L).minQty);
  const other = () => (A.line() === "RF" ? "OIYK" : "RF");

  /* ---------------- the look ---------------- */
  function query() {
    if (S.q) return S.q;
    const Q = CE.parseLook(S.words);
    // her photo's colors join the words' colors (metal read from the photo sets the metal)
    for (const p of S.photos) {
      (p.colors || []).forEach((c) => { if (c === "gold" || c === "silver") { if (!Q.metal) Q.metal = c; } else if (!Q.colors.includes(c) && Q.colors.length < 5) Q.colors.push(c); });
    }
    return Q;
  }
  const edit = (fn) => { const Q = JSON.parse(JSON.stringify(query())); fn(Q); S.q = Q; S.ref = Q.ref || ""; resetSel(); save(); draw(); };
  function resetSel() { LINES.forEach((L) => { if (!S.touched[L]) S.sel[L] = []; }); }
  const MATS = [["gemstone", "Natural stone"], ["pearl", "Pearl"], ["glass bead", "Glass bead"], ["seed bead", "Seed bead"], ["crystal/CZ", "Crystal"], ["shell", "Shell"], ["resin/epoxy", "Resin"], ["ceramic/clay", "Clay"], ["enamel", "Enamel"]];
  const SUBS = {
    necklace: [["beaded strand", "Bead strand"], ["layered", "Layered / multi-strand"], ["choker/collar", "Choker"], ["pendant", "Pendant"], ["chain", "Chain"]],
    bracelet: [["beaded/stretch", "Beaded / stretch"], ["charm bracelet", "Charm"], ["chain bracelet", "Chain"], ["bangle/cuff", "Bangle / cuff"]],
    earring: [["drop/dangle", "Drop"], ["hoop", "Hoop"], ["stud/post", "Stud"]],
  };
  const WORDS = [["faceted", "Faceted"], ["gold spacers", "Gold spacers"], ["knotted", "Knotted"], ["multi-strand", "Multi-strand"]];
  const SUB_NOUN = { "beaded strand": "strands", layered: "layered strands", "choker/collar": "chokers", pendant: "pendant necklaces", chain: "chain necklaces", "beaded/stretch": "beaded bracelets", "charm bracelet": "charm bracelets", "chain bracelet": "chain bracelets", "bangle/cuff": "bangles", "drop/dangle": "drop earrings", hoop: "hoops", "stud/post": "studs" };
  const listWords = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
  const cword = (f) => (window.CB_CONTEXT ? window.CB_CONTEXT.cword(f) : f);
  // the look in one plain sentence, for the rep and the sheet
  function describe(Q) {
    const size = { delicate: "delicate", statement: "statement" }[Q.scale] || "";
    const mat = (Q.mats || []).map((m) => (m === "gemstone" ? "natural-stone" : A.label(m))).join(" and ");
    const noun = SUB_NOUN[(Q.subs || [])[0]] || (Q.cat ? { necklace: "necklaces", bracelet: "bracelets", earring: "earrings" }[Q.cat] : "pieces");
    const faceted = (Q.words || []).includes("faceted") ? "faceted" : "";
    let s = [size, faceted, mat, noun].filter(Boolean).join(" ");
    if ((Q.stones || []).length) s += ` in ${listWords(Q.stones)}`;
    else if ((Q.colors || []).length) s += ` in ${listWords(Q.colors.map(cword))}`;
    if (Q.multi && !(Q.stones || []).length) s += ", in mixed colors";
    const extra = [(Q.words || []).includes("gold spacers") ? "gold spacers" : "", (Q.words || []).includes("knotted") ? "knotted between the beads" : ""].filter(Boolean);
    if (extra.length) s += `, with ${extra.join(" and ")}`;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const hasLook = (Q) => (Q.mats || []).length + (Q.stones || []).length + (Q.subs || []).length + (Q.colors || []).length + (Q.scale ? 1 : 0) + (Q.multi ? 1 : 0) > 0;

  /* ---------------- what she bought ---------------- */
  function bought() {
    const P = CE.parseOrder(S.orderText);
    const out = { P, per: {} };
    LINES.forEach((L) => {
      const r = eng(L).resolveOrder(P.entries);
      out.per[L] = { rows: r, owned: [].concat(...r.filter((x) => x.kind === "colorway").map((x) => x.items.map((i) => i.sku))), styles: r.filter((x) => x.kind !== "off").map((x) => x.entry.style), off: r.filter((x) => x.kind === "off").map((x) => x.entry) };
    });
    return out;
  }

  /* ---------------- results ---------------- */
  function results(L, B, n) {
    const Q = query();
    if (!hasLook(Q)) return null;
    return eng(L).similar(Q, { owned: B.per[L].owned, minQty: minQtyOf(L), n: n || S.n });
  }
  // default picks for the follow-up: the best new colorway of each top style, plus close colorways (stones matter), up to 8
  function defaultSel(R) {
    const out = [];
    for (const g of R.groups) {
      const fresh = g.colorways.filter((c) => !c.owned);
      if (!fresh.length) continue;
      const top = fresh[0].s;
      fresh.filter((c, i) => i === 0 || (c.s >= top * 0.9 && c.s >= 0.55)).slice(0, 3).forEach((c) => { if (out.length < 8) out.push(c.item.sku); });
      if (out.length >= 8) break;
    }
    return out;
  }

  /* ---------------- photos ---------------- */
  const loadImg = (src) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("image")); im.src = src; });
  function thumbOf(img, px) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, px / Math.max(w, h));
    const cv = document.createElement("canvas"); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", 0.74);
  }
  async function addPhoto(file) {
    if (!/^image\//.test(file.type)) return;
    if (S.photos.length >= 4) { A.toast("Up to 4 of her photos. Remove one to add another."); return; }
    const url = URL.createObjectURL(file);
    try {
      const im = await loadImg(url);
      const p = window.CB_CONTEXT ? window.CB_CONTEXT.paletteOf(im, "jewelry") : { families: [], swatches: [] };
      S.photos.push({ thumb: thumbOf(im, 360), colors: p.families, swatches: p.swatches });
      if (S.q) { const Q = S.q; p.families.forEach((c) => { if (c !== "gold" && c !== "silver" && !Q.colors.includes(c) && Q.colors.length < 5) Q.colors.push(c); }); }
      resetSel(); save(); draw();
      A.flash("simNote", "Read the colors in her photo. Tap the colors below to fix them, and name the stones if you know them.");
    } catch (e) { A.toast("That picture couldn't be read."); } finally { URL.revokeObjectURL(url); }
  }

  /* ---------------- drawing: the pane ---------------- */
  let mode = "match";
  function setMode(m) {
    mode = m === "similar" ? "similar" : "match";
    const body = $("ctxBody"), sp = $("simPane"); if (!body || !sp) return;
    body.classList.toggle("hide", mode !== "match"); sp.classList.toggle("hide", mode !== "similar");
    document.body.classList.toggle("sim-on", mode === "similar");
    $("storeMode").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
    try { sessionStorage.setItem("cb_storemode", mode); } catch (e) { /* ignore */ }
    if (mode === "similar") draw();
  }
  const chip = (on, attrs, text, title) => `<button class="${on ? "on" : ""}" ${attrs} ${title ? `title="${esc(title)}"` : ""}>${text}</button>`;
  function askHTML(Q) {
    const SW = (window.CB_CONTEXT || {}).SW || {};
    const subs = Q.cat ? SUBS[Q.cat] : SUBS.necklace.concat(SUBS.bracelet.slice(0, 1), SUBS.earring.slice(0, 2));
    return `<h3><span class="n">1</span> What she's asking for</h3>
      <div class="drop sim-drop" id="simDrop"><b>Her photo</b><span>Drop it here, paste a screenshot (Ctrl+V / ⌘V), or</span>
        <div class="row"><button class="btn primary" id="simPick">Choose photo…</button></div><input type="file" id="simFile" accept="image/*" multiple hidden>
        ${S.photos.length ? `<div class="sim-ph">${S.photos.map((p, i) => `<div><img src="${esc(p.thumb)}" alt=""><div class="cx-sw">${(p.swatches || []).map((c) => `<i style="background:${c}"></i>`).join("")}</div><button class="x" data-rmph="${i}" title="Remove">✕</button></div>`).join("")}</div>` : ""}</div>
      <label class="lbl" for="simWords">Describe it in her words</label>
      <textarea id="simWords" rows="2" placeholder="e.g. small faceted stone strands in tourmaline, hematite and tiger's eye, gold spacers">${esc(S.words)}</textarea>
      <div class="row sim-ref"><input type="text" id="simRef" list="simRefList" placeholder="…or start from one of our styles (SKU)" value="${esc(S.ref)}"><datalist id="simRefList">${A.catalog().items.slice(0, 600).map((it) => `<option value="${esc(it.sku)}">${esc(it.name)}</option>`).join("")}</datalist><button class="btn" id="simRefGo">More like it</button></div>
      <div class="note" id="simNote"></div>
      <div class="sim-q">
        <div><small>Find</small><div class="chips">${[["", "Any"], ["necklace", "Necklaces"], ["bracelet", "Bracelets"], ["earring", "Earrings"]].map(([k, t]) => chip(Q.cat === k, `data-cat="${k}"`, t)).join("")}</div></div>
        <div><small>Stones</small><div class="chips">${(Q.stones || []).map((s) => chip(true, `data-stone="${esc(s)}"`, esc(s) + " ✕", "Remove")).join("")}
          <select id="simAddStone"><option value="">+ Add a stone…</option>${CE.STONES.filter((s) => !(Q.stones || []).includes(s)).map((s) => `<option>${esc(s)}</option>`).join("")}</select></div></div>
        <div><small>Material</small><div class="chips">${MATS.map(([k, t]) => chip((Q.mats || []).includes(k), `data-mat="${esc(k)}"`, t)).join("")}</div></div>
        <div><small>Kind</small><div class="chips">${subs.map(([k, t]) => chip((Q.subs || []).includes(k), `data-sub="${esc(k)}"`, t)).join("")}</div></div>
        <div><small>Size</small><div class="chips">${[["", "Any"], ["delicate", "Delicate"], ["medium", "Medium"], ["statement", "Statement"]].map(([k, t]) => chip((Q.scale || "") === k, `data-scale="${k}"`, t)).join("")}</div></div>
        <div><small>Details</small><div class="chips">${WORDS.map(([k, t]) => chip((Q.words || []).includes(k), `data-word="${esc(k)}"`, t)).join("")}${chip(Q.multi, `data-multi="1"`, "Mixed stones / multicolor")}</div></div>
        <div><small>Metal</small><div class="chips">${[["", "Any"], ["gold", "Gold"], ["silver", "Silver"]].map(([k, t]) => chip((Q.metal || "") === k, `data-metal="${k}"`, t)).join("")}</div></div>
        <div><small>Colors</small><div class="cx-cols sim-cols">${Object.keys(SW).filter((f) => f !== "gold" && f !== "silver").map((f) => `<button data-col="${esc(f)}" class="${(Q.colors || []).includes(f) ? "on" : ""}" style="--c:${SW[f]}" title="${esc(cword(f))}"></button>`).join("")}</div>
          <div class="note">${(Q.colors || []).length ? esc((Q.colors || []).map(cword).join(" · ")) : (Q.stones || []).length ? "From the stones she named." : "No colors yet."}</div></div>
      </div>
      <p class="note">${S.q ? "Adjusted by hand. Editing the description reads it again." : "Read from her words and photo. Tap to adjust."}</p>`;
  }
  function boughtHTML(B) {
    const L = A.line(), P = B.P;
    const line = (L2) => {
      const rows = B.per[L2].rows; if (!rows.length) return "";
      return `<div class="sim-bl"><div class="sim-bl-h">${esc(NAME[L2])}</div>${rows.map((r) => {
        const e = r.entry, q = e.qty != null ? ` × ${e.qty}` : "";
        if (r.kind === "off") return `<div class="sb off"><div class="im">?</div><div><b>${esc(e.style)}</b>${q}<small>${esc(e.raw.slice(0, 60))}</small><small class="warn">Not in the builder catalog (a sample or an older style)</small></div></div>`;
        const it = r.items[0];
        return `<div class="sb"><img src="${esc(it.img)}" alt=""><div><b>${esc(r.kind === "colorway" ? r.items.map((i) => i.sku).join(", ") : e.style)}</b>${q}<small>${esc(it.name)}${r.kind === "colorway" ? " · " + esc(r.items.map((i) => i.cname || A.label(i.dom)).join(", ")) : ""}</small>
          ${r.kind === "style" ? `<small class="warn">Colorway not clear from the order (${esc(e.suffixes.join(" ") || "no code")}); this style comes in ${r.items.length}.</small>` : ""}
          <button class="lnk" data-more="${esc(it.sku)}">More like this</button></div></div>`;
      }).join("")}</div>`;
    };
    const n = B.P.entries.length;
    return `<h3><span class="n">2</span> What she bought</h3>
      <textarea id="simOrder" rows="4" placeholder="Paste her order: select the items on the Shopify order page (or the order email / invoice) and paste. Style numbers are enough, e.g.&#10;FN2933GDAMZ × 3&#10;FN1358GDPP × 2">${esc(S.orderText)}</textarea>
      <div class="row"><button class="btn" id="simOrderGo">Read the order</button><button class="btn" id="simOrderCsv" title="Shopify admin: Orders > Export (CSV)">Import order CSV…</button><input type="file" id="simOrderFile" accept=".csv,text/csv" hidden>${S.orderText ? `<button class="btn" id="simOrderClr">Clear</button>` : ""}</div>
      <div class="row sim-ref"><input type="text" id="simOrderRef" placeholder="Order # (optional)" value="${esc(S.orderRef || P.order)}"><input type="text" id="simOrderDate" placeholder="Date (optional)" value="${esc(S.orderDate || P.date)}"></div>
      ${n ? `<div class="note">${n} line${n === 1 ? "" : "s"} read. Nothing is looked up online.</div>${line(L)}${line(other())}` : `<p class="note">Optional. With her order in, the sheet opens with “here's what you bought,” the styles she already has are left out of the suggestions, and a style she bought in a new stone moves up.</p>`}`;
  }
  function cardHTML(L, g, selectable) {
    const b = g.best, it = b.item;
    const sel = new Set(S.sel[L]);
    const cws = g.colorways.slice(0, 8);
    return `<div class="sm ${cws.some((c) => sel.has(c.item.sku)) ? "on" : ""}" data-style="${esc(g.style)}">
      <div class="sm-im"><img src="${esc(it.img)}" alt="" loading="lazy">${g.boughtStyle ? `<span class="sm-tag">Her style · new stone</span>` : ""}<span class="sm-pc" title="How closely it matches the look">${Math.round(b.s * 100)}%</span></div>
      <div class="sm-b"><b>${esc(it.name)}</b><small>${esc(it.sku)} · ${esc(it.cname || A.label(it.dom))}</small>
        <div class="sm-why">${b.why.slice(0, 6).map((w) => `<span>${esc(w)}</span>`).join("")}</div>
        <div class="sm-cw">${cws.map((c) => `<button class="cw ${sel.has(c.item.sku) ? "on" : ""} ${c.owned ? "own" : ""}" data-sku="${esc(c.item.sku)}" ${!selectable || c.owned ? "disabled" : ""} title="${esc(c.item.sku)} · ${esc(c.item.cname || "")}${c.owned ? " · she has this" : ""}${c.item.mto ? " · made to order" : ` · ${c.item.qty} in stock`}"><img src="${esc(c.item.img)}" alt="" loading="lazy"><span>${esc(c.item.cname || A.label(c.item.dom))}${c.owned ? " · has it" : ""}</span></button>`).join("")}</div>
        ${selectable ? `<div class="row"><button class="btn" data-more="${esc(it.sku)}">More like this</button><button class="btn" data-build="${esc(it.sku)}" title="Build a capsule around this piece">Build capsule</button></div>` : ""}</div></div>`;
  }
  function stoneLine(L, R) {
    if (!R || !R.stoneReport.length) return "";
    const have = R.stoneReport.filter((x) => x.skus.length), miss = R.stoneReport.filter((x) => !x.skus.length);
    return `<div class="sim-stones">${have.map((x) => `<span class="ok">${esc(x.stone)} · ${x.skus.length} in stock</span>`).join("")}${miss.length ? `<span class="no">Not in ${esc(NAME[L])} right now: ${esc(listWords(miss.map((x) => x.stone)))}</span>` : ""}</div>`;
  }
  function resHTML(B) {
    const L = A.line(), O = other(), Q = query();
    if (!hasLook(Q)) return `<h3><span class="n">3</span> What we have that looks like it</h3><p class="note">Add her photo, describe the look, or start from one of our styles. Results show here, ${esc(NAME[L])} first.</p>`;
    const R = results(L, B), RO = results(O, B, 4);
    if (!S.touched[L] && !S.sel[L].length) S.sel[L] = defaultSel(R);
    const nSel = S.sel[L].length;
    return `<h3><span class="n">3</span> What we have that looks like it</h3>
      <p class="sim-desc">“${esc(describe(Q))}”</p>
      <div class="sim-sec"><div class="sim-sec-h"><h4>${esc(NAME[L])}</h4><span class="note">${R.total} style${R.total === 1 ? "" : "s"} match · in stock and on the order page · tap a colorway to put it on the follow-up (${nSel} chosen)</span></div>
        ${stoneLine(L, R)}
        <div class="sm-grid">${R.groups.map((g) => cardHTML(L, g, true)).join("") || `<p class="note">Nothing in stock matches yet. Loosen the look: remove a stone or set Size to Any.</p>`}</div>
        ${R.total > R.groups.length ? `<button class="btn" id="simMore">Show more (${R.total - R.groups.length} more)</button>` : ""}</div>
      ${RO && RO.groups.length ? `<div class="sim-sec other"><div class="sim-sec-h"><h4>Also in ${esc(NAME[O])}</h4><span class="note">A separate line with its own terms, never mixed with ${esc(NAME[L])}. Its follow-up is its own sheet.</span><button class="btn" id="simSwitch">Switch to ${esc(NAME[O])}</button></div>
        ${stoneLine(O, RO)}<div class="sm-grid">${RO.groups.map((g) => cardHTML(O, g, false)).join("")}</div></div>` : ""}`;
  }
  function sendHTML(B) {
    const L = A.line(), n = S.sel[L].length, has = B.per[L].rows.length > 0;
    const reorder = S.reorder == null ? has : S.reorder;
    return `<h3><span class="n">4</span> Send her the follow-up</h3>
      <p class="note">One page from ${esc(NAME[L])}: what she bought, her photo and request, and the ${n || "chosen"} style${n === 1 ? "" : "s"} in those stones, with how to order. ${n > MAX_ON_SHEET ? `<span class="warn">The page holds ${MAX_ON_SHEET}; the first ${MAX_ON_SHEET} chosen are used.</span>` : ""}</p>
      <div class="sim-f">
        <label>For<input type="text" id="simFor" value="${esc(state.buyer)}" placeholder="Her name or store"></label>
        <label>Her email<input type="email" id="simEmail" value="${esc(S.email)}" placeholder="optional, for Email as PDF"></label>
        <label class="w">Her request, as it reads on the sheet<input type="text" id="simAsk" value="${esc(S.ask)}" placeholder="${esc(describe(query()))}"></label>
        <label class="w">A line from you (optional)<input type="text" id="simMsg" value="${esc(S.note)}" placeholder="e.g. Great to meet you at Coterie."></label>
      </div>
      <div class="sim-togs">
        <label class="tog"><input type="checkbox" id="simReorder" ${reorder ? "checked" : ""}> She has ordered before (reorder quantities)</label>
        <label class="tog"><input type="checkbox" id="simShowPh" ${S.showPhoto ? "checked" : ""} ${S.photos.length ? "" : "disabled"}> Show her photo</label>
        <label class="tog"><input type="checkbox" id="simMiss" ${S.missing ? "checked" : ""}> Say which stones we don't carry</label>
        <label class="tog"><input type="checkbox" id="simLink" ${S.link ? "checked" : ""}> Order link + QR code (these styles filled in)</label>
        <label class="tog"><input type="checkbox" id="simPrices" ${S.prices ? "checked" : ""}> Show wholesale prices</label>
      </div>
      <div class="row sim-acts"><button class="btn primary" id="simMail" ${n ? "" : "disabled"}>Email as PDF</button><button class="btn" id="simShare" ${n ? "" : "disabled"} title="On a phone or tablet: WhatsApp, Messages, Mail">Share…</button><button class="btn" id="simPdf" ${n ? "" : "disabled"}>Download PDF</button><button class="btn" id="simCopy" ${n ? "" : "disabled"}>Copy as text</button><button class="btn" id="simPrev" ${n ? "" : "disabled"}>Preview</button>${n ? `<button class="btn" id="simClearSel">Clear choices</button>` : ""}</div>
      <div class="note" id="simSendNote"></div>
      <div class="sim-prev hide" id="simPrevBox"></div>`;
  }
  let B = null;
  function draw() {
    const sp = $("simPane"); if (!sp || mode !== "similar") return;
    B = bought();
    const scroll = window.scrollY;
    sp.innerHTML = `<div class="sp-head"><div><h1>Find similar</h1><p class="note">A buyer sends a photo or describes a look. Find what we have that looks like it, next to what she already bought, and send her one page: <b>here's what you bought, and here's what we have in the stones you asked about.</b> Her photo stays on this device. Lines never mix.</p></div><div class="sp-hd-r"><button class="btn" id="simReset">Start over</button></div></div>
      <div class="sim-top"><section class="panel sim-ask">${askHTML(query())}</section><section class="panel sim-bought">${boughtHTML(B)}</section></div>
      <section class="sim-res">${resHTML(B)}</section>
      <section class="panel sim-send">${sendHTML(B)}</section>`;
    wire();
    window.scrollTo({ top: scroll, behavior: "instant" });
    save();
  }

  /* ---------------- wiring ---------------- */
  let tWords = null;
  function wire() {
    const sp = $("simPane");
    $("simReset").onclick = () => { const b = $("simReset"); if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = "Click again to start over"; setTimeout(() => { if ($("simReset")) { b.dataset.arm = ""; b.textContent = "Start over"; } }, 3500); return; } S = JSON.parse(JSON.stringify(DEF)); save(); draw(); };
    $("simPick").onclick = () => $("simFile").click();
    $("simFile").onchange = (e) => { [...e.target.files].forEach(addPhoto); e.target.value = ""; };
    const drop = $("simDrop");
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => [...(e.dataTransfer.files || [])].forEach(addPhoto));
    sp.querySelectorAll("[data-rmph]").forEach((b) => (b.onclick = () => { S.photos.splice(+b.dataset.rmph, 1); resetSel(); save(); draw(); }));
    $("simWords").oninput = () => { S.words = $("simWords").value; clearTimeout(tWords); tWords = setTimeout(() => { S.q = null; S.ref = ""; resetSel(); save(); draw(); const w = $("simWords"); if (w) { w.focus(); w.setSelectionRange(w.value.length, w.value.length); } }, 700); };
    $("simRefGo").onclick = () => moreLike($("simRef").value);
    $("simRef").onkeydown = (e) => { if (e.key === "Enter") moreLike($("simRef").value); };
    sp.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => edit((Q) => { Q.cat = b.dataset.cat; Q.subs = (Q.subs || []).filter((s) => !Q.cat || (SUBS[Q.cat] || []).some((x) => x[0] === s)); })));
    sp.querySelectorAll("[data-stone]").forEach((b) => (b.onclick = () => edit((Q) => { Q.stones = Q.stones.filter((s) => s !== b.dataset.stone); })));
    $("simAddStone").onchange = () => { const v = $("simAddStone").value; if (v) edit((Q) => { Q.stones = (Q.stones || []).concat([v]); if (!Q.mats.includes("gemstone")) Q.mats.push("gemstone"); }); };
    const tog = (k, v) => (Q) => { const L = Q[k] || (Q[k] = []); const i = L.indexOf(v); i >= 0 ? L.splice(i, 1) : L.push(v); };
    sp.querySelectorAll("[data-mat]").forEach((b) => (b.onclick = () => edit(tog("mats", b.dataset.mat))));
    sp.querySelectorAll("[data-sub]").forEach((b) => (b.onclick = () => edit(tog("subs", b.dataset.sub))));
    sp.querySelectorAll("[data-word]").forEach((b) => (b.onclick = () => edit(tog("words", b.dataset.word))));
    sp.querySelectorAll("[data-col]").forEach((b) => (b.onclick = () => edit(tog("colors", b.dataset.col))));
    sp.querySelectorAll("[data-scale]").forEach((b) => (b.onclick = () => edit((Q) => { Q.scale = b.dataset.scale; })));
    sp.querySelectorAll("[data-metal]").forEach((b) => (b.onclick = () => edit((Q) => { Q.metal = b.dataset.metal; })));
    sp.querySelectorAll("[data-multi]").forEach((b) => (b.onclick = () => edit((Q) => { Q.multi = !Q.multi; })));
    // order
    $("simOrder").oninput = () => { S.orderText = $("simOrder").value; save(); };
    $("simOrderGo").onclick = () => { S.orderText = $("simOrder").value; S.orderRef = ""; S.orderDate = ""; S.reorder = null; resetSel(); save(); draw(); };
    $("simOrderCsv").onclick = () => $("simOrderFile").click();
    $("simOrderFile").onchange = async (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importOrderCSV(await f.text(), f.name); };
    if ($("simOrderClr")) $("simOrderClr").onclick = () => { S.orderText = ""; S.orderRef = ""; S.orderDate = ""; S.reorder = null; resetSel(); save(); draw(); };
    $("simOrderRef").onchange = () => { S.orderRef = $("simOrderRef").value.trim(); save(); };
    $("simOrderDate").onchange = () => { S.orderDate = $("simOrderDate").value.trim(); save(); };
    sp.querySelectorAll("[data-more]").forEach((b) => (b.onclick = () => moreLike(b.dataset.more)));
    // results
    sp.querySelectorAll(".sm .cw").forEach((b) => (b.onclick = () => {
      const L = A.line(), sku = b.dataset.sku, L0 = S.sel[L], i = L0.indexOf(sku);
      if (i >= 0) L0.splice(i, 1); else L0.push(sku);
      S.touched[L] = true; save(); draw();
    }));
    sp.querySelectorAll("[data-build]").forEach((b) => (b.onclick = () => { state.anchors = [null, null]; A.setAnchor(0, b.dataset.build); window.CB_PANE && window.CB_PANE("capsule"); }));
    if ($("simMore")) $("simMore").onclick = () => { S.n += 12; save(); draw(); };
    if ($("simSwitch")) $("simSwitch").onclick = () => { const O = other(); document.querySelector(`.lines button[data-line="${O}"]`).click(); };
    // send
    $("simFor").onchange = () => { const v = $("simFor").value.trim(); if ($("buyer")) { $("buyer").value = v; $("buyer").dispatchEvent(new Event("input")); } else { state.buyer = v; A.persist(); } };
    $("simEmail").onchange = () => { S.email = $("simEmail").value.trim(); save(); };
    $("simAsk").onchange = () => { S.ask = $("simAsk").value.trim(); save(); };
    $("simMsg").onchange = () => { S.note = $("simMsg").value.trim(); save(); };
    $("simReorder").onchange = () => { S.reorder = $("simReorder").checked; save(); };
    $("simShowPh").onchange = () => { S.showPhoto = $("simShowPh").checked; save(); };
    $("simMiss").onchange = () => { S.missing = $("simMiss").checked; save(); };
    $("simLink").onchange = () => { S.link = $("simLink").checked; save(); };
    $("simPrices").onchange = () => { S.prices = $("simPrices").checked; save(); };
    if ($("simClearSel")) $("simClearSel").onclick = () => { S.sel[A.line()] = []; S.touched[A.line()] = true; save(); draw(); };
    $("simPrev").onclick = preview;
    $("simPdf").onclick = async () => { const f = await makePDF($("simPdf")); if (f) { A.download(f.name, f, "application/pdf"); A.flash("simSendNote", `Saved <b>${esc(f.name)}</b> to this device's downloads.`); } };
    $("simMail").onclick = emailPDF;
    $("simShare").onclick = sharePDF;
    $("simCopy").onclick = () => A.copyText(followText(), "simSendNote", "Follow-up");
  }
  function moreLike(sku) {
    sku = String(sku || "").trim().toUpperCase(); if (!sku) return;
    let it = null; for (const L of LINES) { it = eng(L).bySku.get(sku); if (it) break; }
    if (!it) { A.flash("simNote", `<span class="warn">${esc(sku)} isn't in either catalog.</span>`); return; }
    S.q = CE.lookOf(it); S.ref = it.sku; resetSel(); save(); draw();
    A.flash("simNote", `Looking for pieces like ${esc(it.sku)} ${esc(it.name)} (${esc(it.cname || "")}).`);
  }
  // a Shopify order export (Orders > Export): Name, Lineitem quantity, Lineitem name, Lineitem sku
  function importOrderCSV(text, name) {
    const rows = A.parseCSV(text);
    const h = rows.length ? Object.keys(rows[0]) : [];
    const col = (re) => h.find((k) => re.test(k));
    const cSku = col(/^lineitem sku$/i), cName = col(/^lineitem name$/i), cQty = col(/^lineitem quantity$/i), cOrd = col(/^name$/i), cDate = col(/^(created at|paid at)$/i);
    if (!cSku && !cName) { S.orderText = text; } else {
      S.orderText = rows.map((r) => `${(r[cSku] || r[cName] || "").trim()}${cName && cSku && r[cSku] ? " " + r[cName] : ""}${cQty && r[cQty] ? " × " + r[cQty] : ""}`).filter((s) => s.trim()).join("\n");
      if (cOrd && rows[0][cOrd]) S.orderRef = rows[0][cOrd];
      if (cDate && rows[0][cDate]) S.orderDate = String(rows[0][cDate]).slice(0, 10);
    }
    S.reorder = null; resetSel(); save(); draw();
    A.flash("simNote", `Read ${esc(name)}.`);
  }

  /* ---------------- the follow-up: text, link, page, PDF ---------------- */
  const selItems = () => { const e = A.engine(); return S.sel[A.line()].map((s) => e.bySku.get(s)).filter(Boolean).slice(0, MAX_ON_SHEET); };
  const isReorder = () => (S.reorder == null ? (B || bought()).per[A.line()].rows.length > 0 : S.reorder);
  const firstName = () => { const n = state.buyer.trim(); return n && !/\b(inc|llc|shop|store|boutique|co)\b/i.test(n) ? n.split(/\s+/)[0] : ""; };
  function orderRef() { const P = (B || bought()).P; return [S.orderRef || P.order, S.orderDate || P.date].filter(Boolean); }
  function followLink(items) {
    const cfg = A.cfg(), op = cfg.orderPage, e = A.engine();
    if (!op || !items.length) return null;
    const listed = new Set(op.skus || []), re = isReorder(), parts = [], off = [];
    for (const it of items) {
      const sku = String(it.sku).toUpperCase();
      if (op.skus && !listed.has(sku)) { off.push(it.sku); continue; }
      const units = e.unitsFor(it, re ? "reorder" : "first");
      parts.push(`${encodeURIComponent(sku)}:${op.qtyIn === "pieces" ? units : Math.round((units / 12) * 2) / 2}`);
    }
    if (!parts.length) return null;
    let url = `${op.url}?cart=${parts.join(",")}`;
    if (re) url += "&reorder=1";
    if (state.buyer.trim()) url += `&store=${encodeURIComponent(state.buyer.trim())}`;
    if (state.rep) url += `&rep=${encodeURIComponent(state.rep)}`;
    url += `&cap=${encodeURIComponent(A.capId())}`;
    return { url, off, n: parts.length };
  }
  function howToOrder() {
    const cfg = A.cfg(), t = cfg.terms || {}, re = isReorder(), L = A.line();
    const out = [];
    if (L === "RF") {
      out.push(re ? "Reorders are sold by the dozen: 12 per style." : `${t.unitsNote || ""} ${money(t.orderMinimum || 0, 0)} minimum on a first order.`.trim());
      out.push("In stock at our U.S. warehouse.");
    } else {
      out.push(re ? `Reorders: a dozen per style.` : `${money(t.orderMinimum || 0, 0)} minimum on a first order. A dozen per style.`);
      out.push(re ? "Reorders ship from our U.S. warehouse in about 10 business days." : "Made to order: 45- to 60-day lead times on most styles, depending on the season.");
    }
    return out.join(" ");
  }
  function missingStones() {
    const Q = query(); if (!S.missing || !(Q.stones || []).length) return [];
    const R = A.engine().similar(Q, { minQty: minQtyOf(A.line()), n: 1 });
    return R.stoneReport.filter((x) => !x.skus.length).map((x) => x.stone);
  }
  const askLine = () => S.ask || describe(query());
  function badgeOf(it) {
    const per = (B || bought()).per[A.line()];
    const style = (it.sku.match(/^[A-Z]+\d+/) || [""])[0];
    if (per.styles.includes(style)) return "The style you bought, in a new stone";
    return "";
  }
  // the colorway name, plus the stone she asked about when the name doesn't say it (e.g. "Multicolor · hematite")
  function colorName(it) {
    const c = it.cname || A.label(it.dom);
    const st = (A.engine().similarScore(query(), it).stones || []).filter((h) => h.where === "stone" && !c.toLowerCase().includes(h.stone)).map((h) => h.stone);
    return st.length ? `${c} · ${st.join(", ")}` : c;
  }
  function followText() {
    const items = selItems(), ref = orderRef(), fn = firstName(), link = S.link ? followLink(items) : null, miss = missingStones();
    const lines = [`Hi${fn ? " " + fn : ""},`, ""];
    if (S.note) lines.push(S.note, "");
    lines.push(`${ref.length ? `Thank you for your order ${ref.join(", ")}. ` : ""}You asked about ${askLine().charAt(0).toLowerCase() + askLine().slice(1)}. Here's what we have in ${A.cfg().name}:`, "");
    items.forEach((it) => { const b = badgeOf(it); lines.push(`- ${it.name}, ${colorName(it)} (${it.sku})${b ? ` · ${b.toLowerCase()}` : ""}${S.prices ? ` · ${money(A.engine().lineCost(it, isReorder() ? "reorder" : "first").each)} wholesale` : ""}`); });
    if (miss.length) lines.push("", `We don't have ${listWords(miss)} in the line right now; these are the closest in look and color.`);
    lines.push("", howToOrder());
    if (link) lines.push(`This link opens our order page with these styles filled in:\n${link.url}`);
    lines.push("", "Best,");
    return lines.join("\n");
  }
  function pageHTML() {
    const cfg = A.cfg(), L = A.line(), items = selItems(), ref = orderRef(), per = (B || bought()).per[L], link = S.link ? followLink(items) : null, miss = missingStones();
    const owned = per.rows.filter((r) => r.kind !== "off");
    const who = state.buyer.trim();
    const boughtTiles = owned.slice(0, 8).map((r) => { const it = r.items[0]; const q = r.entry.qty != null ? ` × ${r.entry.qty}` : ""; return `<div class="b"><img src="${esc(it.img)}" alt=""><div><b>${esc(r.kind === "colorway" ? r.items.map((i) => i.sku).join(", ") : r.entry.style)}</b>${esc(q)}<br>${esc(it.name)}${r.kind === "colorway" ? `<br><i>${esc(r.items.map((i) => i.cname || "").join(", "))}</i>` : ""}</div></div>`; }).join("");
    const offList = per.off.map((e) => e.style + (e.qty != null ? ` × ${e.qty}` : ""));
    const photos = S.showPhoto ? S.photos.slice(0, 2) : [];
    const tiles = items.map((it) => { const b = badgeOf(it); return `<div class="t"><img src="${esc(it.img)}" alt=""><span class="s"><b>${esc(it.sku)}</b> · ${esc(colorName(it))}</span><span>${esc(it.name)}</span>${b ? `<i>${esc(b)}</i>` : ""}${S.prices ? `<span class="p">${money(A.engine().lineCost(it, isReorder() ? "reorder" : "first").each)} wholesale</span>` : ""}</div>`; }).join("");
    return `<div class="sh-mini"><img src="${esc(cfg.logo)}" alt="${esc(cfg.name)}"><div class="t"><small>Follow-up · ${esc(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}</small>${who ? `For ${esc(who)}` : "Styles in the stones you asked about"}</div></div>
      <div class="fu-intro">${S.note ? `${esc(S.note)} ` : ""}${ref.length ? `Thank you for your order ${esc(ref.join(", "))}. ` : ""}Here's ${owned.length || offList.length ? "what you bought, and " : ""}what we have in the stones you asked about.</div>
      ${owned.length || offList.length ? `<div class="fu-h">What you bought</div><div class="fu-bought">${boughtTiles}</div>${offList.length ? `<div class="fu-also">${owned.length ? "Also on your order" : "On your order"}: ${esc(offList.join(" · "))}</div>` : ""}` : ""}
      <div class="fu-h">You asked about</div>
      <div class="fu-ask">${photos.length ? `<div class="ph">${photos.map((p) => `<img src="${esc(p.thumb)}" alt="">`).join("")}</div>` : ""}<div class="tx">${esc(askLine())}.${miss.length ? `<small>We don't have ${esc(listWords(miss))} in the line right now; the pieces below are the closest in look and color.</small>` : ""}</div></div>
      <div class="fu-h">What we have in those stones</div>
      <div class="fu-grid" data-n="${items.length}">${tiles}</div>
      <div class="sh-order fu-order">${link ? `<div class="qr">${A.qrSVG(link.url)}</div>` : ""}<div class="tx"><b>How to order</b>${esc(howToOrder())}${link ? ` Scan the code or <a href="${esc(link.url)}">click here</a>: our order page opens with these ${link.n} styles filled in. Adjust quantities there, add your details and submit.` : ""}</div></div>
      <div class="sh-foot"><span class="l">${esc(cfg.name)}</span><span class="c">${esc(cfg.lineSheet.contactLine)}</span><span class="r">${esc(cfg.contactEmail || "")}</span></div>`;
  }
  // size the style photos to the room left on the page (one page, always)
  function fit(pg) {
    const g = pg.querySelector(".fu-grid"), n = +g.dataset.n || 1;
    const cols = n <= 4 ? Math.max(n, 3) : 4, rows = Math.ceil(n / cols);
    g.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    // start as large as a column allows, then shrink until every row fits above "How to order"
    let ph = Math.min(165, Math.floor(g.clientWidth / cols - 12), Math.floor(g.clientHeight / rows));
    g.style.setProperty("--ph", ph + "px");
    while (ph > 44 && g.scrollHeight > g.clientHeight + 1) { ph -= 6; g.style.setProperty("--ph", ph + "px"); }
  }
  function buildPage() {
    const pg = document.createElement("div");
    pg.className = "sheet fu-page sheet-" + A.line().toLowerCase();
    pg.innerHTML = pageHTML();
    return pg;
  }
  async function imgsReady(root) { await Promise.all([...root.querySelectorAll("img")].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })))); }
  async function preview() {
    const box = $("simPrevBox"); box.classList.remove("hide"); box.innerHTML = "";
    const holder = document.createElement("div"); holder.className = "pgwrap"; box.appendChild(holder);
    const pg = buildPage(); holder.appendChild(pg); fit(pg); await imgsReady(pg); fit(pg);
    const k = Math.min(1, (box.clientWidth - 20) / pg.offsetWidth);
    pg.style.transform = `scale(${k})`; pg.style.transformOrigin = "top left";
    holder.style.width = pg.offsetWidth * k + "px"; holder.style.height = pg.offsetHeight * k + "px";
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  async function makePDF(btn) {
    const run = async () => {
      if (!window.jspdf || !window.html2canvas) throw new Error("pdf");
      const host = document.createElement("div"); host.style.cssText = "position:fixed;left:-20000px;top:0;background:#fff;";
      document.body.appendChild(host);
      try {
        const pg = buildPage(); host.appendChild(pg); fit(pg); await imgsReady(pg); fit(pg);
        const c = await window.html2canvas(pg, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true });
        const doc = new window.jspdf.jsPDF({ unit: "in", format: "letter", orientation: "portrait", compress: true });
        doc.addImage(c.toDataURL("image/jpeg", 0.9), "JPEG", 0.45, 0.45, 7.6, 10.1, undefined, "FAST");
        doc.setProperties({ title: `${A.cfg().name} follow-up${state.buyer.trim() ? " for " + state.buyer.trim() : ""}`, author: A.cfg().name });
        return new File([doc.output("blob")], `${A.fileSafe(`${A.cfg().name} follow-up ${state.buyer.trim() || ""}`.trim())}.pdf`, { type: "application/pdf" });
      } finally { host.remove(); }
    };
    const old = btn.textContent; btn.disabled = true; btn.textContent = "Making PDF…";
    try { return await run(); }
    catch (e) { A.flash("simSendNote", "This copy can't make the PDF itself (it was opened from a folder on this computer). Use the web copy (onlyifyouknow.com/pages/capsule-builder), or Copy as text."); return null; }
    finally { btn.disabled = false; btn.textContent = old; }
  }
  const subject = () => `${A.cfg().name}: styles in the stones you asked about`;
  async function emailPDF() {
    const file = await makePDF($("simMail")); const body = followText();
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: subject(), text: body }); A.flash("simSendNote", "Shared. Check the email in your mail app and press Send there."); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    if (file) A.download(file.name, file, "application/pdf");
    const to = (S.email || "").replace(/[\s,;]+/g, ",");
    const a = document.createElement("a");
    a.href = `mailto:${encodeURIComponent(to).replace(/%2C/g, ",").replace(/%40/g, "@")}?subject=${encodeURIComponent(subject())}&body=${encodeURIComponent(body)}`;
    a.target = "_top"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
    A.flash("simSendNote", file ? `Saved <b>${esc(file.name)}</b> to your downloads and opened an email draft. Attach the PDF and press Send. Nothing is sent from here.` : "Opened an email draft with the text. Nothing is sent from here.");
  }
  async function sharePDF() {
    const file = await makePDF($("simShare")), body = followText();
    const data = file && navigator.canShare && navigator.canShare({ files: [file] }) ? { files: [file], title: subject(), text: body } : { title: subject(), text: body };
    if (!navigator.share) { A.copyText(body, "simSendNote", "Sharing isn't available on this device, so the follow-up text was"); if (file) A.download(file.name, file, "application/pdf"); return; }
    navigator.share(data).catch(() => {});
  }

  /* ---------------- mount ---------------- */
  function mount() {
    const pane = $("paneStore"); if (!pane || $("simPane")) return;
    const body = document.createElement("div"); body.id = "ctxBody";
    while (pane.firstChild) body.appendChild(pane.firstChild);
    const bar = document.createElement("div"); bar.className = "st-mode";
    bar.innerHTML = `<div class="seg" id="storeMode"><button data-m="match">Goes with her store</button><button data-m="similar">Find similar · follow up</button></div>`;
    const sp = document.createElement("div"); sp.id = "simPane"; sp.className = "hide";
    pane.append(bar, body, sp);
    bar.querySelectorAll("button").forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
    document.addEventListener("paste", (e) => {
      if (mode !== "similar" || $("paneStore").classList.contains("hide")) return;
      if (/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || "")) return;
      const fs = [...(e.clipboardData ? e.clipboardData.files : [])].filter((f) => /^image\//.test(f.type));
      if (fs.length) { e.preventDefault(); fs.forEach(addPhoto); }
    });
    let m0 = "match"; try { m0 = sessionStorage.getItem("cb_storemode") || "match"; } catch (e) { /* ignore */ }
    if (/[?&]find=similar\b/.test(location.search)) { m0 = "similar"; if (window.CB_PANE) window.CB_PANE("store"); }
    setMode(m0);
  }
  A.hooks.line.push(() => { if (mode === "similar") draw(); });
  mount();
  window.CB_SIMILAR = { setMode, draw, state: () => S, query, describe, followText, followLink: () => followLink(selItems()), buildPage, fit, results: (L) => results(L || A.line(), bought()), bought, moreLike, importOrderCSV };
})();
