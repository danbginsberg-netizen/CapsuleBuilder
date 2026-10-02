/* Capsule Builder UI — runs offline from the local folder. v1.6.0; v1.7.0 adds hooks for app/instore.js (the store, boards, market brief, guided mode) */
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
    document.body.classList.toggle("line-rf", L === "RF"); document.body.classList.toggle("line-oiyk", L === "OIYK");
    if (typeof sendToLabel === "function") try { sendToLabel(); } catch (e) {}
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
    if (state) applyContext();
    $("brandLogo").src = cfg.logo;
    $("orderPageBtn").classList.toggle("hide", !cfg.orderPage);
    $("shOrderLabel").textContent = cfg.orderPage ? "Order link + QR code (opens our order page pre-filled)" : "Order form page";
    document.querySelectorAll(".lines button").forEach((b) => b.classList.toggle("on", b.dataset.line === L));
    store.set("capsule_line", L);
    if (state) runHooks("line", L);
  }

  /* ================================================= rep code + capsule ID (v1.6.0) */
  // A rep's code rides on every link, QR code and export so orders from their capsules are credited to them.
  function cleanRep(v) { return String(v || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20); }
  const newCapId = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // the capsule's ID: its saved-capsule ID, or a temporary one kept until the capsule is saved (then it becomes the saved ID)
  function capId() { return state.loadedId || state.tmpId || (state.tmpId = newCapId()); }

  /* ================================================= state */
  const saved = store.get("capsule_ui", {});
  const state = {
    anchors: [null, null], buyer: saved.buyer || "", capName: saved.capName || "", capNameEdited: !!saved.capNameEdited,
    mode: saved.mode || "pieces", size: saved.size || BASE.defaultSize, counts: null,
    budget: saved.budget || null, units: normUnits(saved.units),
    story: !!saved.story, showScores: !!saved.showScores, minQty: null,
    sheet: sheetDefaults(saved.sheet, saved.markPick),
    capsule: null, locked: new Set(), halves: new Set(), lastMs: 0, loadedId: null,
    rep: cleanRep(store.get("capsule_rep", "")), tmpId: null,
    // v1.7.0: the store (context: never ordered) and the store size that pre-filled the budget
    context: normCtx(saved.context), storeSize: saved.storeSize || "",
    account: saved.account || "",   // v1.9.0: the retailer this capsule is for (app/accounts.js); drives the fit check
  };
  function normCtx(c) { c = c || {}; return { items: Array.isArray(c.items) ? c.items : [], on: c.on !== false, strength: c.strength || "medium" }; }
  const HOOKS = { board: [], sheetPages: [], context: [], record: [], restore: [], line: [], sendText: [], sheetOpts: [], account: [] };
  const runHooks = (k, ...a) => HOOKS[k].forEach((f) => { try { f(...a); } catch (e) { console.error(e); } });
  function applyContext() { if (engine) { engine.setContext(state.context.on ? state.context : null); engine.setAccount(acctProfile(line)); } }
  // v1.9.0: the chosen account's profile for a line, or null
  function acctOf(id) { return (((window.ACCOUNTS || {}).accounts) || []).find((a) => a.id === id) || null; }
  function acctProfile(L) {
    const a = state && state.account ? acctOf(state.account) : null;
    const P = a && a.lines ? a.lines[L || line] : null;
    return P ? Object.assign({ accountName: a.name, accountId: a.id }, P) : null;
  }
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
    context: state.context, storeSize: state.storeSize, account: state.account,
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
      res.querySelectorAll("div[data-k]").forEach((d) => (d.onmousedown = (e) => { e.preventDefault(); setAnchor(i, hits[+d.dataset.k].sku, true); }));
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
      else if (e.key === "Enter" && hits[hi]) setAnchor(i, hits[hi].sku, true);
      else if (e.key === "Escape") { hits = []; draw(); }
    };
    inp.onblur = () => setTimeout(() => (res.hidden = true), 150);
  }
  function setAnchor(i, sku, hold) {   // v1.9.1: hold = a rep's own pick waits for Build capsule
    if (i === 1 && !state.anchors[0]) i = 0;
    if (state.anchors.includes(sku)) return;
    state.anchors[i] = sku;
    onAnchorsChanged(hold);
  }
  function onAnchorsChanged(hold) {
    renderSlot(0); renderSlot(1);
    state.locked.clear(); state.halves = new Set(); syncHalves();
    if (!state.loadedId) state.tmpId = null;   // a new anchor on an unsaved capsule is a new capsule
    resetMix(false);
    $("buildBtn").disabled = !state.anchors[0];
    persist();
    if (state.anchors[0]) { if (hold) showReady(); else build(); } else clearBoard();
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
    if (state.anchors[0] && state.capsule) build();
  }
  function setBudget(v) {
    state.budget = v; if (state.mode !== "budget") { setMode("budget"); return; }
    drawPresets(); persist(); if (state.anchors[0] && state.capsule) build();
  }

  /* ================================================= build + board */
  function mixShares() { const t = sum(state.counts) || 1; return { necklace: state.counts.necklace / t, bracelet: state.counts.bracelet / t, earring: state.counts.earring / t }; }
  function build(extra) {
    if (!state.anchors[0]) return;
    if (!anchorsFit(state.counts)) { drawMix(); return; }
    const t0 = performance.now();
    syncHalves(); applyContext();
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
    // v1.7.2: what the store changed — the same build with the store switched off, compared piece by piece
    state.ctxImpact = null;
    if (engine.ctxProfile && state.context.on) {
      const keepHalves = new Set(state.halves);
      engine.setContext(null);
      try {
        const base = state.mode === "budget"
          ? engine.buildBudget(state.anchors.filter(Boolean), Object.assign({ budget: state.budget || 300, mix: mixShares(), halves: [...keepHalves] }, common, extra || {}))
          : engine.build(state.anchors.filter(Boolean), Object.assign({ counts: state.counts, size: sum(state.counts) }, common, extra || {}));
        const was = new Set(base.picks.map((p) => p.item.sku));
        const added = state.capsule.picks.filter((p) => !was.has(p.item.sku)).map((p) => p.item.sku);
        state.ctxImpact = { added: new Set(added), changed: added.length, total: state.capsule.picks.length, strength: state.context.strength };
      } finally { applyContext(); state.halves = keepHalves; syncHalves(); }
    }
    state.lastMs = Math.round(performance.now() - t0);
    state.alt = !!(extra && extra.exclude && extra.exclude.length);   // true only while another version is showing
    ["regenBtn", "anotherBtn", "sheetBtn", "xlsxBtn", "orderPageBtn", "csvBtn", "saveBtn", "saveNewBtn", "sendBtn", "sendToBtn", "whyBtn"].forEach((id) => ($(id).disabled = false));
    boardCue(null);
    renderBoard();
  }
  // v1.9.1 (Lloyd review): the empty board points to the first step, and a picked piece waits for Build capsule
  function boardCue(k) { document.body.classList.toggle("cold", k === "cold"); document.body.classList.toggle("ready", k === "ready"); }
  function wireEmpty() {
    const b = $("emptyBrowse"); if (b) b.onclick = () => $("browseBtn").click();
    const g = $("emptyBuild"); if (g) g.onclick = () => build();
  }
  function showReady() {
    state.capsule = null;
    const it = engine.bySku.get(state.anchors[0]); const it2 = state.anchors[1] ? engine.bySku.get(state.anchors[1]) : null;
    const chip = (x) => x ? `<span class="ready-pick"><img src="${esc(x.img)}" alt=""><span><b>${esc(x.name)}</b>${esc(x.sku)}</span></span>` : "";
    $("board").innerHTML = `<div class="empty start"><b>Ready to build.</b>The capsule is built around ${it2 ? "these pieces" : "this piece"}. Set the number of pieces or the budget on the left, then build.<div>${chip(it)} ${chip(it2)}</div><div class="go"><button class="btn primary" id="emptyBuild">Build capsule</button><button class="btn" id="emptyBrowse">Choose a different piece</button></div></div>`;
    $("econ").innerHTML = ""; $("boardTitle").textContent = "Capsule Builder"; $("boardMeta").textContent = `${cfg.name} · ready to build.`;
    ["regenBtn", "anotherBtn", "sheetBtn", "xlsxBtn", "orderPageBtn", "csvBtn", "saveBtn", "saveNewBtn", "sendBtn", "sendToBtn", "whyBtn"].forEach((id) => ($(id).disabled = true));
    boardCue("ready"); wireEmpty();
  }
  function clearBoard() {
    state.capsule = null;
    $("board").innerHTML = '<div class="empty start"><b>One piece in, a capsule out.</b>Start with the piece the buyer liked: browse the catalog, or type a SKU or name in Pick 1 on the left.<div class="go"><button class="btn primary" id="emptyBrowse">Browse the catalog</button></div><div class="steps"><span><b>1</b> · Pick the piece</span><span><b>2</b> · Set pieces or budget</span><span><b>3</b> · Build capsule</span></div></div>';
    boardCue("cold"); wireEmpty();
    $("econ").innerHTML = ""; $("boardTitle").textContent = "Capsule Builder"; $("boardMeta").textContent = `${cfg.name} · pick the piece the buyer liked to start.`;
    ["regenBtn", "anotherBtn", "sheetBtn", "xlsxBtn", "orderPageBtn", "csvBtn", "saveBtn", "saveNewBtn", "sendBtn", "sendToBtn", "whyBtn"].forEach((id) => ($(id).disabled = true));
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
    const newForHer = !isAnchor && state.ctxImpact && state.ctxImpact.added.has(it.sku);
    const cx = !isAnchor && e && e.sc && e.sc.ctx && state.context.on && (newForHer || (e.sc.ctx.why && e.sc.ctx.pts > 0.5)) ? `<div class="ctxwhy">${newForHer ? "<b>Chosen for the store.</b> " : "The store: "}${e.sc.ctx.why ? `goes with the store’s ${esc(e.sc.ctx.why.item)}` : "fits the store's palette and look"}</div>` : "";
    return `<div class="card ${isAnchor ? "anchor" : ""}" data-sku="${esc(it.sku)}">
      <div class="im"><img src="${esc(it.img)}" alt="${esc(it.name)}" loading="lazy">${isAnchor ? `<span class="tag">${anchorItems().length > 1 ? "Pick " + (idx + 1) : "Anchor"}</span>` : ""}${locked ? `<span class="tag lock">Locked</span>` : ""}${it.lowres ? `<span class="tag lr">Low-res image</span>` : ""}</div>
      <div class="b"><div class="sku"><span>${esc(it.sku)}</span>${scoreBit}</div><div class="nm">${esc(it.name)}</div><div class="px">${priceLine(it)}</div>${stale}<div class="why">${esc(why)}</div>${cx}${attrs}
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
  /* ---------- v1.6.5: trend notes from In the Know (line-locked, 60-day expiry, shown only when pieces match) ---------- */
  function trendNow() {
    if (!state.capsule || !window.TREND_SIGNALS) return { notes: [] };
    return engine.trendNotes(window.TREND_SIGNALS[line], orderedItems().map((o) => o.it), new Date().toISOString().slice(0, 10));
  }
  const fmtDay = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  function trendNoteHTML() {
    const r = trendNow();
    if (!r.notes.length) return "";
    // v1.8.6: an evergreen (perennial) note has no research date and no expiry
    const tip = r.asOf ? `From our In the Know research, ${esc(fmtDay(r.asOf))}. Shown because pieces in this capsule match; replaced with new insights from current research by ${esc(fmtDay(r.expires))}.`
      : "From our In the Know research: a perennial that holds from season to season. Shown because pieces in this capsule match.";
    return `<div class="trendnote" title="${tip}">` +
      `<b>Market note</b>${r.notes.map((n) => `<span>${esc(n.text)}</span>`).join("")}<small>In the Know · ${r.asOf ? esc(fmtDay(r.asOf)) : "perennial"}</small></div>`;
  }
  function renderBoard() {
    const cap = state.capsule;
    syncHalves();
    $("regenBtn").disabled = !state.alt;
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
    $("board").innerHTML = trendNoteHTML() + ctxStripHTML() + h;
    $("board").querySelectorAll(".card [data-act]").forEach((b) => {
      const sku = b.closest(".card").dataset.sku;
      b.onclick = () => (b.dataset.act === "swap" ? openSwap(sku) : b.dataset.act === "half" ? toggleHalf(sku) : toggleLock(sku));
    });
    runHooks("board");
  }
  // v1.7.0: the store beside the capsule. Context only: never ordered, never totaled.
  function ctxThumb(x) { return x.thumb ? `<img src="${esc(x.thumb)}" alt="">` : (window.CB_SILHOUETTE ? window.CB_SILHOUETTE(x) : ""); }
  function ctxStripHTML() {
    const L = state.context.items;
    if (!L.length) return "";
    const im = state.ctxImpact, SL = { light: "Light", medium: "Medium", strong: "Strong" };
    const impact = !state.context.on ? "Not used in matching (switched off)." : im ? `At <b>${SL[im.strength] || im.strength}</b>, the store changed <b>${im.changed} of ${im.total}</b> pieces from the capsule built on the buyer's pick alone${im.changed ? " (marked “Chosen for the store”)" : ""}.` : "";
    return `<div class="ctxstrip"><div class="h"><b>The store</b><span>Not ours · for context · never on the order</span><a class="link" data-pane="store">Edit</a></div>${impact ? `<div class="ctximpact">${impact}</div>` : ""}<div class="tiles">${L.map((x) => `<div class="t" title="${esc(x.name || x.type || "")}">${ctxThumb(x)}<small>${esc(x.name || x.type || "")}</small></div>`).join("")}</div></div>`;
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
    $("browseGrid").querySelectorAll("div[data-sku]").forEach((d) => (d.onclick = () => { setAnchor(browseTarget, d.dataset.sku, true); closeDlg("browseDlg"); }));
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
      context: state.context.items.length ? JSON.parse(JSON.stringify(state.context)) : undefined, storeSize: state.storeSize || undefined,
      account: state.account || undefined,
    };
  }
  function saveCapsule(asNew) {
    if (!state.capsule) return;
    const l = lib();
    const i = !asNew && state.loadedId ? l.findIndex((r) => r.id === state.loadedId) : -1;
    const id = i >= 0 ? state.loadedId : (!asNew && state.tmpId) || newCapId();
    state.tmpId = null;
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
      counts: r.counts, budget: r.budget, units: normUnits(r.units), story: !!r.story, minQty: r.minQty != null ? r.minQty : cfg.minQty, loadedId: r.id, tmpId: null,
    });
    state.anchors = [r.anchors[0] || null, r.anchors[1] || null];
    state.locked = new Set(r.locked || []);
    state.halves = new Set(r.halves || []); syncHalves();
    if (r.sheet) state.sheet = Object.assign(sheetDefaults(), r.sheet, { fields: Object.assign(sheetDefaults().fields, r.sheet.fields || {}) });
    state.account = r.account || "";
    state.context = normCtx(r.context); state.storeSize = r.storeSize || ""; applyContext(); runHooks("context"); runHooks("account");
    $("buyer").value = state.buyer; $("capName").value = state.capName; $("story").checked = state.story; $("minQty").value = state.minQty;
    $("minQtyRow").classList.toggle("hide", line === "OIYK");
    $("modePieces").classList.toggle("on", state.mode === "pieces"); $("modeBudget").classList.toggle("on", state.mode === "budget");
    $("piecesBox").classList.toggle("hide", state.mode !== "pieces"); $("budgetBox").classList.toggle("hide", state.mode !== "budget");
    drawPresets(); drawUnits(); drawMix(); renderSlot(0); renderSlot(1); renderStatus();
    const t0 = performance.now();
    state.capsule = engine.restore(r.anchors, r.picks, { colorwayStory: state.story, minQty: state.minQty });
    if (state.mode === "budget") { state.capsule.budget = { budget: state.budget, units: state.units }; recalcBudget(); }
    state.lastMs = Math.round(performance.now() - t0);
    state.alt = true;   // a saved capsule may differ from today's best match
    ["regenBtn", "anotherBtn", "sheetBtn", "xlsxBtn", "orderPageBtn", "csvBtn", "saveBtn", "saveNewBtn", "sendBtn", "sendToBtn", "whyBtn"].forEach((x) => ($(x).disabled = false));
    $("buildBtn").disabled = false;
    persist(); renderLib(); renderBoard();
  }
  function newCapsule() {
    state.loadedId = null; state.tmpId = null; state.buyer = ""; state.capName = ""; state.capNameEdited = false;
    state.anchors = [null, null]; state.locked.clear(); state.halves = new Set(); syncHalves(); state.sheet.note = "";
    state.account = "";
    state.context = normCtx(); state.storeSize = ""; applyContext(); runHooks("context"); runHooks("account");
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
    const rows = [["capsule_name", "buyer_name", "line", "position", "sku", "category", "product_name", "role", "units_per_style", "wholesale_each", "line_total", "rep_code", "capsule_id"]];
    let tot = 0;
    orderedItems().forEach((o, i) => {
      const c = engine.lineCost(o.it, u); tot += c.total;
      rows.push([capTitle(), state.buyer, line, i + 1, o.it.sku, o.it.cat, o.it.name, o.anchor ? "buyer pick" : "capsule", c.units, c.each.toFixed(2), c.total.toFixed(2), state.rep, capId()]);
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
    url += tagParams();
    return { url, off, n: parts.length };
  }
  // &rep=CODE&cap=ID on every link: the order pages add both to the submitted order; Shopify analytics records the capsule page visit
  function tagParams() { return (state.rep ? `&rep=${encodeURIComponent(state.rep)}` : "") + `&cap=${encodeURIComponent(capId())}`; }
  function openOrderPage() {
    const l = orderLink();
    if (!l) return;
    if (l.off.length) alert(`Not on the order page, so left out: ${l.off.join(", ")}. The buyer can email for those.`);
    window.open(l.url, "_blank", "noopener");
  }
  // v1.7.9: a long link (a big capsule's cart) gets the low error-correction level, which keeps the code as small as it can be
  const qrEc = (text) => (String(text).length > 250 ? "L" : "M");
  function qrMake(text, ec) { const q = qrcode(0, ec || qrEc(text)); q.addData(text); q.make(); return q; }
  function qrSVG(text, ec) {
    try { return qrMake(text, ec).createSvgTag({ cellSize: 2, margin: 0, scalable: true }); }
    catch (e) { return ""; }
  }
  // v1.7.9: the printed QR code grows with the link so each square prints at least ~0.5 mm (0.95 in. for a short link,
  // up to 2.1 in. for a 30+ style capsule). data-qr lets the PDF redraw it as sharp vector squares and make it clickable.
  function qrBox(text) {
    let n = 25; try { n = qrMake(text).getModuleCount(); } catch (e) { /* keep the default */ }
    const size = Math.min(2.1, Math.max(0.95, (n + 4) * 0.021));
    return `<div class="qr" data-qr="${esc(text)}" style="width:${size.toFixed(2)}in;height:${size.toFixed(2)}in">${qrSVG(text)}</div>`;
  }
  /* v1.7.9: PDFs are pictures of the page (html2canvas), so on their own links don't click and a dense QR code blurs.
     After a page's picture goes in, this redraws every QR code on it as sharp vector squares (with a white margin) and
     adds a real link over each <a href> and each QR code. x0/y0: where the page sits on the PDF page, wIn: its width (in.). */
  function pdfOverlay(doc, pg, x0, y0, wIn) {
    const R = pg.getBoundingClientRect(), k = wIn / R.width;
    const at = (r) => [x0 + (r.left - R.left) * k, y0 + (r.top - R.top) * k, r.width * k, r.height * k];
    pg.querySelectorAll("[data-qr]").forEach((el) => {
      let q; try { q = qrMake(el.dataset.qr); } catch (e) { return; }
      const n = q.getModuleCount(), [x, y, w, h] = at(el.getBoundingClientRect()), size = Math.min(w, h), c = size / n;
      doc.setFillColor(255, 255, 255); doc.rect(x - 2 * c, y - 2 * c, size + 4 * c, size + 4 * c, "F");
      doc.setFillColor(0, 0, 0);
      for (let r = 0; r < n; r++) {
        let run = -1;
        for (let col = 0; col <= n; col++) {
          const dark = col < n && q.isDark(r, col);
          if (dark && run < 0) run = col;
          if (!dark && run >= 0) { doc.rect(x + run * c, y + r * c, (col - run) * c + 0.0005, c + 0.0005, "F"); run = -1; }
        }
      }
      doc.link(x, y, size, size, { url: el.dataset.qr });
    });
    pg.querySelectorAll("a[href]").forEach((a) => {
      if (!/^https?:/i.test(a.href)) return;
      [...a.getClientRects()].forEach((r) => { const [x, y, w, h] = at(r); doc.link(x, y, w, h, { url: a.href }); });
    });
  }
  function orderBandHTML() {
    const l = orderLink();
    if (!l) return "";
    return `<div class="sh-order">${qrBox(l.url)}<div class="tx"><b>Order this capsule</b>
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
    // v1.7.8: "Your pick" gets its own line above the photo (every tile keeps the same line so the rows stay aligned)
    // v1.8.2: what the buyer bought before (the buyer's order, read in Find similar) is marked "You bought this"
    const bought = S.markPick && window.CB_SIMILAR && window.CB_SIMILAR.boughtSet ? window.CB_SIMILAR.boughtSet() : new Set();
    const mark = S.markPick && orderedItems().some((x) => x.anchor || bought.has(x.it.sku));
    const tag = bought.has(it.sku) ? "You bought this" : o.anchor ? "Your pick" : "";
    return `<div class="it">${mark ? `<div class="yt">${tag ? `<span class="yp">${tag}</span>` : ""}</div>` : ""}<div class="ph"><img src="${esc(it.img)}" alt=""></div><div class="tx">${tx}</div></div>`;
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
  // Line-sheet / Excel accent for the current line (config may hold one color or one per line)
  function sheetAccent(key) {
    const a = cfg.lineSheet[key || "accent"] || cfg.lineSheet.accent;
    return (a && typeof a === "object") ? (a[line] || Object.values(a)[0]) : a;
  }
  function newPage(inner) {
    const d = pageDims();
    const el = document.createElement("div");
    el.className = "sheet sheet-" + line.toLowerCase();
    el.style.width = d.w + "in"; el.style.height = d.h + "in";
    el.style.setProperty("--lav", sheetAccent());
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
      const yt = grid.querySelector(".yt"), ytH = yt ? yt.getBoundingClientRect().height + 2 : 0;
      const textH = Math.max(0, ...[...grid.querySelectorAll(".tx")].map((t) => t.getBoundingClientRect().height)) + 6 + ytH;
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
      // v1.7.8 (Dan): a big capsule goes to 2-3 pages instead of shrinking the photos; styles split evenly across pages
      const per = Math.max(4, cfg.lineSheet.autoPerPage || 15), nPg = Math.max(1, Math.ceil(items.length / per)), size = Math.ceil(items.length / nPg);
      for (let k = 0; k < nPg; k++) {
        const list = items.slice(k * size, (k + 1) * size), last = k === nPg - 1;
        const pg = add(newPage((k === 0 && !S.cover ? fullHead(S) : miniHead()) + `<div class="sh-grid">${list.map(itemHTML).join("")}</div>` + (termsOnSheet && last ? termsHTML() : "") + (linkBand && last ? orderBandHTML() : "")));
        fitGrid(pg, list.length, null);
      }
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
    // v1.7.0: extra pages (market brief, shown with the store, buyer packet) from app/instore.js
    runHooks("sheetPages", { add, newPage, miniHead, fullHead, S, items, pageDims, esc, money, qtyWord, minFor, termsRows, activeUnits });
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
    ["shBrief", "shCtxPage", "shPacket", "shCommittee"].forEach((id) => { const k = { shBrief: "brief", shCtxPage: "ctxPage", shPacket: "packet", shCommittee: "committee" }[id]; if ($(id)) $(id).checked = !!S[k]; });
    if ($("shCommittee")) $("shCommittee").disabled = !S.packet;
    if ($("shRepContact")) $("shRepContact").value = store.get("capsule_rep_contact", "");
    runHooks("sheetOpts", S);
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
  /* ---------- v1.6.7: the line sheet as a real PDF file, to email or save ---------- */
  // Each page is drawn exactly as previewed (html2canvas) into a PDF at the chosen paper size (jsPDF).
  // A page opened straight from a folder on this computer (file://) can't read its own photos into a PDF
  // (browser security), so there the rep falls back to Print / Save as PDF; the web copy works everywhere.
  async function sheetPDF() {
    if (!window.jspdf || !window.html2canvas) throw new Error("PDF tools didn't load");
    const S = sheetOpts(), d = pageDims();
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-20000px;top:0;background:#fff;";
    document.body.appendChild(host);
    try {
      const w = buildSheet(); host.appendChild(w);
      await Promise.all([...host.querySelectorAll("img")].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
      const doc = new window.jspdf.jsPDF({ unit: "in", format: S.paper === "a4" ? "a4" : "letter", orientation: S.orientation === "landscape" ? "landscape" : "portrait", compress: true });
      const pages = [...w.children];
      for (let k = 0; k < pages.length; k++) {
        const c = await window.html2canvas(pages[k], { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true });
        const img = c.toDataURL("image/jpeg", 0.88);   // throws on a file:// page (tainted canvas)
        if (k) doc.addPage();
        doc.addImage(img, "JPEG", MARGIN, MARGIN, d.w, d.h, undefined, "FAST");
        pdfOverlay(doc, pages[k], MARGIN, MARGIN, d.w);   // v1.7.9: sharp, scannable QR + clickable links
      }
      doc.setProperties({ title: `${capTitle()} · ${cfg.name} line sheet`, author: cfg.name });
      return new File([doc.output("blob")], `${fileSafe(capTitle())}_line_sheet.pdf`, { type: "application/pdf" });
    } finally { host.remove(); }
  }
  function sheetMailText() {
    const who = state.buyer.trim(), ol = orderLink();
    return [
      "Hi,", "",
      `Attached is the ${cfg.name} line sheet for ${capTitle()}${who ? ` (prepared for ${who})` : ""}.`,
      ol ? `\nReady to order? This opens our order page with these styles filled in:\n${ol.url}` : "",
      "", "Best,",
    ].join("\n");
  }
  async function busy(btn, label, fn) {
    const old = btn.textContent; btn.disabled = true; btn.textContent = label;
    try { return await fn(); } finally { btn.disabled = false; btn.textContent = old; }
  }
  async function downloadSheetPDF() {
    let file = null;
    try { file = await busy($("pdfBtn"), "Making PDF…", sheetPDF); } catch (e) { file = null; }
    if (!file) { flash("shMsg", "This copy can't make the PDF itself (it was opened from a folder on this computer). Use <b>Print / Save as PDF</b>, or the web copy."); return; }
    download(file.name, file, "application/pdf"); logSend("line-sheet-pdf");
    flash("shMsg", `Saved <b>${esc(file.name)}</b> to this device's downloads.`);
  }
  // v1.8.9: on a computer, save the PDF and copy the email text; paste into any email program and attach the PDF (Dan: don't open apps on my desktop).
  // Phones and tablets keep the share sheet, which hands the PDF to Mail, Gmail or Outlook as an attachment.
  async function emailSheetPDF() {
    const subj = `${cfg.name}: ${capTitle()} line sheet`, body = sheetMailText();
    const touch = window.CB_MAIL.touchDevice();
    if (!touch) copyText(`Subject: ${subj}\n\n${body}`, "shMsg", "Email text");   // at the click, while the browser allows it
    let file = null;
    try { file = await busy($("emailPdfBtn"), "Making PDF…", sheetPDF); } catch (e) { file = null; }
    if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: subj, text: body }); logSend("line-sheet-pdf-share"); flash("shMsg", "Shared. Check the email in your mail app and press Send there."); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    if (touch) copyText(`Subject: ${subj}\n\n${body}`, "shMsg", "Email text");
    if (file) download(file.name, file, "application/pdf");
    logSend("line-sheet-email", { to: ($("sdTo") && $("sdTo").value.trim()) || "" });
    if (file) flash("shMsg", `Saved <b>${esc(file.name)}</b> to your downloads and copied the email text. Paste it into a new message in any email program and attach the PDF. Nothing is sent from here.`);
    else { flash("shMsg", "Copied the email text. This copy can't make the PDF itself, so the print window opens: choose <b>Save as PDF</b>, then attach that file."); printSheet(); }
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
    $("shBrief").onchange = upd(() => (S().brief = $("shBrief").checked));
    $("shCtxPage").onchange = upd(() => (S().ctxPage = $("shCtxPage").checked));
    $("shPacket").onchange = upd(() => (S().packet = $("shPacket").checked));
    $("shCommittee").onchange = upd(() => (S().committee = $("shCommittee").checked));
    let rc = null;
    $("shRepContact").oninput = () => { store.set("capsule_rep_contact", $("shRepContact").value.slice(0, 80)); clearTimeout(rc); rc = setTimeout(renderSheetPreview, 300); };
    let t = null;
    $("shNote").oninput = () => { S().note = $("shNote").value; persist(); clearTimeout(t); t = setTimeout(renderSheetPreview, 250); };
  }

  /* ---------- order form as a real Excel workbook (.xlsx), written locally with no library ---------- */
  const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zipStore(files) {   // files: [{name, text} or {name, bytes}] -> Uint8Array (stored, no compression)
    const enc = new TextEncoder(), parts = [], central = [];
    let off = 0;
    const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    for (const f of files) {
      const name = enc.encode(f.name), data = f.bytes || enc.encode(f.text), crc = crc32(data);
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
    rows.push([S(`Buyer: ${state.buyer.trim() || "—"}`), S(""), S(`Date: ${new Date().toLocaleDateString("en-US")}`), S(""), S(`${state.rep ? "Rep code: " + state.rep + " · " : ""}Capsule ID: ${capId()}`)]);
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
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${sheetAccent("accentSoft").replace("#","").toUpperCase()}"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF${sheetAccent().replace("#","").toUpperCase()}"/></top><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.map(xf).join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
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

  /* ================================================= v1.6.0: why these pieces, send capsule, send log, send to… */
  const SEND_LOG = "capsule_send_log";
  const today = () => new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  function flash(id, msg) { const el = $(id); if (el) { el.innerHTML = msg; clearTimeout(el._t); el._t = setTimeout(() => (el.innerHTML = ""), 6000); } toast(msg); }
  function toast(msg) {   // v1.6.1: copy and export feedback you can see wherever the button sits
    let t = $("toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.innerHTML = msg; t.classList.add("on"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("on"), 2600);
  }
  function copyText(text, noteId, what, msg) {   // msg: optional full confirmation (already escaped)
    const done = () => flash(noteId, msg || `${esc(what)} copied.`);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, noteId, what, msg));
    else fallbackCopy(text, noteId, what, msg);
  }
  function fallbackCopy(text, noteId, what, msg) {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;left:-9999px;top:0"; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove(); flash(noteId, ok ? (msg || `${esc(what)} copied.`) : '<span class="warn">Copy is blocked here — select the text and copy it by hand.</span>');
  }

  /* ---------- "Why these pieces" (engine.explain) ---------- */
  function whyHTML(x) {
    const ul = (a) => `<ul>${a.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
    let h = `<h4>The family</h4>${ul(x.family)}`;
    h += `<h4>Colorways</h4><p class="note">A colorway is the same design in a different color. Showing a style in two or three colorways lets each customer find their color without the store buying a new design; switching a colorway changes the color, not the fit or the price.</p>`;
    h += x.colorways.length ? ul(x.colorways) : `<p class="note">No style appears in more than one color in this capsule. Tick <b>Colorway story</b> to add the buyer's pick in two more colors.</p>`;
    h += `<h4>Sister pieces</h4><p class="note">Pieces made to be worn together: the lookbook's sister pieces, the same collection, or the same motif or material across categories.</p>`;
    h += x.sisters.length ? ul(x.sisters) : `<p class="note">No matching pairs in this capsule.</p>`;
    h += `<h4>Balance</h4>${ul(x.balance)}`;
    const t = trendNow();
    h += `<h4>Market notes</h4><p class="note">From In the Know, our proprietary research on the ${line === "RF" ? "fashion jewelry field" : "premium jewelry market"}. A note shows only on ${esc(cfg.name)} capsules whose pieces match it. Dated notes are replaced with new insights from current research as the market moves; perennial notes stay while the research shows them holding.</p>`;
    h += t.notes.length ? `<ul>${t.notes.map((n) => `<li>${esc(n.text)} <span class="note">Matching pieces: ${n.pieces.map(esc).join(", ")}. ${n.evergreen ? "Perennial note; it stays while the research shows it holding." : `Research of ${esc(fmtDay(n.asOf))}; replaced with new insights from current research by ${esc(fmtDay(n.expires))}.`}</span></li>`).join("")}</ul>`
      : `<p class="note">${window.TREND_SIGNALS && window.TREND_SIGNALS[line] ? (t.hiddenStale ? "New insights from current research are on the way; the notes return with the next research update." : "No current market note matches the pieces in this capsule.") : "No market notes are loaded."}</p>`;
    return h;
  }
  function explainNow() { return engine.explain(state.capsule.anchors, allItems(), state.halves, { minQty: state.minQty }); }
  function openWhy() { if (!state.capsule) return; $("whyBody").innerHTML = whyHTML(explainNow()); openDlg("whyDlg"); }

  /* ---------- "View your capsule" link (hosted page; the capsule travels inside the link) ---------- */
  // v1.8.9: o.lb = label on the buyer's own piece (b / p / n; none = "Your pick"), o.mb = show the In the Know market brief on the page
  function capsuleLink(withPrices, o) {
    o = o || {};
    const page = (BASE.capsulePage || {}).url;
    if (!page || !state.capsule) return null;
    const u = activeUnits();
    const parts = orderedItems().map((o) => `${encodeURIComponent(o.it.sku)}:${engine.lineCost(o.it, u).units}`);
    let url = `${page}?l=${line}&i=${parts.join(",")}&a=${state.capsule.anchors.length}`;
    if (u === "reorder") url += "&u=r";
    if (state.buyer.trim()) url += `&st=${encodeURIComponent(state.buyer.trim())}`;
    if (state.capName.trim()) url += `&n=${encodeURIComponent(state.capName.trim())}`;
    if (withPrices) url += "&p=1";
    if (o.lb && /^[bpn]$/.test(o.lb)) url += `&lb=${o.lb}`;
    if (o.mb) url += "&mb=1";
    const ap = acctProfile(line);   // v1.9.0: the account's buyer-facing line rides along (never the rep's notes)
    if (ap && ap.pitch && ap.role !== "not a fit") url += `&ac=${encodeURIComponent(state.account)}`;
    return url + tagParams();
  }

  /* ---------- send log: every send, share, copy or platform export (for the monthly capsule report) ---------- */
  function logSend(channel, extra) {
    if (!state.capsule) return;   // v1.7.0: guided mode and the market brief can act before a capsule exists
    const s = summaryOf(), l = store.get(SEND_LOG, []);
    l.push(Object.assign({ sent_at: new Date().toISOString(), capsule_id: capId(), line, store: state.buyer.trim(), capsule: capTitle(), rep_code: state.rep,
      anchors: state.capsule.anchors.map((a) => a.sku).join(" "), styles: s.styles, total: s.total, order_type: activeUnits(), channel }, extra || {}));
    store.set(SEND_LOG, l.slice(-3000));
  }
  function exportSendLog() {
    const l = store.get(SEND_LOG, []);
    const cols = ["sent_at", "capsule_id", "line", "store", "capsule", "rep_code", "anchors", "styles", "total", "order_type", "channel", "to"];
    const rows = [cols].concat(l.map((r) => cols.map((c) => (r[c] == null ? "" : r[c]))));
    download(`capsule_send_log_${new Date().toISOString().slice(0, 10)}.csv`, "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  }

  /* ---------- Send capsule (v1.8.9): the capsule page as an email you copy and paste into any email program ----------
     Nothing opens another app on a computer and nothing is sent from here. Copy email puts the formatted email (photos,
     Order this capsule button, the market brief when ticked, terms) and a plain-text twin on the clipboard. */
  const SEND_LB = "capsule_send_lb";
  function sendDefaults() {
    const n = allItems().length, who = state.buyer.trim();
    $("sdSubj").value = `${cfg.name}: ${capTitle()}`;
    const a = state.capsule.anchors;
    $("sdMsg").value = [
      "Hi,",
      "",
      `Here is the ${cfg.name} capsule we put together${who ? " for " + who : ""}: ${n} styles${a.length ? `, built around the ${a[0].name.toLowerCase()} you liked` : ""}. Every piece is below, with why it was chosen.`,
      "",
      "Ready to order? The Order this capsule button opens our order page with these styles already filled in. Quantities and terms are at the end.",
    ].join("\n");
    $("sdSign").value = "Best,";
    $("sdLabel").value = store.get(SEND_LB, "");
  }
  const sendPrices = () => $("sdPrices").checked;
  const sendBriefOn = () => !!($("sdBrief") && $("sdBrief").checked && !$("sdBriefRow").classList.contains("hide"));
  const sendLink = () => capsuleLink(sendPrices(), { lb: $("sdLabel").value, mb: sendBriefOn() });
  const webBase = () => (BASE.webCopy || {}).url || "";
  // photos and logo by https address: the web copy's own files (a copy opened from a folder points at the web copy's)
  function absUrl(rel, fallback) {
    try { if (location.protocol === "https:") return new URL(rel, location.href).href; } catch (e) { /* use the web copy */ }
    return webBase() ? webBase() + fallback : "";
  }
  const mailImg = (it) => absUrl(it.img, `i-${line.toLowerCase()}-${it.sku}.jpg`);
  function emailModel() {
    const M = window.CB_MAIL, u = activeUnits(), withP = sendPrices(), L = M.labels($("sdLabel").value);
    const nA = state.capsule.anchors.length, ol = orderLink(), items = orderedItems();
    const cats = { necklace: 0, bracelet: 0, earring: 0 }; items.forEach((o) => cats[o.it.cat]++);
    let tot = 0, retail = 0, pcs = 0;
    const rows = items.map((o) => {
      const c = engine.lineCost(o.it, u); tot += c.total; retail += (o.it.msrp || 0) * c.units; pcs += c.units;
      return { cat: o.it.cat, img: mailImg(o.it), name: o.it.name, sku: o.it.sku, qty: window.CB_MAIL.qty(c.units, !!HT()),
        price: withP ? `${money(c.each)} each · ${money(c.total)}${o.it.msrp ? ` · retail ${money(o.it.msrp)}` : ""}` : "",
        why: o.anchor ? (nA > 1 ? L.many : L.one) : M.buyerWords(o.reason, L), tag: o.anchor ? L.tag : "" };
    });
    const f = (window.TREND_SIGNALS || {})[line];
    const contact = (cfg.lineSheet || {}).contactLine || "";
    return {
      accent: line === "OIYK" ? "#8d7bb8" : "#cf4331", logo: absUrl(cfg.logo, `logo_${line.toLowerCase()}.png`), name: cfg.name, tagline: cfg.sheetTagline || cfg.name,
      title: state.capName.trim() || (state.buyer.trim() ? `Curated for ${state.buyer.trim()}` : capTitle()),
      meta: M.meta(cats, items.length, u === "reorder", state.buyer.trim()),
      note: $("sdMsg").value, signoff: $("sdSign").value, orderUrl: ol ? ol.url : "", pageUrl: sendLink() || "",
      totals: withP ? { label: u === "reorder" ? "Reorder" : "Wholesale total", total: tot, pieces: pcs, retail } : null,
      groups: CATS.map((c) => ({ label: CAT_LABEL[c], items: rows.filter((r) => r.cat === c) })).filter((g) => g.items.length),
      brief: sendBriefOn() ? M.brief(f, line, new Date().toISOString().slice(0, 10), items.map((o) => o.it), engine) : null,
      terms: M.terms(cfg, engine, u === "reorder", withP),
      footer: [contact, state.rep ? `Your rep code: ${state.rep}` : "", `Capsule ${capId()}`].filter(Boolean).join(" · "),
    };
  }
  function sendText() { return window.CB_MAIL.emailText(emailModel()); }   // plain text (Copy as plain text; the clipboard's fallback)
  function sendHTML() { return window.CB_MAIL.emailHTML(emailModel()); }
  function drawSendSide() {
    const cl = sendLink();
    $("sdQR").innerHTML = cl ? qrSVG(cl, "L") : "";   // low error correction keeps a long link scannable on screen
    $("sdLink").textContent = cl || "";
    $("sdRep").innerHTML = state.rep ? `Rep code <b>${esc(state.rep)}</b> and capsule ID <b>${esc(capId())}</b> ride on both links, so the order is credited to you.` : `<span class="warn">No rep code set.</span> Add yours under Buyer so orders from this capsule are credited to you. Capsule ID <b>${esc(capId())}</b>.`;
    drawSendPreview();
  }
  // the preview is the email itself: what Copy email puts on the clipboard
  function drawSendPreview() {
    const fr = $("sdPrev"); if (!fr || !window.CB_MAIL || !state.capsule) return;
    fr.srcdoc = window.CB_MAIL.doc(sendHTML());
  }
  let sendT = 0;
  const sendRedraw = () => { clearTimeout(sendT); sendT = setTimeout(drawSendSide, 250); };
  function openSend() {
    if (!state.capsule) return;
    sendDefaults(); drawSendSide(); $("sdNote").innerHTML = "";
    $("sdShare").classList.toggle("hide", !window.CB_MAIL.touchDevice());
    openDlg("sendDlg");
  }
  async function copyEmail() {
    const ok = await window.CB_MAIL.copyRich(sendHTML(), sendText());
    if (ok) { logSend("copy-email", { to: $("sdTo").value.trim() }); flash("sdNote", "Email copied. Paste it into a new message in Gmail, Outlook, Apple Mail or any email program, add the subject and send it from there. Nothing is sent from here."); }
    else flash("sdNote", '<span class="warn">Copy is blocked in this browser.</span> Click inside the preview below, press Ctrl+A (⌘A on a Mac), then Ctrl+C (⌘C), and paste it into your email.');
  }
  function sendShare() {
    const cl = sendLink();
    navigator.share({ title: $("sdSubj").value, text: sendText().replace(cl, "").replace(/\n{3,}/g, "\n\n"), url: cl })
      .then(() => { logSend("share"); flash("sdNote", "Shared."); })
      .catch((e) => { if (e && e.name === "AbortError") return; copyText(sendText(), "sdNote", "Sharing isn't available here, so the message was"); logSend("copy-message"); });
  }

  /* ---------- Send to…: files for the platforms reps and buyers already use ---------- */
  function simpleXLSX(fileName, sheetName, header, rows, asBytes) {   // asBytes (v1.7.0): return the file instead of downloading it
    const x = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const col = (n) => { let s = ""; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
    const cell = (v, ref, st) => (typeof v === "number" && isFinite(v) ? `<c r="${ref}"${st}><v>${v}</v></c>` : v === "" || v == null ? `<c r="${ref}"${st}/>` : `<c r="${ref}"${st} t="inlineStr"><is><t>${x(v)}</t></is></c>`);
    const all = [header].concat(rows);
    const data = all.map((r, ri) => `<row r="${ri + 1}">${r.map((v, k) => cell(v, `${col(k)}${ri + 1}`, ri === 0 ? ' s="1"' : "")).join("")}</row>`).join("");
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${header.map((h, k) => `<col min="${k + 1}" max="${k + 1}" width="${Math.max(12, Math.min(40, String(h).length + 4))}" customWidth="1"/>`).join("")}</cols><sheetData>${data}</sheetData></worksheet>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    const bytes = zipStore([
      { name: "[Content_Types].xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
      { name: "_rels/.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: "xl/workbook.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${x(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
      { name: "xl/_rels/workbook.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: "xl/worksheets/sheet1.xml", text: sheet },
      { name: "xl/styles.xml", text: styles },
    ]);
    if (asBytes) return bytes;
    download(fileName, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }
  // one row per style: pieces at this order type; SKUs always go out as text
  function exportLines() {
    const u = activeUnits();
    return orderedItems().map((o) => { const c = engine.lineCost(o.it, u); return { it: o.it, units: c.units, each: Math.round(c.each * 100) / 100, total: Math.round(c.total * 100) / 100 }; });
  }
  const SEND_TO = [
    { id: "order", short: ["Shopify order page"], name: "Our order page (Shopify)", tag: "Default", what: "Every account. Opens onlyifyouknow.com with the capsule filled in; the rep code and capsule ID ride along into the order.", acts: [["Open ↗", () => { openOrderPage(); logSend("order-page"); }], ["Copy link", () => { const l = orderLink(); if (l) { copyText(l.url, "stNote", "Order link"); logSend("copy-order-link"); } }]] },
    { id: "markettime", short: ["MarketTime"], name: "MarketTime", what: "Quick Import file (.xlsx): Item Number + Quantity in pieces. In MarketTime: Basket → Quick Import. Works once the rep's agency has loaded our line with the same item numbers (agency-managed, no cost to us).", acts: [["Download .xlsx", () => { simpleXLSX(`${fileSafe(capTitle())}_MarketTime_QuickImport.xlsx`, "Quick Import", ["Item Number", "Quantity"], exportLines().map((r) => [r.it.sku, r.units])); logSend("export-markettime"); }]] },
    { id: "nuorder", short: ["NuORDER"], name: "NuORDER", what: "Order import file (.xlsx): Style Number, Season \"Core\", Color \"Multi\", Size \"One Size\", Quantity. In NuORDER: Working Order → Import. Only when the line is on NuORDER.", acts: [["Download .xlsx", () => { simpleXLSX(`${fileSafe(capTitle())}_NuORDER_import.xlsx`, "Order", ["Style Number", "Season", "Color", "Size", "Quantity"], exportLines().map((r) => [r.it.sku, "Core", "Multi", "One Size", r.units])); logSend("export-nuorder"); }]] },
    { id: "faire", short: ["Faire"], lines: ["RF"], name: "Faire (Faire Direct order)", what: "Faire has no order import: you write the order in Faire's brand portal and add each style by searching its SKU. The helper lists every style with its Faire SKU, quantity in Faire case packs and whether it's live on Faire, with a copy button per line and a checklist. The retailer then reviews and approves the order. Faire Direct orders from our own accounts carry 0% Faire commission.", acts: [["Faire order helper…", () => openFaire()]] },
    { id: "repzio", short: ["RepZio", "JOOR"], name: "RepZio · JOOR", what: "Neither takes an order file. Send the line sheet with SKUs showing and key the styles in; the order link above still works for the buyer.", acts: [["Line sheet…", () => { closeDlg("sendToDlg"); openSheet(); logSend("line-sheet"); }]] },
    { id: "upc", short: ["RepSpark"], name: "UPC + quantity (RepSpark, scanners)", what: "Needs UPCs, and the builder has none on file yet. Add a UPC column to the catalog data to turn this on.", acts: [] },
    { id: "repkit", lines: ["RF"], short: ["Rep kit"], name: "Rep kit: load our line on MarketTime or RepZio", what: "For a rep's agency that writes on MarketTime or RepZio: the whole Retro Forever line as an item file for each platform (per-piece price, minimum 6, order multiple 6, the dozen rule in the description) plus every official photo named SKU.jpg, in one .zip. The agency uploads it (MarketTime Items → Import; RepZio WebManager → Manage Data); no license on our side. OIYK stays off both platforms until 1Q 2027.", acts: [["Download rep kit .zip", () => window.CB_REPKIT && window.CB_REPKIT()]] },
    { id: "universal", short: ["Universal file"], name: "Universal order file", what: "Every column the platforms ask for, one row per style (.xlsx): item and style number, name, category, wholesale and retail price, pack, minimum, quantity, line total, image file, store, PO, date, rep code, capsule ID.", acts: [["Download .xlsx", () => {
      const u = activeUnits(), H = HT();
      const rows = exportLines().map((r) => [cfg.name, r.it.sku, r.it.sku, r.it.name, CAT_LABEL[r.it.cat].replace(/s$/, ""), label(r.it.dom), "One Size", "Core", "", r.each, r.it.msrp || "",
        H ? (r.units === H.units ? H.units : 12) : engine.unitsFor(r.it, u), engine.unitsFor(r.it, u), r.units, r.total, `${r.it.sku}.jpg`, state.buyer.trim(), "", today(), state.rep, capId()]);
      simpleXLSX(`${fileSafe(capTitle())}_order_universal.xlsx`, "Order", ["Brand", "Item Number", "Style Number", "Item Name", "Category", "Color", "Size", "Season", "UPC", "Wholesale Price", "Retail Price", "Case Pack", "Minimum Qty", "Quantity", "Line Total", "Image File", "Store Name", "PO Number", "Order Date", "Rep Code", "Capsule ID"], rows);
      logSend("export-universal"); }]] },
  ];
  /* v1.6.7: a generic icon per destination; v1.7.0: the platforms' own logos where Dan's store holds them
     (the same files as the "Works with" row on onlyifyouknow.com/pages/wholesale, loaded from his Shopify Files;
     each is its owner's trademark). No logo on file -> the plain glyph. */
  const ST_ICON = {
    order: '<path d="M4 9h16l-1.5 10.5a1 1 0 0 1-1 .5h-11a1 1 0 0 1-1-.5z"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2"/>',
    markettime: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 10v10"/><path d="M14.5 13.5v4M12.8 15.8l1.7 1.7 1.7-1.7"/>',
    nuorder: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 15.5h6M9 19h3.5"/>',
    faire: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/><path d="M9.5 13.5l1.8 1.8 3.4-3.6"/>',
    repzio: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><rect x="8" y="6.5" width="3.5" height="3.5"/><rect x="12.5" y="6.5" width="3.5" height="3.5"/><path d="M8 13.5h8M8 16.5h8"/>',
    upc: '<path d="M4 6v12M7 6v12M9.5 6v12M13 6v12M15 6v12M18 6v12M20 6v12"/>',
    repkit: '<path d="M4 8h16v12H4z"/><path d="M9 8V5h6v3"/><path d="M4 13h16"/>',
    universal: '<path d="M12 3l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16.5l8 4 8-4"/>',
  };
  const LOGO_BASE = "https://cdn.shopify.com/s/files/1/0702/5777/0723/files/";
  const ST_LOGOS = {
    order: ["logo-shopify.svg?v=1790459611"], markettime: ["logo-markettime.svg?v=1790459611"], nuorder: ["logo-nuorder.svg?v=1790459611"],
    faire: ["logo-faire.svg?v=1790459611"], repzio: ["logo-repzio.png?v=1790459610", "logo-joor.svg?v=1790459611"],
  };
  const glyph = (id) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ST_ICON[id] || ""}</svg>`;
  const stIcon = (id) => {
    const L = ST_LOGOS[id];
    if (!L) return `<span class="st-ic" aria-hidden="true">${glyph(id)}</span>`;
    return `<span class="st-ic st-logo${L.length > 1 ? " two" : ""}" aria-hidden="true" data-g="${id}">${L.map((f) => `<img src="${LOGO_BASE}${f}" alt="" loading="lazy">`).join("")}</span>`;
  };
  function stLogoFallback(root) {   // a logo that fails to load (offline) falls back to the glyph
    root.querySelectorAll(".st-logo img").forEach((im) => (im.onerror = () => { const t = im.closest(".st-logo"); if (t && !t.dataset.fb) { t.dataset.fb = 1; t.className = "st-ic"; t.innerHTML = glyph(t.dataset.g); } }));
  }
  // the sidebar button names every destination that has an action on this line
  function sendToLabel() {
    const names = SEND_TO.filter((p) => (!p.lines || p.lines.includes(line)) && p.acts.length).flatMap((p) => p.short);
    $("sendToBtn").innerHTML = `Send to…<small>${esc(names.join(" · "))}</small>`;
  }
  function openSendTo() {
    if (!state.capsule) return;
    $("stBody").innerHTML = SEND_TO.map((p, i) => p.lines && !p.lines.includes(line) ? "" : `<div class="st-row">${stIcon(p.id)}<div class="st-t"><b>${esc(p.name)}</b>${p.tag ? `<span class="pill">${esc(p.tag)}</span>` : ""}<div class="note">${esc(p.what)}</div></div><div class="st-a">${p.acts.length ? p.acts.map((a, k) => `<button class="btn" data-p="${i}" data-k="${k}">${esc(a[0])}</button>`).join("") : '<span class="note">Not available</span>'}</div></div>`).join("");
    $("stBody").querySelectorAll("button[data-p]").forEach((b) => (b.onclick = () => SEND_TO[+b.dataset.p].acts[+b.dataset.k][1]()));
    stLogoFallback($("stBody"));
    $("stNote").innerHTML = ""; openDlg("sendToDlg");
  }
  /* ---- v1.6.1: Faire Direct order helper (RF only; OIYK is never on Faire) ---- */
  const FAIRE_ORDERS = "https://www.faire.com/brand-portal/invoices";   // Orders -> Faire Direct tab (Faire Help Center, brand portal walkthrough)
  const fd = { key: "", done: new Set(), copied: new Set() };
  function faireInfo(sku) { const r = window.FAIRE_RF && window.FAIRE_RF.items[sku]; return r ? { status: r[0], pack: r[1], moq: r[2], fsku: r[3] || sku } : null; }
  function faireAsOf() { const d = window.FAIRE_RF && window.FAIRE_RF.asOf; return d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "unknown date"; }
  function faireRows() {
    return exportLines().map((r) => {
      const f = faireInfo(r.it.sku);
      const ok = !!f && f.status === "live";
      const cases = f && f.pack ? r.units / f.pack : null;
      const why = !f ? "Not on Faire" : f.status === "unpublished" ? "Unpublished on Faire" : f.status === "draft" ? "Draft on Faire" : "";
      return Object.assign({}, r, { f, ok, why, fsku: f ? f.fsku : r.it.sku, cases, packOk: !f || !f.pack || r.units % f.pack === 0 });
    });
  }
  function openFaire() {
    if (!state.capsule || line !== "RF") return;
    const key = capId() + "|" + exportLines().map((r) => r.it.sku + ":" + r.units).join(",");
    if (key !== fd.key) { fd.key = key; fd.done = new Set(); fd.copied = new Set(); }
    closeDlg("sendToDlg"); drawFaire(); openDlg("faireDlg"); logSend("faire-helper");
  }
  function faireListText(rows) { return ["Faire SKU\tQuantity (pieces)\tStyle"].concat(rows.map((r) => `${r.fsku}\t${r.units}\t${r.it.name}`)).join("\n"); }
  function drawFaire() {
    const rows = faireRows(), live = rows.filter((r) => r.ok), off = rows.filter((r) => !r.ok);
    const pcs = live.reduce((a, r) => a + r.units, 0), done = rows.filter((r) => fd.done.has(r.it.sku)).length;
    const store = state.buyer.trim();
    const status = off.length
      ? `<div class="fd-flag warn"><b>${off.length} of ${rows.length} styles can't be added on Faire as listed</b> (Faire product export of ${faireAsOf()}): ${off.map((r) => `${esc(r.it.sku)} (${esc(r.why.charAt(0).toLowerCase() + r.why.slice(1))})`).join(", ")}. Publish them in Faire first, swap them here, or book those styles on our order page.</div>`
      : `<div class="fd-flag ok">All ${rows.length} styles are live on Faire (Faire product export of ${faireAsOf()}).</div>`;
    const packWarn = rows.filter((r) => r.f && !r.packOk);
    $("fdBody").innerHTML = `
      <ol class="fd-steps">
        <li>Open Faire&rsquo;s brand portal: <b>Orders &rarr; Faire Direct</b>, create an order and pick or add the retailer${store ? ` (<b>${esc(store)}</b>)` : ""}.</li>
        <li>For each style below: <b>Copy SKU</b>, paste it into Faire&rsquo;s product search, add it and set the quantity. Tick it off here once it&rsquo;s in.</li>
        <li>Send it. The retailer gets an email to review, pay and approve &mdash; nothing is ordered until they do.</li>
      </ol>
      ${status}
      ${packWarn.length ? `<div class="fd-flag warn">${packWarn.map((r) => esc(r.it.sku)).join(", ")}: quantity isn't a whole number of Faire&rsquo;s ${packWarn[0].f.pack}-piece case. Round it in Faire.</div>` : ""}
      <table class="fd-t"><thead><tr><th>In Faire</th><th></th><th>Faire SKU &middot; style</th><th class="num">Quantity</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="${fd.done.has(r.it.sku) ? "done" : ""} ${r.ok ? "" : "off"}">
        <td><input type="checkbox" data-done="${esc(r.it.sku)}" ${fd.done.has(r.it.sku) ? "checked" : ""} ${r.ok ? "" : "disabled"} aria-label="${esc(r.fsku)} entered in Faire"></td>
        <td class="im"><img src="${esc(r.it.img)}" alt=""></td>
        <td><b>${esc(r.fsku)}</b>${r.fsku !== r.it.sku ? `<span class="pill" title="Faire's SKU text differs from our style code">Faire SKU</span>` : ""}<div class="note">${esc(r.it.name)}${r.ok ? "" : ` &middot; <span class="warn">${esc(r.why)}</span>`}</div></td>
        <td class="num"><b>${r.units}</b> pcs<div class="note">${r.cases != null && r.packOk ? `${r.cases} case${r.cases === 1 ? "" : "s"} of ${r.f.pack}` : ""}</div></td>
        <td class="act">${r.ok ? `<button class="btn fd-copy ${fd.copied.has(r.it.sku) ? "was" : ""}" data-copy="${esc(r.it.sku)}">${fd.copied.has(r.it.sku) ? "Copied &#10003;" : "Copy SKU"}</button>` : ""}</td></tr>`).join("")}
      </tbody></table>
      <div class="fd-prog"><div class="bar"><i style="width:${live.length ? Math.round((done / live.length) * 100) : 0}%"></i></div><span><b>${done} of ${live.length}</b> styles entered in Faire &middot; ${pcs} pieces to add</span></div>
      <div class="row fd-foot">
        <a class="btn primary" href="${FAIRE_ORDERS}" target="_blank" rel="noopener">Open Faire &rarr; Orders &#8599;</a>
        <button class="btn" id="fdCopyAll">Copy full list</button>
        <button class="btn" id="fdCsv">Download list (.csv)</button>
      </div>
      <details class="fd-peek"><summary>What &ldquo;Copy full list&rdquo; puts on the clipboard</summary><pre>${esc(faireListText(live))}</pre><div class="note">Faire can&rsquo;t import this list; keep it beside you as a checklist or send it to whoever enters the order.</div></details>
      <div class="note" id="fdNote" aria-live="polite"></div>`;
    $("fdBody").querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => {
      const r = rows.find((x) => x.it.sku === b.dataset.copy);
      copyText(r.fsku, "fdNote", r.fsku, `<b>${esc(r.fsku)}</b> copied — paste it into Faire’s product search and set <b>${r.units} pcs</b>.`);
      fd.copied.add(r.it.sku); b.classList.add("was"); b.innerHTML = "Copied &#10003;";
    }));
    $("fdBody").querySelectorAll("[data-done]").forEach((c) => (c.onchange = () => { if (c.checked) fd.done.add(c.dataset.done); else fd.done.delete(c.dataset.done); drawFaire(); }));
    $("fdCopyAll").onclick = () => { copyText(faireListText(live), "fdNote", "", `Full list copied: ${live.length} styles, ${pcs} pcs.`); logSend("export-faire"); };
    $("fdCsv").onclick = () => {
      const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const lines = [["Faire SKU", "Style", "Name", "Quantity (pieces)", "Faire case pack", "Cases", "On Faire"].map(q).join(",")]
        .concat(rows.map((r) => [r.fsku, r.it.sku, r.it.name, r.units, r.f ? r.f.pack : "", r.cases != null && r.packOk ? r.cases : "", r.ok ? "Yes" : r.why].map(q).join(",")));
      download(`${fileSafe(capTitle())}_Faire_order_list.csv`, "\ufeff" + lines.join("\r\n"), "text/csv;charset=utf-8");
      flash("fdNote", "Faire order list downloaded."); logSend("export-faire-csv");
    };
  }

  function drawRepNote() {
    const list = BASE.repCodes || [];
    $("repNote").innerHTML = !state.rep ? "Rides on every link, QR code and export so orders from your capsules are credited to you."
      : list.length && !list.map(cleanRep).includes(state.rep) ? `<span class="warn">${esc(state.rep)} isn't on the list of issued rep codes — check it.</span>` : `Orders from your capsules are credited to <b>${esc(state.rep)}</b>.`;
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
  $("regenBtn").onclick = () => build();   // back to the top-ranked capsule for this pick and settings (locks kept)
  $("anotherBtn").onclick = () => build({ exclude: state.capsule.picks.filter((p) => !state.locked.has(p.item.sku)).map((p) => p.item.sku) });
  $("csvBtn").onclick = exportCSV;
  $("sendBtn").onclick = openSend;
  $("sendToBtn").onclick = openSendTo; sendToLabel();
  $("whyBtn").onclick = openWhy;
  $("sendLogBtn").onclick = exportSendLog;
  $("sdCopyEmail").onclick = copyEmail;
  $("sdShare").onclick = sendShare;
  $("sdCopy").onclick = () => { copyText(sendText(), "sdNote", "Plain-text email"); logSend("copy-message"); };
  $("sdCopySubj").onclick = () => copyText($("sdSubj").value, "sdNote", "Subject");
  $("sdCopyLink").onclick = () => { copyText(sendLink(), "sdNote", "Capsule link"); logSend("copy-capsule-link"); };
  $("sdOpen").onclick = () => { window.open(sendLink(), "_blank", "noopener"); };
  $("sdPrices").onchange = drawSendSide;
  $("sdLabel").onchange = () => { store.set(SEND_LB, $("sdLabel").value); drawSendSide(); };
  ["sdMsg", "sdSign"].forEach((id) => ($(id).oninput = sendRedraw));
  if ($("sdBrief")) $("sdBrief").addEventListener("change", drawSendSide);
  $("repCode").value = state.rep; drawRepNote();
  $("repCode").oninput = () => { state.rep = cleanRep($("repCode").value); store.set("capsule_rep", state.rep); drawRepNote(); };
  $("repCode").onchange = () => { $("repCode").value = state.rep; };
  $("xlsxBtn").onclick = exportXLSX;
  $("orderPageBtn").onclick = openOrderPage;
  $("sheetBtn").onclick = openSheet;
  $("printBtn").onclick = printSheet; $("pdfBtn").onclick = downloadSheetPDF; $("emailPdfBtn").onclick = emailSheetPDF;
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
  // v1.7.0: the API app/instore.js builds on (the store, boards, market brief, guided mode, buyer packet, rep kit)
  window.__cb = {
    state, hooks: HOOKS, store, esc, money, money0, label, CATS, CAT_LABEL, VOCAB, $,
    line: () => line, cfg: () => cfg, engine: () => engine, catalog: () => catalog, acctOf, acctProfile, runHooks,
    build, renderBoard, setAnchor, switchLine, setMode, setBudget, drawPresets, persist, applyContext, normCtx,
    orderLink, capsuleLink, capId, capTitle, qrSVG, absUrl, emailModel, drawSendSide, orderedItems, allItems, explainNow, trendNow, fmtDay, activeUnits, unitsLabel, qtyWord, minFor, wsShort, priceLine,
    buildSheet: () => { setPageRule(); return buildSheet(); }, sheetPDF, qrBox, pdfOverlay, wsText, openSheet, renderSheetPreview, openSend, openDlg, closeDlg, flash, toast, copyText, logSend, download, zipStore, simpleXLSX, fileSafe, parseCSV, csvCell,
    newCapsule, openRecord, lib, saveCapsule, recordFromState, restoreBoard: (b) => restoreBoard(b), HT, sheetMailText,
    // v1.7.6: a capsule of exactly these SKUs (Find similar picks), or those added to the capsule on the board
    buildFromPicks: (skus, o) => {
      o = o || {}; skus = [...new Set(skus)].filter((s) => engine.bySku.has(s)); if (!skus.length) return false;
      let anchors, picks;
      if (o.add && state.capsule) {
        anchors = state.anchors.filter(Boolean);
        const cur = state.capsule.anchors.map((a) => a.sku).concat(state.capsule.picks.map((p) => p.item.sku));
        picks = [...new Set(cur.concat(skus))].filter((s) => !anchors.includes(s));
      } else { anchors = [skus[0]]; picks = skus.slice(1); }
      return restoreBoard({ line, anchors, picks, exact: true, name: o.name || "", size: anchors.length + picks.length });
    },
    setSize: (n) => { state.size = n; if (state.mode !== "pieces") { state.mode = "pieces"; $("modePieces").classList.add("on"); $("modeBudget").classList.remove("on"); $("piecesBox").classList.remove("hide"); $("budgetBox").classList.add("hide"); } resetMix(true); persist(); if (state.anchors[0]) build(); },
  };
  function restoreBoard(b) {   // open a board: its anchors, and its picks if it has them (else a fresh build at its size or budget)
    if (b.line && b.line !== line) loadLine(b.line);
    state.loadedId = null; state.tmpId = null;
    state.anchors = [b.anchors[0] || null, b.anchors[1] || null].map((x) => (x && engine.bySku.has(x) ? x : null));
    if (!state.anchors[0]) return false;
    state.capName = b.name || ""; state.capNameEdited = !!b.name; $("capName").value = state.capName;
    if (b.account !== undefined) { state.account = b.account || ""; runHooks("account"); }
    state.locked.clear(); state.halves = new Set(); syncHalves();
    if (b.budget) { state.mode = "budget"; state.budget = b.budget; } else { state.mode = "pieces"; state.size = b.size || BASE.defaultSize; state.counts = null; }
    $("modePieces").classList.toggle("on", state.mode === "pieces"); $("modeBudget").classList.toggle("on", state.mode === "budget");
    $("piecesBox").classList.toggle("hide", state.mode !== "pieces"); $("budgetBox").classList.toggle("hide", state.mode !== "budget");
    renderSlot(0); renderSlot(1); drawPresets(); resetMix(true); $("buildBtn").disabled = false;
    if (b.picks && (b.picks.length || b.exact)) {
      applyContext();
      state.capsule = engine.restore(state.anchors.filter(Boolean), b.picks, { colorwayStory: state.story, minQty: state.minQty });
      if (state.mode === "budget") { state.capsule.budget = { budget: state.budget, units: state.units }; recalcBudget(); }
      state.alt = true;
      ["regenBtn", "anotherBtn", "sheetBtn", "xlsxBtn", "orderPageBtn", "csvBtn", "saveBtn", "saveNewBtn", "sendBtn", "sendToBtn", "whyBtn"].forEach((x) => ($(x).disabled = false));
      renderBoard();
    } else build();
    persist(); renderLib();
    return true;
  }
  window.__capsule = { orderLink, state, engine: () => engine, build, buildSheet: () => { setPageRule(); return buildSheet(); }, openSheet, exportXLSX, setSheet: (o) => { Object.assign(state.sheet, o, { fields: Object.assign(state.sheet.fields, (o || {}).fields || {}) }); persist(); }, orderedItems, setAnchor, switchLine, setMode, setBudget, saveCapsule, openRecord, lib, line: () => line, capsuleLink, capId, explain: explainNow, sendText, sendHTML, emailModel, openSend, openSendTo, exportLines, SEND_TO, openFaire, faireInfo, setRep: (v) => { state.rep = cleanRep(v); store.set("capsule_rep", state.rep); } };
})();
