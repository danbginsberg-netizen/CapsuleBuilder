/* Capsule Builder UI — runs offline from the local folder. v1.3 */
(function () {
  "use strict";
  const BASE = window.CAPSULE_CONFIG;
  const { Engine, CATS, label } = window.CapsuleEngine;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (v, dp) => "$" + (v || 0).toLocaleString("en-US", { minimumFractionDigits: dp == null ? 2 : dp, maximumFractionDigits: dp == null ? 2 : dp });
  const money0 = (v) => money(v, v >= 1000 ? 0 : 2);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  // order type: "first" or "reorder" (older saved values 6 / 12 map to first order / reorder)
  const normUnits = (v) => (v === "reorder" || String(v) === "12" ? "reorder" : "first");
  const CAT_LABEL = { necklace: "Necklaces", bracelet: "Bracelets", earring: "Earrings" };
  const VOCAB = {
    category: CATS,
    color: ["coral/red", "orange", "yellow", "blush pink", "hot pink", "lavender/purple", "cobalt/navy", "blue", "aqua", "turquoise", "seafoam/mint", "emerald/green", "ivory/pearl", "white", "neutral", "grey", "black", "crystal/clear", "gold", "silver"],
    materials: ["seed bead", "glass bead", "pearl", "mother-of-pearl", "shell", "gemstone", "crystal/CZ", "enamel", "resin/epoxy", "acrylic", "ceramic/clay", "metal", "cord/thread"],
    metal: ["gold", "silver", "mixed", "none"],
    motifs: ["heart", "cross/faith", "butterfly", "celestial", "ocean/shell", "floral/botanical", "evil eye", "coin/medallion", "animal print", "bow", "geometric", "letter", "none"],
    style: ["boho", "coastal", "classic pearl", "statement", "minimal", "retro/vintage", "playful", "glam"],
    scale: ["delicate", "medium", "statement"],
  };
  const SOURCES = { RF: window.CATALOG_RF, OIYK: window.CATALOG_OIYK };
  const LIB_KEY = "capsule_library_v1";

  /* ================================================= CSV helpers */
  function parseCSV(text) {
    const rows = []; let row = [], f = "", q = false;
    text = text.replace(/^﻿/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
      else f += c;
    }
    if (f.length || row.length) { row.push(f); rows.push(row); }
    const head = (rows.shift() || []).map((h) => h.trim());
    return rows.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
  }
  const cleanSku = (s) => String(s || "").replace(/^(Necklace|Earrings|Earring|Bracelet)\s+/i, "").trim().toUpperCase();
  const split = (s) => String(s || "").split("|").map((x) => x.trim()).filter(Boolean);
  const csvCell = (v) => { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const fileSafe = (s) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "capsule";
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ================================================= line data */
  let line, cfg, catalog, engine, tagSource, catSource;
  const runtimeFlags = [];
  function applyTags(text) {
    const rows = parseCSV(text);
    const bySku = new Map(catalog.items.map((i) => [i.sku, i]));
    let ok = 0, unknown = 0; const bad = [];
    for (const r of rows) {
      const it = bySku.get(cleanSku(r.sku));
      if (!it) { unknown++; continue; }
      const t = {
        cat: r.category, sub: r.subtype || it.sub, base: r.base_style || it.base, dom: r.dominant_color, fams: split(r.color_families),
        multi: /^y/i.test(r.is_multicolor || ""), mats: split(r.materials), metal: r.metal_tone,
        motifs: split(r.motifs).filter((m) => m !== "none"), style: r.style_family, scale: r.scale, avail: (r.available || "").toLowerCase(),
        notes: r.notes || "", collection: r.collection != null ? r.collection : it.collection, sisters: r.sisters != null ? split(r.sisters) : it.sisters,
      };
      const probs = [];
      if (!VOCAB.category.includes(t.cat)) probs.push("category " + t.cat);
      if (t.dom !== "multicolor" && !VOCAB.color.includes(t.dom)) probs.push("dominant_color " + t.dom);
      t.fams.forEach((f) => VOCAB.color.includes(f) || probs.push("color " + f));
      t.mats.forEach((m) => VOCAB.materials.includes(m) || probs.push("material " + m));
      if (!VOCAB.metal.includes(t.metal)) probs.push("metal_tone " + t.metal);
      t.motifs.forEach((m) => VOCAB.motifs.includes(m) || probs.push("motif " + m));
      if (!VOCAB.style.includes(t.style)) probs.push("style_family " + t.style);
      if (!VOCAB.scale.includes(t.scale)) probs.push("scale " + t.scale);
      if (probs.length) { bad.push(it.sku + ": " + probs.join(", ")); continue; }
      if (t.dom === "multicolor") t.multi = true;
      if (!t.fams.length) t.fams = [t.dom];
      Object.assign(it, t); ok++;
    }
    return { ok, bad, unknown, rows: rows.length };
  }
  function applyCatalog(text) {
    const rows = parseCSV(text);
    const bySku = new Map(catalog.items.map((i) => [i.sku, i]));
    let ok = 0; const fresh = [];
    const pick = (r, keys) => { for (const k of keys) if (r[k] != null && r[k] !== "") return r[k]; return null; };
    const num = (v) => (v == null ? NaN : parseFloat(String(v).replace(/[$,]/g, "")));
    for (const r of rows) {
      const sku = cleanSku(pick(r, ["SKU", "sku", "Variant SKU"]));
      if (!sku) continue;
      const it = bySku.get(sku);
      if (!it) { fresh.push(sku); continue; }
      const q = pick(r, ["Qty", "On Hand Inventory", "Variant Inventory Qty", "Inventory"]);
      const ws = pick(r, ["New WS", "USD Unit Wholesale Price", "WS 1-pcs Price", "Wholesale Price"]);
      const nm = pick(r, ["Product name", "Product Name (English)", "Title"]);
      if (q != null && !isNaN(num(q)) && !it.mto) it.qty = parseInt(q, 10);
      if (!isNaN(num(ws))) it.ws = num(ws);
      if (nm) it.name = nm;
      ok++;
    }
    return { ok, fresh, rows: rows.length };
  }
  function loadLine(L) {
    line = L;
    cfg = Object.assign({}, BASE, BASE.lines[L] || {});
    const src = SOURCES[L];
    catalog = { line: src.line, built: src.built, tagFile: src.tagFile, flags: src.flags.slice(), items: src.items.map((i) => Object.assign({}, i)) };
    tagSource = `built-in tags (${src.tagFile}, built ${src.built})`;
    catSource = "built-in catalog";
    runtimeFlags.length = 0;
    const t = store.get(`capsule_${L}_tags_csv`, null);
    if (t) { const r = applyTags(t); tagSource = `your reviewed tag CSV (${r.ok} SKUs, loaded earlier)`; }
    const c = store.get(`capsule_${L}_catalog_csv`, null);
    if (c) { const r = applyCatalog(c); catSource = `your catalog CSV (${r.ok} SKUs updated, loaded earlier)`; }
    const op = (window.ORDER_PAGE || {})[L];
    if (cfg.orderPage && op) {
      cfg.orderPage = Object.assign({}, cfg.orderPage, { skus: op.skus });
      const listed = new Set(op.skus), off = catalog.items.filter((i) => !listed.has(String(i.sku).toUpperCase())).map((i) => i.sku);
      if (off.length) runtimeFlags.push({ sku: `(${off.length} SKUs)`, issue: `Not on the wholesale order page, so capsules don't pick them (a buyer's own pick still works but can't be pre-filled): ${off.join(", ")}. Add them to the order page, then re-run tools/sync_order_page.py.` });
    }
    engine = new Engine(catalog, cfg);
    $("brandLogo").src = cfg.logo;
    $("orderPageBtn").classList.toggle("hide", !cfg.orderPage);
    $("shOrderLabel").textContent = cfg.orderPage ? "Order link + QR code (opens our order page pre-filled)" : "Order form page";
    document.querySelectorAll(".lines button").forEach((b) => b.classList.toggle("on", b.dataset.line === L));
    store.set("capsule_line", L);
  }

  /* ================================================= state */
  const saved = store.get("capsule_ui", {});
  const state = {
    anchors: [null, null], buyer: saved.buyer || "", capName: saved.capName || "", capNameEdited: !!saved.capNameEdited,
    mode: saved.mode || "pieces", size: saved.size || BASE.defaultSize, counts: null,
    budget: saved.budget || null, units: normUnits(saved.units),
    story: !!saved.story, showScores: !!saved.showScores, minQty: null,
    sheet: sheetDefaults(saved.sheet, saved.markPick),
    capsule: null, locked: new Set(), halves: new Set(), lastMs: 0, loadedId: null,
  };
  function sheetDefaults(s, markPick) {
    const d = JSON.parse(JSON.stringify(BASE.lineSheet.defaults || {}));
    d.markPick = markPick != null ? markPick : BASE.lineSheet.markBuyerPick; d.note = "";
    s = s || {};
    const out = Object.assign(d, s, { fields: Object.assign(d.fields || {}, s.fields || {}) });
    out.fields.wholesale = false;   // no prices by default: wholesale is ticked per sheet (saved capsules keep their own setting)
    return out;
  }
  const persist = () => store.set("capsule_ui", {
    buyer: state.buyer, capName: state.capName, capNameEdited: state.capNameEdited, mode: state.mode, size: state.size,
    budget: state.budget, units: state.units, story: state.story, showScores: state.showScores, sheet: state.sheet,
    [`anchors_${line}`]: state.anchors, [`counts_${line}`]: state.counts, [`minQty_${line}`]: state.minQty,
  });
  const anchorItems = () => state.anchors.filter(Boolean).map((s) => engine.bySku.get(s)).filter(Boolean);
  const capTitle = () => state.capName.trim() || (state.buyer.trim() ? `Curated for ${state.buyer.trim()}` : "Curated capsule");
  // "first" = the buyer's first order (line minimum per style, with exceptions); "reorder" = a dozen per style
  const HT = () => engine.halfTerms();   // Retro Forever: sold by the dozen, a few styles may be a half dozen on a first order
  const firstDesc = () => HT() ? `by the dozen, up to ${HT().maxStyles} styles at ½ dozen` : `${cfg.terms.firstOrderUnits}/style${Object.keys(cfg.terms.firstOrderExceptions || {}).length ? ", 3–6 on baroque pearl & scarf styles" : ""}`;
  // "1 dozen" / "½ dozen" on dozen-sold lines, "12 pcs" elsewhere
  const qtyWord = (n) => (HT() ? (n === 6 ? "½ dozen" : n % 12 === 0 ? `${n / 12} dozen` : `${n} pcs`) : `${n} pcs`);
  const syncHalves = () => { engine.halfSet = state.halves; };
  const unitsLabel = (u) => (u === "first" ? `first order (${firstDesc()})` : u === "reorder" ? `reorder (${engine.reorderUnits()}/style)` : `${u} per style`);
  const minFor = (it) => engine.unitsFor(it, activeUnits() === "reorder" ? "reorder" : "first");

  function switchLine(L, keep) {
    loadLine(L);
    const s = store.get("capsule_ui", {});
    state.anchors = keep ? state.anchors : (s[`anchors_${L}`] || [null, null]).map((x) => (x && engine.bySku.has(x) ? x : null));
    state.counts = keep ? state.counts : s[`counts_${L}`] || null;
    state.minQty = s[`minQty_${L}`] != null ? s[`minQty_${L}`] : cfg.minQty;
    if (!keep) { state.capsule = null; state.locked.clear(); state.halves = new Set(); state.loadedId = null; }
    syncHalves();
    $("minQty").value = state.minQty;
    $("minQtyRow").classList.toggle("hide", line === "OIYK");
    drawPresets(); drawUnits();
    renderSlot(0); renderSlot(1);
    resetMix(false);
    renderStatus(); renderLib();
    $("buildBtn").disabled = !state.anchors[0];
    if (!keep) { if (state.anchors[0]) build(); else clearBoard(); }
  }

  /* ================================================= anchor slots */
  function renderSlot(i) {
    const el = $("slot" + i);
    const sku = state.anchors[i];
    if (sku && engine.bySku.has(sku)) {
      const it = engine.bySku.get(sku);
      const low = !engine.inStock(it, state.minQty);
      const stock = it.mto ? "made to order" : `${it.qty} in stock${low ? " · below stock rule" : ""}`;
      el.innerHTML = `<div class="anchor-chip"><img src="${esc(it.img)}" alt=""><div class="t"><b>${esc(it.sku)}</b><span>${esc(it.name)}</span><span class="${low ? "warn" : ""}">${wsShort(it)} WS · ${stock}</span></div><button class="x" title="Clear">✕</button></div>`;
      el.querySelector(".x").onclick = () => { state.anchors[i] = null; if (i === 0 && state.anchors[1]) state.anchors = [state.anchors[1], null]; onAnchorsChanged(); };
      return;
    }
    el.innerHTML = `<input type="search" placeholder="${i === 0 ? "Type SKU or name…" : "Optional second pick…"}" autocomplete="off"><div class="results" hidden></div>`;
    const inp = el.querySelector("input"), res = el.querySelector(".results");
    let hits = [], hi = 0;
    const draw = () => {
      if (!hits.length) { res.hidden = true; return; }
      res.hidden = false;
      res.innerHTML = hits.map((it, k) => `<div data-k="${k}" class="${k === hi ? "hi" : ""}"><img src="${esc(it.img)}" alt=""><span><b>${esc(it.sku)}</b><br>${esc(it.name)}</span><span class="q">${wsShort(it)}</span></div>`).join("");
      res.querySelectorAll("div[data-k]").forEach((d) => (d.onmousedown = (e) => { e.preventDefault(); setAnchor(i, hits[+d.dataset.k].sku); }));
    };
    inp.oninput = () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) { hits = []; draw(); return; }
      const toks = q.split(/\s+/);
      hits = catalog.items.filter((it) => toks.every((t) => (it.sku + " " + it.name + " " + it.dom + " " + it.style + " " + (it.collection || "")).toLowerCase().includes(t))).slice(0, 30);
      hi = 0; draw();
    };
    inp.onkeydown = (e) => {
      if (e.key === "ArrowDown") { hi = Math.min(hi + 1, hits.length - 1); draw(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { hi = Math.max(hi - 1, 0); draw(); e.preventDefault(); }
      else if (e.key === "Enter" && hits[hi]) setAnchor(i, hits[hi].sku);
      else if (e.key === "Escape") { hits = []; draw(); }
    };
    inp.onblur = () => setTimeout(() => (res.hidden = true), 150);
  }
  function setAnchor(i, sku) {
    if (i === 1 && !state.anchors[0]) i = 0;
    if (state.anchors.includes(sku)) return;
    state.anchors[i] = sku;
    onAnchorsChanged();
  }
  function onAnchorsChanged() {
    renderSlot(0); renderSlot(1);
    state.locked.clear(); state.halves = new Set(); syncHalves();
    resetMix(false);
    $("buildBtn").disabled = !state.anchors[0];
    persist();
    if (state.anchors[0]) build(); else clearBoard();
  }

  /* ================================================= size / budget / mix */
  const sum = (c) => c.necklace + c.bracelet + c.earring;
  const anchorsFit = (c) => state.mode === "budget" || anchorItems().every((a) => c[a.cat] >= anchorItems().filter((x) => x.cat === a.cat).length);
  function resetMix(fromUser) {
    if (!fromUser && state.counts && (state.mode === "budget" || sum(state.counts) === state.size) && anchorsFit(state.counts)) { drawMix(); return; }
    const c = engine.mixCounts(state.size, cfg.mix, anchorItems());
    state.counts = { necklace: c.necklace, bracelet: c.bracelet, earring: c.earring };
    drawMix();
  }
  function drawMix() {
    $("size").value = state.size; $("sizeOut").textContent = state.size;
    $("size").min = cfg.minSize; $("size").max = cfg.maxSize;
    $("mN").value = state.counts.necklace; $("mB").value = state.counts.bracelet; $("mE").value = state.counts.earring;
    const t = sum(state.counts) || 1;
    if (state.mode === "budget") {
      $("mixNote").textContent = `Budget mode uses these as proportions: ${Math.round((100 * state.counts.necklace) / t)}% / ${Math.round((100 * state.counts.bracelet) / t)}% / ${Math.round((100 * state.counts.earring) / t)}%. The budget decides how many styles.`;
    } else {
      const fit = anchorsFit(state.counts);
      $("mixNote").innerHTML = `${state.counts.necklace} / ${state.counts.bracelet} / ${state.counts.earring} = ${sum(state.counts)} styles · buyer’s picks count toward (and show in) their own category` + (fit ? "" : ` <span class="warn">— add a slot for each anchor's category</span>`);
    }
  }
  function drawPresets() {
    $("presetChips").innerHTML = (cfg.budgetPresets || []).map((p) => `<button data-amt="${p.amount}" class="${state.budget === p.amount ? "on" : ""}" title="${esc(p.note)}">${esc(p.label)}<small>${esc(p.note)}</small></button>`).join("");
    $("presetChips").querySelectorAll("button").forEach((b) => (b.onclick = () => { setBudget(+b.dataset.amt); }));
    $("budget").value = state.budget || "";
  }
  function drawUnits() {
    const ex = Object.keys(cfg.terms.firstOrderExceptions || {}).length;
    const opts = [["first", HT() ? `First order — by the dozen, up to ${HT().maxStyles} styles at ½ dozen` : `First order — ${cfg.terms.firstOrderUnits} per style${ex ? " (3–6 on baroque pearl & scarf styles)" : ""}`], ["reorder", `Reorder — ${engine.reorderUnits()} per style (buyer has ordered before)`]];
    $("units").innerHTML = opts.map(([v, t]) => `<option value="${v}" ${String(state.units) === String(v) ? "selected" : ""}>${t}</option>`).join("");
  }
  function setMode(m) {
    state.mode = m;
    $("modePieces").classList.toggle("on", m === "pieces"); $("modeBudget").classList.toggle("on", m === "budget");
    $("piecesBox").classList.toggle("hide", m !== "pieces"); $("budgetBox").classList.toggle("hide", m !== "budget");
    if (m === "budget" && !state.budget) state.budget = (cfg.budgetPresets || [])[2] ? cfg.budgetPresets[2].amount : 300;
    drawPresets(); drawMix(); persist();
    if (state.anchors[0]) build();
  }
  function setBudget(v) {
    state.budget = v; if (state.mode !== "budget") { setMode("budget"); return; }
    drawPresets(); persist(); if (state.anchors[0]) build();
  }

  /* ================================================= build + board */
  function mixShares() { const t = sum(state.counts) || 1; return { necklace: state.counts.necklace / t, bracelet: state.counts.bracelet / t, earring: state.counts.earring / t }; }
  function build(extra) {
    if (!state.anchors[0]) return;
    if (!anchorsFit(state.counts)) { drawMix(); return; }
    const t0 = performance.now();
    syncHalves();
    const common = { colorwayStory: state.story, minQty: state.minQty, locked: [...state.locked], units: state.units };
    if (state.mode === "budget") {
      state.capsule = engine.buildBudget(state.anchors.filter(Boolean), Object.assign({ budget: state.budget || 300, mix: mixShares(), halves: [...state.halves] }, common, extra || {}));
      state.halves = new Set(state.capsule.halves || []);
    } else {
      state.capsule = engine.build(state.anchors.filter(Boolean), Object.assign({ counts: state.counts, size: sum(state.counts) }, common, extra || {}));
      const inCap = new Set(allItems().map((it) => it.sku));   // a rep's half-dozen switches stay on pieces still in the capsule
      state.halves = new Set([...state.halves].filter((s) => inCap.has(s)));
    }
    syncHalves();
    state.lastMs = Math.round(performance.now() - t0);
    ["regenBtn", "anotherBtn", "sheetBtn", "xlsxBtn", "orderPageBtn", "csvBtn", "saveBtn", "saveNewBtn"].forEach((id) => ($(id).disabled = false));
    renderBoard();
  }
  function clearBoard() {
    state.capsule = null;
    $("board").innerHTML = '<div class="empty"><b>One piece in, a capsule out.</b>Search or browse for the buyer\'s favorite, then build — by number of pieces or by the buyer\'s budget.</div>';
    $("econ").innerHTML = ""; $("boardTitle").textContent = "Capsule Builder"; $("boardMeta").textContent = `${cfg.name} · pick the piece the buyer liked to start.`;
    ["regenBtn", "anotherBtn", "sheetBtn", "xlsxBtn", "orderPageBtn", "csvBtn", "saveBtn", "saveNewBtn"].forEach((id) => ($(id).disabled = true));
  }
  const activeUnits = () => state.units;   // the order type applies in both build modes
  // short wholesale label: flat price, or dozen-to-smallest-order range on tiered lines
  function wsShort(it) {
    if (!tiered()) return money(it.ws);
    const br = engine.priceBreaks(it);
    return br.length > 1 ? `${money(br[br.length - 1].each)}–${money(br[0].each)}` : money(br[0].each);
  }
  function priceLine(it) {
    const f = engine.lineCost(it, "first"), r = engine.lineCost(it, "reorder");
    if (HT()) return `WS ${money(it.ws)} · ${activeUnits() === "reorder" ? `reorder ${qtyWord(r.units)} = ${money0(r.total)}` : `first order ${qtyWord(f.units)} = ${money0(f.total)}${f.units !== r.units ? ` · reorder ${qtyWord(r.units)} = ${money0(r.total)}` : ""}`}`;
    const orders = f.units === r.units ? `min ${f.units} = ${money0(f.total)}` : `first order ${f.units} = ${money0(f.total)} · reorder ${r.units} = ${money0(r.total)}`;
    if (tiered()) return `WS/pc ${engine.priceBreaks(it, activeUnits()).map((b) => `${b.units}+ ${money(b.each)}`).join(" · ")}<br>${orders}`;
    return `WS ${money(it.ws)} · ${orders}`;
  }
  function cardHTML(it, e, isAnchor, idx) {
    const scoreBit = state.showScores && e ? `<span class="score">${e.score.toFixed(1)}</span>` : "";
    const attrs = state.showScores ? `<div class="attrs">${esc(label(it.dom))}${it.multi ? " (multi)" : ""} · ${esc(label(it.style))} · ${esc(it.scale)} · ${esc(label(it.sub))}${it.motifs.length ? " · " + esc(it.motifs.map(label).join(", ")) : ""}${it.collection ? " · " + esc(it.collection) : ""}${it.mto ? "" : " · qty " + it.qty}</div>` : "";
    const why = isAnchor ? (anchorItems().length > 1 ? `Buyer's pick ${idx + 1}.` : "The buyer's pick — everything else is chosen to go with it.") : e.reason;
    const locked = !isAnchor && state.locked.has(it.sku);
    const stale = e && e.stale ? `<div class="px stale">No longer passes the stock rule — swap it</div>` : "";
    return `<div class="card ${isAnchor ? "anchor" : ""}" data-sku="${esc(it.sku)}">
      <div class="im"><img src="${esc(it.img)}" alt="${esc(it.name)}" loading="lazy">${isAnchor ? `<span class="tag">${anchorItems().length > 1 ? "Pick " + (idx + 1) : "Anchor"}</span>` : ""}${locked ? `<span class="tag lock">Locked</span>` : ""}${it.lowres ? `<span class="tag lr">Low-res image</span>` : ""}</div>
      <div class="b"><div class="sku"><span>${esc(it.sku)}</span>${scoreBit}</div><div class="nm">${esc(it.name)}</div><div class="px">${priceLine(it)}</div>${stale}<div class="why">${esc(why)}</div>${attrs}
      ${halfHTML(it)}
      ${isAnchor ? "" : `<div class="acts"><button data-act="swap">Swap</button><button data-act="lock" class="${locked ? "on" : ""}">${locked ? "Unlock" : "Lock"}</button></div>`}</div></div>`;
  }
  // dozen / half-dozen switch on each card (dozen-sold lines, first orders only)
  function halfHTML(it) {
    if (!HT()) return "";
    if (activeUnits() === "reorder") return engine.halfOnly(it) ? `<div class="half only warn">Only ${it.qty} in stock — not enough for a reorder dozen</div>` : "";
    if (engine.halfOnly(it)) return `<div class="half only">½ dozen only · ${it.qty} in stock</div>`;
    const on = state.halves.has(it.sku);
    const full = !on && engine.halfCount(allItems()) >= HT().maxStyles;
    return `<div class="half"><button data-act="half" class="${on ? "on" : ""}" ${full ? `disabled title="A first order takes at most ${HT().maxStyles} styles at ½ dozen"` : ""}>${on ? "½ dozen · make it 1 dozen" : "Make it ½ dozen"}</button></div>`;
  }
  function allItems() { return state.capsule.anchors.concat(state.capsule.picks.map((p) => p.item)); }
  function renderEcon() {
    const cap = state.capsule;
    const items = allItems();
    const u = activeUnits();
    const eco = engine.economics(items, u);
    const min = eco.orderMinimum;
    const cur = u === "reorder" ? eco.reorder : eco.first;
    const markup = cur.total ? cur.retail / cur.total : 0;
    const minOk = cur.total >= min;
    let h = `<div class="econ">
      <div class="tile"><div class="k">Styles</div><div class="v">${eco.styles}</div><div class="s">${cap.counts.necklace} N · ${cap.counts.bracelet} B · ${cap.counts.earring} E</div></div>
      <div class="tile"><div class="k">Wholesale per piece</div><div class="v">${money(eco.avgEach)}</div><div class="s">avg at ${esc(u === "reorder" ? "reorder" : "first order")} · range ${money(eco.minEach)}–${money(eco.maxEach)}${eco.tiered ? " · priced by quantity" : ""}</div></div>
      <div class="tile hl"><div class="k">${u === "reorder" ? "Reorder" : "First order"}</div><div class="v">${money0(cur.total)}</div><div class="s">${cur.units} pcs · ${esc(u === "reorder" ? engine.reorderUnits() + "/style" : HT() ? `${eco.styles - eco.halves} of ${eco.styles} styles by the dozen · ${eco.halves} of ${eco.halfCap} ½ dozen` : firstDesc())} · <span class="${minOk ? "ok" : "bad"}">${minOk ? "clears" : "below"} ${money(min, 0)} min</span></div></div>
      <div class="tile"><div class="k">Retail value (MSRP)</div><div class="v">${money0(cur.retail)}</div><div class="s">${markup.toFixed(2)}x the buyer's cost at ${esc(unitsLabel(u))}</div></div>`;
    if (cap.budget) {
      const b = cap.budget, pct = Math.min(100, (100 * b.spent) / (b.budget || 1));
      h += `<div class="tile hl"><div class="k">Budget ${money0(b.budget)}</div><div class="v">${money0(b.spent)}</div><div class="s">${b.remaining >= 0 ? money0(b.remaining) + " left" : money0(-b.remaining) + " over"} · ${esc(unitsLabel(b.units))}</div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
    }
    h += `</div>`;
    if (cap.budget && cap.budget.note) h += `<div class="short">${esc(cap.budget.note)}</div>`;
    if (!minOk && !cap.budget) h += `<div class="short">This capsule is below the ${money(min, 0)} order minimum at ${esc(unitsLabel(u))}.</div>`;
    // budget ladder for this anchor
    const ladder = (cfg.budgetPresets || []).map((p) => {
      const c = engine.buildBudget(state.anchors.filter(Boolean), { budget: p.amount, units: activeUnits(), mix: mixShares(), colorwayStory: state.story, minQty: state.minQty });
      return `<a class="link" data-amt="${p.amount}">${esc(p.label)}</a>: <b>${c.anchors.length + c.picks.length} style${c.anchors.length + c.picks.length === 1 ? "" : "s"}</b> (${money0(c.budget.spent)})`;
    });
    h += `<div class="ladder">Around this pick, by budget at ${esc(unitsLabel(activeUnits()))}: ${ladder.join(" · ")} · <a class="link" id="guideLink2">what do buyers spend?</a></div>`;
    $("econ").innerHTML = h;
    $("econ").querySelectorAll("a[data-amt]").forEach((a) => (a.onclick = () => setBudget(+a.dataset.amt)));
    $("guideLink2").onclick = openGuide;
  }
  function renderBoard() {
    const cap = state.capsule;
    syncHalves();
    $("boardTitle").textContent = capTitle();
    const total = cap.anchors.length + cap.picks.length;
    $("boardMeta").textContent = `${cfg.name} · ${total} styles · built in ${state.lastMs} ms` + (state.buyer ? ` · buyer: ${state.buyer}` : "") + (state.loadedId ? " · saved capsule" : "");
    renderEcon();
    // each category shows every piece it holds — the buyer's pick(s) first, tagged — so the count matches the mix
    let h = "";
    for (const c of CATS) {
      const ps = cap.picks.filter((p) => p.item.cat === c);
      const as = cap.anchors.map((a, i) => [a, i]).filter(([a]) => a.cat === c);
      if (!ps.length && !as.length) continue;
      const n = ps.length + as.length;
      h += `<section class="group"><h2>${CAT_LABEL[c]} <span class="pill">${n}${as.length ? ` incl. buyer's pick${as.length > 1 ? "s" : ""}` : ""}</span></h2><div class="grid">${as.map(([a, i]) => cardHTML(a, null, true, i)).join("")}${ps.map((p) => cardHTML(p.item, p, false)).join("")}</div></section>`;
    }
    const sh = Object.entries(cap.short || {});
    if (sh.length) h += `<div class="short">Not enough matches to fill: ${sh.map(([c, n]) => `${n} ${c}${n > 1 ? "s" : ""}`).join(", ")}. Lower the stock rule, change the mix, or turn on Colorway story.</div>`;
    if (cap.missing && cap.missing.length) h += `<div class="short">No longer in the catalog: ${esc(cap.missing.join(", "))}.</div>`;
    $("board").innerHTML = h;
    $("board").querySelectorAll(".card [data-act]").forEach((b) => {
      const sku = b.closest(".card").dataset.sku;
      b.onclick = () => (b.dataset.act === "swap" ? openSwap(sku) : b.dataset.act === "half" ? toggleHalf(sku) : toggleLock(sku));
    });
  }
  function toggleLock(sku) { state.locked.has(sku) ? state.locked.delete(sku) : state.locked.add(sku); renderBoard(); }
  function toggleHalf(sku) {
    const H = HT(); if (!H) return;
    if (state.halves.has(sku)) state.halves.delete(sku);
    else if (engine.halfCount(allItems()) < H.maxStyles) state.halves.add(sku);
    syncHalves(); recalcBudget(); renderBoard();
  }
  function recalcBudget() {
    const cap = state.capsule;
    if (!cap.budget) return;
    const spent = allItems().reduce((a, it) => a + engine.lineCost(it, cap.budget.units).total, 0);
    Object.assign(cap.budget, { spent, remaining: cap.budget.budget - spent, note: "" });
    cap.counts = { necklace: 0, bracelet: 0, earring: 0 }; allItems().forEach((it) => cap.counts[it.cat]++);
  }

  /* ================================================= swap */
  // Swap: every other piece in the category that still fits the capsule's rules, best match first, three at a time
  const swapState = { sku: null, list: [], page: 0 };
  function openSwap(sku) {
    const cap = state.capsule;
    const cur = cap.picks.find((p) => p.item.sku === sku);
    swapState.sku = sku; swapState.page = 0;
    swapState.list = engine.alternatives(cap, sku, Infinity);
    $("altTitle").textContent = `Swap ${cur.item.sku} — next best ${cur.item.cat}s`;
    drawSwap();
    openDlg("altDlg");
  }
  function drawSwap() {
    const cap = state.capsule, sku = swapState.sku, list = swapState.list, per = 3;
    const pages = Math.max(1, Math.ceil(list.length / per));
    swapState.page = Math.min(Math.max(0, swapState.page), pages - 1);
    const from = swapState.page * per, shown = list.slice(from, from + per);
    $("alts").innerHTML = shown.length ? shown.map((e, k) => {
      if (!e.reason) e.reason = engine.reason(cap.anchors, e.item, e.sc);
      return cardHTML(e.item, e, false)
        .replace('<div class="im">', `<div class="im"><span class="rank">#${from + k + 1}</span>`)
        .replace(/<div class="acts">[\s\S]*?<\/div><\/div><\/div>$/, `<div class="acts"><button data-use="${esc(e.item.sku)}">Use this</button></div></div></div>`);
    }).join("") : '<div class="note">No other pieces in this category pass the rules.</div>';
    $("altInfo").textContent = list.length ? `${from + 1}–${from + shown.length} of ${list.length}, best match first` : "";
    $("altPrev").disabled = swapState.page === 0;
    $("altNext").disabled = swapState.page >= pages - 1;
    $("alts").querySelectorAll("[data-use]").forEach((b) => (b.onclick = () => {
      engine.swap(cap, sku, b.dataset.use); state.locked.delete(sku); state.locked.add(b.dataset.use);
      recalcBudget(); closeDlg("altDlg"); renderBoard();
    }));
  }
  $("altPrev").onclick = () => { swapState.page--; drawSwap(); };
  $("altNext").onclick = () => { swapState.page++; drawSwap(); };
  document.addEventListener("keydown", (e) => {
    if (!$("altDlg").classList.contains("open")) return;
    if (e.key === "ArrowRight" && !$("altNext").disabled) { swapState.page++; drawSwap(); }
    if (e.key === "ArrowLeft" && !$("altPrev").disabled) { swapState.page--; drawSwap(); }
  });

  /* ================================================= browse */
  const bf = { cat: "all", col: "all" };
  let browseTarget = 0;
  function renderBrowse() {
    const q = $("bq").value.trim().toLowerCase();
    const cats = ["all"].concat(CATS), cols = ["all", "multicolor"].concat(VOCAB.color);
    $("bfCat").innerHTML = cats.map((c) => `<button data-c="${c}" class="${bf.cat === c ? "on" : ""}">${c === "all" ? "All categories" : CAT_LABEL[c]}</button>`).join("");
    $("bfCol").innerHTML = cols.map((c) => `<button data-c="${c}" class="${bf.col === c ? "on" : ""}">${c === "all" ? "All colors" : esc(label(c))}</button>`).join("");
    $("bfCat").querySelectorAll("button").forEach((b) => (b.onclick = () => { bf.cat = b.dataset.c; renderBrowse(); }));
    $("bfCol").querySelectorAll("button").forEach((b) => (b.onclick = () => { bf.col = b.dataset.c; renderBrowse(); }));
    const list = catalog.items.filter((it) => (bf.cat === "all" || it.cat === bf.cat) && (bf.col === "all" || it.dom === bf.col || (bf.col !== "multicolor" && it.fams.includes(bf.col)))
      && (!q || (it.sku + " " + it.name + " " + (it.collection || "")).toLowerCase().includes(q)));
    $("browseGrid").innerHTML = list.map((it) => `<div data-sku="${esc(it.sku)}" class="${engine.inStock(it, state.minQty) ? "" : "out"}" title="${esc(it.name)}"><img src="${esc(it.img)}" loading="lazy" alt=""><b>${esc(it.sku)}</b><br>${esc(it.name)}<br><span style="color:var(--lav-ink)">${wsShort(it)}</span></div>`).join("") || '<div class="note">No matches.</div>';
    $("browseGrid").querySelectorAll("div[data-sku]").forEach((d) => (d.onclick = () => { setAnchor(browseTarget, d.dataset.sku); closeDlg("browseDlg"); }));
  }

  /* ================================================= saved capsules */
  const lib = () => store.get(LIB_KEY, []);
  const setLib = (l) => store.set(LIB_KEY, l);
  function summaryOf() {
    const eco = engine.economics(allItems(), activeUnits());
    const cur = activeUnits() === "reorder" ? eco.reorder : eco.first;
    return { styles: eco.styles, total: Math.round(cur.total * 100) / 100, units: cur.units, basis: activeUnits() };
  }
  function recordFromState(id) {
    return {
      id, line, buyer: state.buyer.trim(), capName: capTitle(), anchors: state.anchors.filter(Boolean),
      picks: state.capsule.picks.map((p) => p.item.sku), locked: [...state.locked], halves: [...state.halves], mode: state.mode, size: state.size,
      counts: state.counts, budget: state.budget, units: state.units, story: state.story, minQty: state.minQty,
      savedAt: new Date().toISOString(), summary: summaryOf(), sheet: JSON.parse(JSON.stringify(state.sheet)),
    };
  }
  function saveCapsule(asNew) {
    if (!state.capsule) return;
    const l = lib();
    const i = !asNew && state.loadedId ? l.findIndex((r) => r.id === state.loadedId) : -1;
    const id = i >= 0 ? state.loadedId : "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const rec = recordFromState(id);
    if (i >= 0) l[i] = rec; else l.push(rec);
    if (!setLib(l)) { $("libNote").innerHTML = '<span class="warn">Could not save — this browser is blocking local storage.</span>'; return; }
    state.loadedId = id;
    renderLib(`Saved “${esc(rec.capName)}”.`);
    renderBoard();
  }
  function renderLib(msg) {
    const l = lib().slice().sort((a, b) => (a.buyer || "~").localeCompare(b.buyer || "~") || b.savedAt.localeCompare(a.savedAt));
    const groups = {};
    l.forEach((r) => (groups[r.buyer || "(no buyer name)"] = groups[r.buyer || "(no buyer name)"] || []).push(r));
    let h = `<option value="">${l.length ? "— Open a saved capsule —" : "No saved capsules yet"}</option>`;
    for (const [b, rs] of Object.entries(groups)) {
      h += `<optgroup label="${esc(b)}">` + rs.map((r) => {
        const d = new Date(r.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const s = r.summary || {};
        return `<option value="${esc(r.id)}" ${r.id === state.loadedId ? "selected" : ""}>${esc(r.capName)} · ${esc(r.line)} · ${s.styles || "?"} styles · ${money0(s.total || 0)} · ${d}</option>`;
      }).join("") + `</optgroup>`;
    }
    $("libSel").innerHTML = h;
    $("delBtn").disabled = !state.loadedId;
    $("delBtn").textContent = "Delete"; $("delBtn").dataset.arm = "";
    const last = store.get("capsule_library_backup", null);
    $("libNote").innerHTML = (msg ? msg + " " : "") + `${l.length} saved in this browser.` + (l.length ? ` ${last ? "Last backup " + new Date(last).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + "." : "Not backed up yet."}` : "");
  }
  function openRecord(id) {
    const r = lib().find((x) => x.id === id);
    if (!r) return;
    if (r.line !== line) loadLine(r.line);
    Object.assign(state, {
      buyer: r.buyer || "", capName: r.capName || "", capNameEdited: true, mode: r.mode || "pieces", size: r.size || BASE.defaultSize,
      counts: r.counts, budget: r.budget, units: normUnits(r.units), story: !!r.story, minQty: r.minQty != null ? r.minQty : cfg.minQty, loadedId: r.id,
    });
    state.anchors = [r.anchors[0] || null, r.anchors[1] || null];
    state.locked = new Set(r.locked || []);
    state.halves = new Set(r.halves || []); syncHalves();
    if (r.sheet) state.sheet = Object.assign(sheetDefaults(), r.sheet, { fields: Object.assign(sheetDefaults().fields, r.sheet.fields || {}) });
    $("buyer").value = state.buyer; $("capName").value = state.capName; $("story").checked = state.story; $("minQty").value = state.minQty;
    $("minQtyRow").classList.toggle("hide", line === "OIYK");
    $("modePieces").classList.toggle("on", state.mode === "pieces"); $("modeBudget").classList.toggle("on", state.mode === "budget");
    $("piecesBox").classList.toggle("hide", state.mode !== "pieces"); $("budgetBox").classList.toggle("hide", state.mode !== "budget");
    drawPresets(); drawUnits(); drawMix(); renderSlot(0); renderSlot(1); renderStatus();
    const t0 = performance.now();
    state.capsule = engine.restore(r.anchors, r.picks, { colorwayStory: state.story, minQty: state.minQty });
    if (state.mode === "budget") { state.capsule.budget = { budget: state.budget, units: state.units }; recalcBudget(); }
    state.lastMs = Math.round(performance.now() - t0);
    ["regenBtn", "anotherBtn", "sheetBtn", "xlsxBtn", "orderPageBtn", "csvBtn", "saveBtn", "saveNewBtn"].forEach((x) => ($(x).disabled = false));
    $("buildBtn").disabled = false;
    persist(); renderLib(); renderBoard();
  }
  function newCapsule() {
    state.loadedId = null; state.buyer = ""; state.capName = ""; state.capNameEdited = false;
    state.anchors = [null, null]; state.locked.clear(); state.halves = new Set(); syncHalves(); state.sheet.note = "";
    $("buyer").value = ""; $("capName").value = ""; $("capName").placeholder = capTitle();
    renderSlot(0); renderSlot(1); resetMix(true); persist(); renderLib(); clearBoard();
  }

  /* ================================================= exports */
  function orderedItems() {
    const cap = state.capsule;
    const out = cap.anchors.map((a) => ({ it: a, anchor: true }));
    for (const c of CATS) cap.picks.filter((p) => p.item.cat === c).forEach((p) => out.push({ it: p.item, anchor: false, reason: p.reason }));
    return out;
  }
  function exportCSV() {
    const u = activeUnits();
    const rows = [["capsule_name", "buyer_name", "line", "position", "sku", "category", "product_name", "role", "units_per_style", "wholesale_each", "line_total"]];
    let tot = 0;
    orderedItems().forEach((o, i) => {
      const c = engine.lineCost(o.it, u); tot += c.total;
      rows.push([capTitle(), state.buyer, line, i + 1, o.it.sku, o.it.cat, o.it.name, o.anchor ? "buyer pick" : "capsule", c.units, c.each.toFixed(2), c.total.toFixed(2)]);
    });
    rows.push(["", "", "", "", "", "", "", "TOTAL", "", "", tot.toFixed(2)]);
    download(`${fileSafe(capTitle())}_SKUs.csv`, "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  }
  /* ---------- wholesale order page, pre-filled: ?cart=SKU:dozens,...&store=... ---------- */
  function orderLink() {
    const op = cfg.orderPage;
    if (!op) return null;
    const listed = new Set(op.skus || []), u = activeUnits();
    const parts = [], off = [];
    orderedItems().forEach((o) => {
      const sku = String(o.it.sku).toUpperCase();
      if (op.skus && !listed.has(sku)) { off.push(o.it.sku); return; }
      const units = engine.lineCost(o.it, u).units;
      const q = op.qtyIn === "pieces" ? units : Math.round((units / 12) * 2) / 2;   // RF page takes dozens, OIYK page pieces
      parts.push(`${encodeURIComponent(sku)}:${q}`);
    });
    let url = `${op.url}?cart=${parts.join(",")}`;
    if (u === "reorder") url += "&reorder=1";   // the order page then offers dozen boxes only
    if (state.buyer.trim()) url += `&store=${encodeURIComponent(state.buyer.trim())}`;
    return { url, off, n: parts.length };
  }
  function openOrderPage() {
    const l = orderLink();
    if (!l) return;
    if (l.off.length) alert(`Not on the order page, so left out: ${l.off.join(", ")}. The buyer can email for those.`);
    window.open(l.url, "_blank", "noopener");
  }
  function qrSVG(text) {
    try { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 2, margin: 0, scalable: true }); }
    catch (e) { return ""; }
  }
  function orderBandHTML() {
    const l = orderLink();
    if (!l) return "";
    return `<div class="sh-order"><div class="qr">${qrSVG(l.url)}</div><div class="tx"><b>Order this capsule</b>
      Scan the code or <a href="${esc(l.url)}">click here</a> — our wholesale order page opens with these ${l.n} styles filled in at ${esc(unitsLabel(activeUnits()))}. Adjust quantities there, add your details and submit.
      ${l.off.length ? `<br><i>Not on the order page (email us to add): ${esc(l.off.join(", "))}</i>` : ""}</div></div>`;
  }

  /* ---------- line sheet composer (layouts, cover, sections, fields, terms, order form) ---------- */
  const PAPER = { letter: { w: 8.5, h: 11, css: "letter" }, a4: { w: 8.27, h: 11.69, css: "A4" } };
  const MARGIN = 0.45;
  function sheetOpts() { return state.sheet; }
  function pageDims() {
    const S = sheetOpts(), P = PAPER[S.paper] || PAPER.letter;
    let w = P.w, h = P.h; if (S.orientation === "landscape") [w, h] = [h, w];
    return { w: w - 2 * MARGIN, h: h - 2 * MARGIN, css: `${P.css} ${S.orientation}` };
  }
  const tiered = () => !!(cfg.terms || {}).tiered;
  function wsText(it) {
    const S = sheetOpts();
    if (tiered() && S.fields.tiers) {
      const br = engine.priceBreaks(it, activeUnits());
      return br.map((b) => `${b.units}+ ${money(b.each)}`).join(" · ");
    }
    return money(engine.priceEach(it, 12)) + (tiered() ? " (12+)" : "");
  }
  function itemHTML(o) {
    const S = sheetOpts(), f = S.fields, it = o.it;
    let tx = "";
    if (f.sku) tx += `<div class="s">${esc(it.sku)}</div>`;
    if (f.name) tx += `<div class="n">${esc(it.name)}</div>`;
    if (f.wholesale && it.ws != null) tx += `<div class="p">Wholesale ${wsText(it)}</div>`;
    if (f.msrp && it.msrp) tx += `<div class="p m">MSRP ${money(it.msrp)}</div>`;
    if (f.units) tx += HT() ? `<div class="u">Qty ${qtyWord(minFor(it))}</div>` : `<div class="u">Minimum ${minFor(it)} per style</div>`;
    return `<div class="it"><div class="ph"><img src="${esc(it.img)}" alt="">${o.anchor && S.markPick ? '<span class="yp">Your pick</span>' : ""}</div><div class="tx">${tx}</div></div>`;
  }
  // [label, text] pairs for the terms block and the Excel header, in print order; blank entries are skipped
  function termsRows() {
    const t = cfg.terms || {};
    return [
      ["Minimum", `${money(t.orderMinimum || 0, 0)} on a first order`],
      ["Quantities", activeUnits() === "reorder" ? `Reorder: ${engine.reorderUnits()} pieces per style.` : t.unitsNote],
      ["Pricing", t.tiered ? t.tierNote : ""],
      ["Payment", t.paymentTerms],
      ["Shipping", t.shipping],
      ["Returns", t.returns],
      ["Retail", t.retailNote],
    ].filter((r) => r[1]);
  }
  function termsHTML() {
    return `<div class="sh-terms">${termsRows().map((r) => `<b>${esc(r[0])}</b><span>${esc(r[1])}</span>`).join("")}</div>`;
  }
  const monthStr = () => new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  function fullHead(S) {
    const note = S.note && S.note.trim() ? `<div class="sh-note">${esc(S.note.trim())}</div>` : "";
    return `<div class="sh-head"><img src="${esc(cfg.logo)}" alt="${esc(cfg.name)}"><div class="sh-brand">${esc(cfg.sheetTagline || cfg.name)} · ${esc(monthStr())}</div><div class="sh-title">${esc(capTitle())}</div>${note}<div class="sh-rule"></div></div>`;
  }
  function miniHead(sub) {
    return `<div class="sh-mini"><img src="${esc(cfg.logo)}" alt="${esc(cfg.name)}"><div class="t"><small>${esc(sub || cfg.sheetTagline || cfg.name)}</small>${esc(capTitle())}</div></div>`;
  }
  function newPage(inner) {
    const d = pageDims();
    const el = document.createElement("div");
    el.className = "sheet sheet-" + line.toLowerCase();
    el.style.width = d.w + "in"; el.style.height = d.h + "in";
    el.style.setProperty("--lav", cfg.lineSheet.accent);
    el.innerHTML = inner + `<div class="sh-foot"><span class="l"></span><span class="c">${esc(cfg.lineSheet.contactLine)}</span><span class="r"></span></div>`;
    return el;
  }
  // size the photos on one product page: try column counts (auto) or use the fixed grid, measure text, maximize photo
  function fitGrid(pg, n, fixed) {
    const grid = pg.querySelector(".sh-grid");
    const r = grid.getBoundingClientRect();
    const dpi = 96, gapY = 0.12 * dpi, gapX = 0.14 * dpi;
    const opts = fixed ? [fixed] : [2, 3, 4, 5, 6].map((c) => ({ cols: c, rows: Math.ceil(n / c) })).filter((o) => o.rows <= 5);
    let best = null;
    for (const o of opts) {
      grid.style.gridTemplateColumns = `repeat(${o.cols}, minmax(0, 1fr))`;
      grid.style.gridTemplateRows = "";
      pg.style.setProperty("--ph", "10px");
      const textH = Math.max(0, ...[...grid.querySelectorAll(".tx")].map((t) => t.getBoundingClientRect().height)) + 6;
      const cellW = (r.width - gapX * (o.cols - 1)) / o.cols, cellH = (r.height - gapY * (o.rows - 1)) / o.rows;
      const ph = Math.min(cellW - 4, cellH - textH);
      if (!best || ph > best.ph + 1) best = Object.assign({ ph }, o);
    }
    grid.style.gridTemplateColumns = `repeat(${best.cols}, minmax(0, 1fr))`;
    grid.style.gridTemplateRows = `repeat(${best.rows}, minmax(0, 1fr))`;
    pg.style.setProperty("--ph", Math.max(36, best.ph) + "px");
  }
  function buildSheet() {
    const S = sheetOpts(), items = orderedItems();
    const wrap = document.createElement("div");
    wrap.className = "sheets";
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;left:-99999px;top:0;";
    document.body.appendChild(probe);
    const pages = [];
    const add = (pg) => { probe.appendChild(pg); pages.push(pg); return pg; };
    // cover
    if (S.cover) {
      const anchors = items.filter((o) => o.anchor);
      const cnt = { necklace: 0, bracelet: 0, earring: 0 }; items.forEach((o) => cnt[o.it.cat]++);
      const mix = CATS.filter((c) => cnt[c]).map((c) => `${cnt[c]} ${CAT_LABEL[c].toLowerCase()}`).join(" · ");
      const pg = add(newPage(`<div class="cv"><img class="logo" src="${esc(cfg.logo)}" alt="${esc(cfg.name)}"><div class="sh-brand">${esc(cfg.sheetTagline || cfg.name)} · ${esc(monthStr())}</div>
        <div class="sh-title">${esc(capTitle())}</div>${state.buyer.trim() ? `<div class="sh-for">Prepared for ${esc(state.buyer.trim())}</div>` : ""}
        ${S.note && S.note.trim() ? `<div class="sh-note">${esc(S.note.trim())}</div>` : ""}<div class="sh-rule"></div>
        <div class="hero">${anchors.map((o) => `<img src="${esc(o.it.img)}" alt="">`).join("")}</div>
        <div class="cvmix">${items.length} styles · ${esc(mix)}</div></div>`));
      pg.style.setProperty("--hero", (anchors.length > 1 ? 2.6 : 3.8) * Math.min(1, pageDims().w / 7.6) + "in");
    }
    // product pages
    const linkBand = S.orderForm && cfg.orderPage;      // a pre-filled wholesale order-page link + QR instead of an order form page
    const formPage = S.orderForm && !cfg.orderPage;     // lines without an order page: hand-fill order form page
    const termsOnSheet = S.terms && !formPage;
    if (S.layout === "auto") {
      const pg = add(newPage((S.cover ? miniHead() : fullHead(S)) + `<div class="sh-grid">${items.map(itemHTML).join("")}</div>` + (termsOnSheet ? termsHTML() : "") + (linkBand ? orderBandHTML() : "")));
      fitGrid(pg, items.length, null);
    } else {
      const [cols, rows] = S.layout.split("x").map(Number), per = cols * rows;
      let groups = [{ title: "", list: items }];
      if (S.sections) groups = CATS.map((c) => ({ title: CAT_LABEL[c], list: items.filter((o) => o.it.cat === c) })).filter((g) => g.list.length);
      const chunks = [];
      groups.forEach((g) => { for (let i = 0; i < g.list.length; i += per) chunks.push({ title: g.title ? g.title + (i ? " (continued)" : "") : "", list: g.list.slice(i, i + per) }); });
      chunks.forEach((ch, k) => {
        const head = k === 0 && !S.cover ? fullHead(S) : miniHead();
        const last = k === chunks.length - 1;
        const pg = add(newPage(head + (ch.title ? `<div class="sh-sec"><span>${esc(ch.title)}</span></div>` : "") + `<div class="sh-grid">${ch.list.map(itemHTML).join("")}</div>` + (termsOnSheet && last ? termsHTML() : "") + (linkBand && last ? orderBandHTML() : "")));
        fitGrid(pg, ch.list.length, { cols, rows });
      });
    }
    // order form (paginated by measuring)
    if (formPage) {
      const u = activeUnits();
      const priceHead = tiered() ? "Wholesale per piece" : "Wholesale";
      const rowsHTML = items.map((o, i) => {
        const c = engine.lineCost(o.it, u);
        const price = tiered() ? engine.priceBreaks(o.it, u).map((b) => `${b.units}+ ${money(b.each)}`).join("<br>") : money(o.it.ws);
        return `<tr><td class="im"><img src="${esc(o.it.img)}" alt=""></td><td><b>${esc(o.it.sku)}</b><br>${esc(o.it.name)}</td><td class="num">${price}</td><td class="num">${c.units}</td><td class="num">${money(c.total)}</td><td class="bl"><i></i></td><td class="bl"><i></i></td></tr>`;
      });
      const eco = engine.economics(items.map((o) => o.it), u);
      const cur = u === "reorder" ? eco.reorder : eco.first;
      const thead = `<tr><th></th><th>Style</th><th class="num">${priceHead}</th><th class="num">Suggested units</th><th class="num">Suggested total</th><th>Qty</th><th>Total</th></tr>`;
      const totRow = `<tr class="tot"><td></td><td>Suggested order · ${esc(unitsLabel(u))}</td><td></td><td class="num">${cur.units}</td><td class="num">${money(cur.total)}</td><td class="bl"></td><td class="bl"><i></i></td></tr>`;
      const fields = `<div class="of-fields"><div>Store</div><div>Buyer</div><div>Date</div><div>Ship to</div><div>Phone / email</div><div>PO #</div></div>`;
      let i = 0, first = true;
      while (i < rowsHTML.length || first) {
        const pg = add(newPage(miniHead("Order form") + (first ? fields : "") + `<div class="of-body"><table class="of"><thead>${thead}</thead><tbody></tbody></table></div>`));
        const body = pg.querySelector(".of-body"), tb = pg.querySelector("tbody");
        let placed = 0;
        while (i < rowsHTML.length) {
          tb.insertAdjacentHTML("beforeend", rowsHTML[i]);
          if (body.scrollHeight > body.clientHeight + 1 && placed > 0) { tb.lastElementChild.remove(); break; }
          i++; placed++;
        }
        first = false;
        if (i >= rowsHTML.length) {
          tb.insertAdjacentHTML("beforeend", totRow);
          const extra = S.terms ? termsHTML() : "";
          if (extra) body.insertAdjacentHTML("beforeend", extra);
          if (body.scrollHeight > body.clientHeight + 1) {   // totals / terms spill onto their own page
            tb.lastElementChild.remove(); if (extra) body.lastElementChild.remove();
            add(newPage(miniHead("Order form") + `<div class="of-body"><table class="of"><thead>${thead}</thead><tbody>${totRow}</tbody></table>${extra}</div>`));
          }
          break;
        }
      }
    }
    // footers: page x of y + title/date on multi-page sheets
    pages.forEach((pg, k) => {
      if (pages.length > 1) {
        pg.querySelector(".sh-foot .l").textContent = `${capTitle()} · ${monthStr()}`;
        if (S.pageNumbers) pg.querySelector(".sh-foot .r").textContent = `Page ${k + 1} of ${pages.length}`;
      }
      wrap.appendChild(pg);
    });
    probe.remove();
    return wrap;
  }
  function setPageRule() { $("pageRule").textContent = `@page { size: ${pageDims().css}; margin: ${MARGIN}in; }`; }
  function drawSheetOpts() {
    const S = sheetOpts();
    $("shLayout").value = S.layout; $("shPaper").value = S.paper; $("shOrient").value = S.orientation;
    $("shSections").checked = S.sections; $("shSections").disabled = S.layout === "auto";
    $("shSections").parentElement.title = S.layout === "auto" ? "Sections apply to the multi-page layouts" : "";
    $("shCover").checked = S.cover; $("shPick").checked = S.markPick;
    $("shSku").checked = S.fields.sku; $("shName").checked = S.fields.name; $("showWS").checked = S.fields.wholesale;
    $("shTiers").checked = S.fields.tiers; $("shTiersRow").classList.toggle("hide", !tiered()); $("shTiers").disabled = !S.fields.wholesale;
    $("shMsrp").checked = S.fields.msrp; $("shUnits").checked = S.fields.units;
    $("shTerms").checked = S.terms; $("shOrder").checked = S.orderForm; $("shPageNo").checked = S.pageNumbers;
    $("shNote").value = S.note || "";
  }
  function openSheet() {
    drawSheetOpts();
    openDlg("sheetDlg");
    renderSheetPreview();
  }
  function renderSheetPreview() {
    const prev = $("sheetPreview");
    prev.innerHTML = "";
    const w = buildSheet(), pages = [...w.children];
    const avail = prev.clientWidth - 28;
    pages.forEach((pg) => {
      const holder = document.createElement("div");
      holder.className = "pgwrap";
      prev.appendChild(holder); holder.appendChild(pg);
      const fit = Math.min(1, avail / pg.offsetWidth);
      pg.style.transform = `scale(${fit})`;
      holder.style.width = pg.offsetWidth * fit + "px"; holder.style.height = pg.offsetHeight * fit + "px";
    });
    const d = pageDims();
    $("pvInfo").textContent = `${pages.length} page${pages.length === 1 ? "" : "s"} · ${sheetOpts().paper === "a4" ? "A4" : "Letter"} ${sheetOpts().orientation}${sheetOpts().fields.wholesale || (sheetOpts().orderForm && !cfg.orderPage) ? " · shows wholesale prices" : " · no prices"}`;
  }
  function printSheet() {
    setPageRule();
    const w = $("sheetWrap"); w.innerHTML = ""; w.appendChild(buildSheet());
    const old = document.title; document.title = fileSafe(capTitle()) + "_line_sheet";
    setTimeout(() => { window.print(); document.title = old; }, 150);
  }
  function wireSheetOpts() {
    const S = () => sheetOpts();
    const upd = (fn) => () => { fn(); persist(); drawSheetOpts(); renderSheetPreview(); };
    $("shLayout").onchange = upd(() => (S().layout = $("shLayout").value));
    $("shPaper").onchange = upd(() => (S().paper = $("shPaper").value));
    $("shOrient").onchange = upd(() => (S().orientation = $("shOrient").value));
    $("shSections").onchange = upd(() => (S().sections = $("shSections").checked));
    $("shCover").onchange = upd(() => (S().cover = $("shCover").checked));
    $("shPick").onchange = upd(() => (S().markPick = $("shPick").checked));
    $("shSku").onchange = upd(() => (S().fields.sku = $("shSku").checked));
    $("shName").onchange = upd(() => (S().fields.name = $("shName").checked));
    $("showWS").onchange = upd(() => (S().fields.wholesale = $("showWS").checked));
    $("shTiers").onchange = upd(() => (S().fields.tiers = $("shTiers").checked));
    $("shMsrp").onchange = upd(() => (S().fields.msrp = $("shMsrp").checked));
    $("shUnits").onchange = upd(() => (S().fields.units = $("shUnits").checked));
    $("shTerms").onchange = upd(() => (S().terms = $("shTerms").checked));
    $("shOrder").onchange = upd(() => (S().orderForm = $("shOrder").checked));
    $("shPageNo").onchange = upd(() => (S().pageNumbers = $("shPageNo").checked));
    let t = null;
    $("shNote").oninput = () => { S().note = $("shNote").value; persist(); clearTimeout(t); t = setTimeout(renderSheetPreview, 250); };
  }

  /* ---------- order form as a real Excel workbook (.xlsx), written locally with no library ---------- */
  const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zipStore(files) {   // files: [{name, text}] -> Uint8Array (stored, no compression)
    const enc = new TextEncoder(), parts = [], central = [];
    let off = 0;
    const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    for (const f of files) {
      const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      const head = [0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
      parts.push(new Uint8Array(head), name, data);
      central.push([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)], name);
      off += head.length + name.length + data.length;
    }
    let cdLen = 0; const cd = [];
    for (let i = 0; i < central.length; i += 2) { const h = new Uint8Array(central[i]); cd.push(h, central[i + 1]); cdLen += h.length + central[i + 1].length; }
    const end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdLen), ...u32(off), ...u16(0)]);
    const all = parts.concat(cd, [end]), total = all.reduce((a, p) => a + p.length, 0), out = new Uint8Array(total);
    let p = 0; all.forEach((x) => { out.set(x, p); p += x.length; });
    return out;
  }
  function exportXLSX() {
    const x = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const col = (n) => { let s = ""; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
    const u = activeUnits(), T = tiered(), terms = cfg.terms || {};
    const items = orderedItems();
    const rows = [];   // each row: array of cells {v, t:'s'|'n'|'f', s:styleId}
    const S = (v, s) => ({ v, t: "s", s: s || 0 }), N = (v, s) => ({ v, t: "n", s: s || 0 }), F = (v, s) => ({ v, t: "f", s: s || 0 });
    rows.push([S(`${cfg.name} — ${capTitle()}`, 1)]);
    rows.push([S(`Buyer: ${state.buyer.trim() || "—"}`), S(""), S(`Date: ${new Date().toLocaleDateString("en-US")}`)]);
    termsRows().forEach((r) => rows.push([S(`${r[0]}: ${r[1]}`)]));
    rows.push([S(cfg.lineSheet.contactLine)]);
    const ol = orderLink();
    let linkRow = 0;
    if (ol) { rows.push([S(`Order online — opens our wholesale order page with these ${ol.n} styles filled in (click)`, 7)]); linkRow = rows.length; }
    rows.push([]);
    const hdr = ["#", "SKU", "Product", "Category", "Role"].concat(T ? ["WS each 3+", "WS each 6+", "WS each 12+"] : ["WS each"]).concat(["Min per style", "Suggested units", "Order qty", "Price each", "Line total", "MSRP each", "Retail value", "Check"]);
    rows.push(hdr.map((h) => S(h, 2)));
    const h0 = rows.length + 1;   // first data row (1-based)
    const ci = (name) => hdr.indexOf(name);
    items.forEach((o, i) => {
      const r = rows.length + 1, it = o.it, c = engine.lineCost(it, u);
      const q = `${col(ci("Order qty"))}${r}`, mn = `${col(ci("Min per style"))}${r}`;
      const row = [N(i + 1), S(it.sku), S(it.name), S(CAT_LABEL[it.cat].replace(/s$/, "")), S(o.anchor ? "Buyer pick" : "Capsule")];
      let price;
      if (T) {
        // set prices only where the style can be ordered in that set at this order type (blank = dozen only)
        const lo = minFor(it), tr = it.tiers || {};
        const p3 = lo <= 3 && tr["3"] != null ? N(tr["3"], 3) : S(""), p6 = lo <= 6 && tr["6"] != null ? N(tr["6"], 3) : S("");
        row.push(p3, p6, N(tr["12"] != null ? tr["12"] : it.ws, 3));
        const P3 = `${col(ci("WS each 3+"))}${r}`, P6 = `${col(ci("WS each 6+"))}${r}`, P12 = `${col(ci("WS each 12+"))}${r}`;
        const at6 = `IF(${P6}="",${P12},${P6})`;
        price = `IF(${q}>=12,${P12},IF(${q}>=6,${at6},IF(${P3}="",${at6},${P3})))`;
      } else {
        row.push(N(it.ws || 0, 3));
        price = `${col(ci("WS each"))}${r}`;
      }
      const pe = `${col(ci("Price each"))}${r}`;
      row.push(N(minFor(it)), N(c.units), N(c.units, 4), F(price, 3), F(`${q}*${pe}`, 3), N(it.msrp || 0, 3), F(`${q}*${col(ci("MSRP each"))}${r}`, 3),
        F(`IF(AND(${q}>0,${q}<${mn}),"Below minimum","")`));
      rows.push(row);
    });
    const hN = rows.length;   // last data row
    const tot = [S("", 5), S("", 5), S("TOTAL", 5)];
    while (tot.length < ci("Order qty")) tot.push(S("", 5));
    tot.push(F(`SUM(${col(ci("Order qty"))}${h0}:${col(ci("Order qty"))}${hN})`, 5), S("", 5),
      F(`SUM(${col(ci("Line total"))}${h0}:${col(ci("Line total"))}${hN})`, 6), S("", 5),
      F(`SUM(${col(ci("Retail value"))}${h0}:${col(ci("Retail value"))}${hN})`, 6),
      F(`IF(${col(ci("Line total"))}${hN + 1}<${terms.orderMinimum || 0},"Below ${money(terms.orderMinimum || 0, 0)} minimum","Meets minimum")`, 5));
    rows.push(tot);
    const sheetRows = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, k) => {
      const ref = `${col(k)}${ri + 1}`, st = c.s ? ` s="${c.s}"` : "";
      if (c.t === "n") return `<c r="${ref}"${st}><v>${c.v}</v></c>`;
      if (c.t === "f") return `<c r="${ref}"${st}><f>${x(c.v)}</f></c>`;
      return c.v === "" ? `<c r="${ref}"${st}/>` : `<c r="${ref}"${st} t="inlineStr"><is><t>${x(c.v)}</t></is></c>`;
    }).join("")}</row>`).join("");
    const widths = hdr.map((h) => (h === "Product" ? 38 : h === "SKU" ? 16 : h === "Check" ? 18 : h === "#" ? 5 : 12));
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="${h0 - 1}" topLeftCell="A${h0}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, k) => `<col min="${k + 1}" max="${k + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${sheetRows}</sheetData>${linkRow ? `<hyperlinks><hyperlink ref="A${linkRow}" r:id="rId1" tooltip="Open the pre-filled order page"/></hyperlinks>` : ""}<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
    const xf = (o) => `<xf numFmtId="${o.n || 0}" fontId="${o.f || 0}" fillId="${o.l || 0}" borderId="${o.b || 0}" xfId="0"${o.n ? ' applyNumberFormat="1"' : ""}${o.f ? ' applyFont="1"' : ""}${o.l ? ' applyFill="1"' : ""}${o.b ? ' applyBorder="1"' : ""}/>`;
    const xfs = [{}, { f: 1 }, { f: 2, l: 2 }, { n: 164 }, { l: 2 }, { f: 2, b: 1 }, { n: 164, f: 2, b: 1 }, { f: 3 }];
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFEAF8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FFB8A9D9"/></top><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.map(xf).join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    const bytes = zipStore([
      { name: "[Content_Types].xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
      { name: "_rels/.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: "xl/workbook.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Order form" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
      { name: "xl/_rels/workbook.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: "xl/worksheets/sheet1.xml", text: sheet },
      ...(linkRow ? [{ name: "xl/worksheets/_rels/sheet1.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${x(ol.url)}" TargetMode="External"/></Relationships>` }] : []),
      { name: "xl/styles.xml", text: styles },
    ]);
    download(`${fileSafe(capTitle())}_order_form.xlsx`, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  /* ================================================= dialogs + status */
  function openDlg(id) { $(id).classList.add("open"); }
  function closeDlg(id) { $(id).classList.remove("open"); }
  document.querySelectorAll(".dlg").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d || e.target.hasAttribute("data-close")) d.classList.remove("open"); }));
  function openGuide() {
    const g = window.BUDGET_GUIDE;
    $("guideBody").innerHTML = `<ul>${g.summary.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      <p class="note"><b>${esc(cfg.name)}:</b> ${esc(g.ladders[line] || "")} The ladder under the capsule totals shows the real number for the current pick.</p>
      <table class="guide"><tr><th>Figure</th><th>What it measures</th><th>Source</th></tr>${g.rows.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td><a href="${esc(r[3])}" target="_blank" rel="noopener">${esc(r[2])}</a></td></tr>`).join("")}</table>
      <p class="note">The presets are a starting ladder based on these figures, not your order history. Edit them in app/config.js (budgetPresets) as real orders come in.</p>`;
    openDlg("guideDlg");
  }
  function renderStatus(extra) {
    const flags = catalog.flags.concat(runtimeFlags);
    const stockLine = line === "OIYK" ? `${catalog.items.length} OIYK SKUs (active in the Product Master, with official images) · made to order` : `${catalog.items.length} RF SKUs with official images · ${catalog.items.filter((i) => engine.inStock(i, state.minQty)).length} pass the stock rule`;
    const has = store.get(`capsule_${line}_tags_csv`, null) || store.get(`capsule_${line}_catalog_csv`, null);
    $("dataStatus").innerHTML = `${stockLine}<br>Tags: ${esc(tagSource)}<br>Catalog: ${esc(catSource)}${extra ? "<br>" + extra : ""}<br><a href="#" id="flagLink">${flags.length} data flag${flags.length === 1 ? "" : "s"} to review</a>` + (has ? ` · <a href="#" id="resetData">reset to built-in data</a>` : "");
    $("flagLink").onclick = (e) => { e.preventDefault(); $("flagTable").innerHTML = flags.map((f) => `<tr><td><b>${esc(f.sku)}</b></td><td>${esc(f.issue)}</td></tr>`).join(""); openDlg("flagDlg"); };
    const r = $("resetData"); if (r) r.onclick = (e) => { e.preventDefault(); store.del(`capsule_${line}_tags_csv`); store.del(`capsule_${line}_catalog_csv`); location.reload(); };
  }

  /* ================================================= wire up */
  $("buyer").value = state.buyer; $("capName").value = state.capName;
  $("story").checked = state.story; $("showScores").checked = state.showScores;
  wireSheetOpts();
  document.querySelectorAll(".lines button").forEach((b) => (b.onclick = () => { if (b.dataset.line !== line) switchLine(b.dataset.line, false); }));
  $("buyer").oninput = () => { state.buyer = $("buyer").value; if (!state.capNameEdited) { state.capName = ""; $("capName").placeholder = capTitle(); } persist(); if (state.capsule) renderBoard(); };
  $("capName").oninput = () => { state.capName = $("capName").value; state.capNameEdited = !!state.capName.trim(); persist(); if (state.capsule) renderBoard(); };
  $("size").oninput = () => { state.size = +$("size").value; resetMix(true); persist(); };
  $("size").onchange = () => { if (state.capsule) build(); };
  ["mN", "mB", "mE"].forEach((id) => ($(id).onchange = () => {
    state.counts = { necklace: Math.max(0, +$("mN").value || 0), bracelet: Math.max(0, +$("mB").value || 0), earring: Math.max(0, +$("mE").value || 0) };
    if (state.mode === "pieces") state.size = sum(state.counts);
    drawMix(); persist(); if (state.capsule) build();
  }));
  $("modePieces").onclick = () => setMode("pieces");
  $("modeBudget").onclick = () => setMode("budget");
  $("budget").onchange = () => { const v = +$("budget").value; if (v > 0) setBudget(v); };
  $("units").onchange = () => { state.units = normUnits($("units").value); persist(); if (state.capsule) { if (state.mode === "budget") build(); else renderBoard(); } };
  $("guideLink").onclick = openGuide;
  $("story").onchange = () => { state.story = $("story").checked; persist(); if (state.capsule) build(); };
  $("showScores").onchange = () => { state.showScores = $("showScores").checked; persist(); if (state.capsule) renderBoard(); };
  $("minQty").onchange = () => { state.minQty = Math.max(0, +$("minQty").value || 0); persist(); renderStatus(); renderSlot(0); renderSlot(1); if (state.capsule) build(); };
  $("buildBtn").onclick = () => build();
  $("regenBtn").onclick = () => build();
  $("anotherBtn").onclick = () => build({ exclude: state.capsule.picks.filter((p) => !state.locked.has(p.item.sku)).map((p) => p.item.sku) });
  $("csvBtn").onclick = exportCSV;
  $("xlsxBtn").onclick = exportXLSX;
  $("orderPageBtn").onclick = openOrderPage;
  $("sheetBtn").onclick = openSheet;
  $("printBtn").onclick = printSheet;
  $("browseBtn").onclick = () => { browseTarget = state.anchors[0] ? 1 : 0; renderBrowse(); openDlg("browseDlg"); $("bq").focus(); };
  $("bq").oninput = renderBrowse;
  $("libSel").onchange = () => { if ($("libSel").value) openRecord($("libSel").value); };
  $("saveBtn").onclick = () => saveCapsule(false);
  $("saveNewBtn").onclick = () => saveCapsule(true);
  $("newBtn").onclick = newCapsule;
  $("delBtn").onclick = () => {
    const b = $("delBtn");
    if (!b.dataset.arm) { b.dataset.arm = "1"; b.textContent = "Confirm delete"; setTimeout(() => { b.dataset.arm = ""; b.textContent = "Delete"; }, 4000); return; }
    setLib(lib().filter((r) => r.id !== state.loadedId)); state.loadedId = null; renderLib("Deleted."); if (state.capsule) renderBoard();
  };
  $("expLibBtn").onclick = () => {
    const l = lib();
    download(`capsule_library_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: "Capsule Builder", version: 1, exported: new Date().toISOString(), capsules: l }, null, 1), "application/json");
    store.set("capsule_library_backup", new Date().toISOString()); renderLib("Backup downloaded — keep it in the Capsule Builder folder.");
  };
  $("impLibBtn").onclick = () => $("libFile").click();
  $("libFile").onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((t) => {
      try {
        const d = JSON.parse(t); const inc = Array.isArray(d) ? d : d.capsules || [];
        const l = lib(); let added = 0, updated = 0;
        inc.forEach((r) => { if (!r || !r.id || !r.anchors) return; const i = l.findIndex((x) => x.id === r.id); if (i >= 0) { if ((r.savedAt || "") > (l[i].savedAt || "")) { l[i] = r; updated++; } } else { l.push(r); added++; } });
        setLib(l); renderLib(`Restored ${added} new, ${updated} updated.`);
      } catch (err) { renderLib('<span class="warn">That file is not a capsule backup.</span>'); }
    });
    e.target.value = "";
  };
  $("loadTagsBtn").onclick = () => $("tagsFile").click();
  $("loadCatBtn").onclick = () => $("catFile").click();
  $("tagsFile").onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((t) => {
      const r = applyTags(t);
      store.set(`capsule_${line}_tags_csv`, t);
      tagSource = `${f.name} (${r.ok} SKUs applied)`;
      engine = new Engine(catalog, cfg);
      renderStatus(`Tag file: ${r.ok} applied, ${r.unknown} not in catalog, ${r.bad.length} rejected` + (r.bad.length ? ` <span class="warn">(${esc(r.bad.slice(0, 3).join("; "))}${r.bad.length > 3 ? "…" : ""})</span>` : ""));
      if (state.capsule) build();
    });
    e.target.value = "";
  };
  $("catFile").onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((t) => {
      const r = applyCatalog(t);
      store.set(`capsule_${line}_catalog_csv`, t);
      catSource = `${f.name} (${r.ok} SKUs updated)`;
      runtimeFlags.length = 0;
      r.fresh.forEach((s) => runtimeFlags.push({ sku: s, issue: "in the new catalog file but not in this build (needs tags + official image; rebuild data)" }));
      engine = new Engine(catalog, cfg);
      renderStatus(`Catalog file: ${r.ok} SKUs updated, ${r.fresh.length} new SKUs not yet in the tool`);
      renderSlot(0); renderSlot(1);
      if (state.capsule) build();
    });
    e.target.value = "";
  };

  // start
  loadLine(store.get("capsule_line", "RF") in SOURCES ? store.get("capsule_line", "RF") : "RF");
  const s0 = store.get("capsule_ui", {});
  state.anchors = (s0[`anchors_${line}`] || [null, null]).map((x) => (x && engine.bySku.has(x) ? x : null));
  state.counts = s0[`counts_${line}`] || null;
  state.minQty = s0[`minQty_${line}`] != null ? s0[`minQty_${line}`] : cfg.minQty;
  $("minQty").value = state.minQty;
  $("minQtyRow").classList.toggle("hide", line === "OIYK");
  $("capName").placeholder = capTitle();
  drawPresets(); drawUnits();
  $("modePieces").classList.toggle("on", state.mode === "pieces"); $("modeBudget").classList.toggle("on", state.mode === "budget");
  $("piecesBox").classList.toggle("hide", state.mode !== "pieces"); $("budgetBox").classList.toggle("hide", state.mode !== "budget");
  renderSlot(0); renderSlot(1);
  resetMix(false);
  $("buildBtn").disabled = !state.anchors[0];
  renderStatus(); renderLib();
  if (state.anchors[0]) build(); else clearBoard();
  window.__capsule = { orderLink, state, engine: () => engine, build, buildSheet: () => { setPageRule(); return buildSheet(); }, openSheet, exportXLSX, setSheet: (o) => { Object.assign(state.sheet, o, { fields: Object.assign(state.sheet.fields, (o || {}).fields || {}) }); persist(); }, orderedItems, setAnchor, switchLine, setMode, setBudget, saveCapsule, openRecord, lib, line: () => line };
})();
