/* Capsule Builder v1.9.3: the Line Book (Dan, 2 Oct 2026).
   The full Retro Forever and Only If You Know lines for a rep at a booth or on the road, built for an iPad: big official
   photos, tap to open, swipe through colorways, and every fact a buyer asks (materials, length, wholesale, retail, first-order
   minimum, stock or lead time, In the Know trend notes, and the fit with a chosen account).
   It reads the builder's own data files (config, catalogs, order-page lists, trends, accounts, engine), so prices, minimums and
   terms always match the Capsule Builder and the order pages. Extra facts and the website's high-resolution photos come from
   app/lbdata.js (tools/build_linebook.py).
   Runs beside the builder in a second tab: "Send to Capsule Builder" drops the picks into the builder's capsule (same-origin
   localStorage message "cb_lb_cmd", read by app/lb_bridge.js), and the builder's current capsule shows here as a tick on its
   pieces ("cb_lb_board"). The pick tray also opens the order page pre-filled (with the rep code) and the buyer's capsule page. */
(function () {
  "use strict";
  const B = window.CAPSULE_CONFIG, CE = window.CapsuleEngine;
  if (!B || !CE) return;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };
  const money = (v) => "$" + (Math.round((+v || 0) * 100) / 100).toFixed(2);
  const retail = (v) => "$" + ((+v || 0) % 1 ? (+v).toFixed(2) : String(+v || 0));
  const X = window.LB_DATA || { RF: {}, OIYK: {} };
  const ACC = window.ACCOUNTS || { groups: [], accounts: [] };
  const TR = window.TREND_SIGNALS || {};
  const TODAY = new Date().toISOString().slice(0, 10);
  const qs = new URLSearchParams(location.search);
  const cleanRep = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
  // Attribution belongs to this link, never to a previously visited tab.
  // Leave Capsule Builder's shared context intact.
  const linkRep = cleanRep(qs.get("rep"));
  let linkGroups = qs.get("grp") && qs.get("grp") !== "all" ? qs.get("grp").split(",").filter(Boolean) : null;
  const rep = () => linkRep;
  const LINE_NAME = { RF: "Retro Forever", OIYK: "Only If You Know™" };
  const CAT = { necklace: "Necklaces", bracelet: "Bracelets", earring: "Earrings" };
  const STYLE = { boho: "Boho", minimal: "Minimal", "retro/vintage": "Retro & vintage", glam: "Glam & sparkle", playful: "Playful color", "classic pearl": "Pearl", coastal: "Coastal", statement: "Statement" };
  const MOTIF = { "cross/faith": "Cross & faith", heart: "Hearts", "ocean/shell": "Sea life & shell", "floral/botanical": "Flowers", "animal print": "Animal print", "evil eye": "Evil eye", celestial: "Celestial", "coin/medallion": "Coins & medallions", butterfly: "Butterflies", bow: "Bows", geometric: "Geometric" };
  const FAM = { "ivory/pearl": "#efe7d6", gold: "#d4af37", "coral/red": "#e0604a", neutral: "#b79b7c", "crystal/clear": "#dfe9ef", "blush pink": "#f2c2c6", white: "#ffffff", black: "#222", "cobalt/navy": "#27407a", turquoise: "#3fb6b0", grey: "#9a9a9a", "emerald/green": "#2e8b57", silver: "#c0c0c0", "hot pink": "#e2408f", "seafoam/mint": "#9edcc4", blue: "#5b8fd6", aqua: "#6fd3d8", orange: "#ec8b3a", "lavender/purple": "#a58bd0", yellow: "#efce4a" };
  const PRICE = [["u20", "Under $20", 0, 20], ["20-40", "$20–$40", 20, 40], ["40-100", "$40–$100", 40, 100], ["100", "$100 and up", 100, 1e9]];

  /* ------------------------------------------------ the two lines, exactly as the builder loads them */
  const L = {};
  for (const id of ["RF", "OIYK"]) {
    const src = window["CATALOG_" + id];
    if (!src) continue;
    const cfg = Object.assign({}, B, B.lines[id] || {});
    const op = (window.ORDER_PAGE || {})[id];
    if (cfg.orderPage && op) cfg.orderPage = Object.assign({}, cfg.orderPage, { skus: op.skus });
    const catalog = { line: src.line, built: src.built, tagFile: src.tagFile, flags: (src.flags || []).slice(), items: src.items.map((i) => Object.assign({}, i)) };
    const eng = new CE.Engine(catalog, cfg);
    const listed = new Set(((cfg.orderPage || {}).skus || []).map((s) => String(s).toUpperCase()));
    const trends = new Map();
    try {
      const r = CE.trendNotes(TR[id], id, catalog.items, TODAY, { max: 99 });
      for (const n of r.notes) { if (n.general) continue; for (const s of n.pieces) { const a = trends.get(s) || []; a.push(n); trends.set(s, a); } }
      trends.forEach((a, k) => trends.set(k, a.sort((x, y) => (!!x.evergreen - !!y.evergreen) || x.share - y.share).slice(0, 3)));
    } catch (e) { /* trends are optional */ }
    const bases = new Map();
    catalog.items.forEach((it) => { const k = it.base || it.sku; (bases.get(k) || bases.set(k, []).get(k)).push(it); });
    L[id] = { id, cfg, eng, items: catalog.items, listed, trends, bases };
  }
  const allItems = () => Object.values(L).flatMap((l) => l.items);
  const lineOf = (it) => L[it.line] || L[String(it.sku).startsWith("OY") ? "OIYK" : "RF"];
  const extra = (it) => (X[it.line] || {})[it.sku] || {};
  const firstOrder = (it) => { const l = lineOf(it); try { return l.eng.lineCost(it, "first"); } catch (e) { return { units: 12, each: it.ws, total: 12 * it.ws }; } };
  const trendOf = (it) => lineOf(it).trends.get(it.sku) || [];
  // "Trending": a dated In the Know signal that is rising or new (not the steady or perennial notes); the most specific first
  const hot = (it) => trendOf(it).filter((n) => !n.evergreen && /^(rising|new)$/i.test(n.direction || "")).sort((a, b) => a.share - b.share);
  const dated = (it) => hot(it).length > 0;
  // v1.9.8: stock is the catalog snapshot, so the date it was read travels with it
  const STOCK_AS_OF = (() => { const b = String(((window.CATALOG_RF || {}).built) || "").slice(0, 10); const d = new Date(b + "T12:00:00"); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); })();
  function stockOf(it) {
    if (it.line === "OIYK" || it.mto) return { cls: "mto", text: "Made to order", long: "Made to order: 45- to 60-day lead times on most styles. Reorders of in-stock styles ship from our U.S. warehouse in about 10 business days." };
    const q = +it.qty || 0;
    if (q >= 24) return { cls: "ok", text: "In stock", long: "In stock at our U.S. warehouse" };
    if (q >= 12) return { cls: "lim", text: "Limited stock", long: `Limited stock (${q} on hand)` };
    if (q > 0) return { cls: "low", text: "Last few", long: `Last few: ${q} on hand, sold by the half dozen` };
    return { cls: "out", text: "Out of stock", long: "Out of stock" };
  }

  /* ------------------------------------------------ accounts (same lens as the builder's Account picker) */
  const groupsShown = () => { const g = linkGroups; return Array.isArray(g) && g.length ? g : null; };
  const groupName = (g) => ((ACC.groups || []).find((x) => x.id === g) || {}).name || g;
  const acctById = (id) => (ACC.accounts || []).find((a) => a.id === id) || null;
  function fitOf(it) {
    const a = acctById(S.acct);
    if (!a || !a.lines || !a.lines[it.line]) return null;
    try { return CE.accountFit(it, Object.assign({ accountName: a.name }, a.lines[it.line])); } catch (e) { return null; }
  }
  const fitCls = (f) => (!f ? "" : f.hard || f.out ? "off" : f.grade || "good");

  /* ------------------------------------------------ state */
  const S = Object.assign({ line: "RF", cat: "", style: "", motif: "", fam: "", price: "", trend: false, stock: false, acct: "", sort: "featured", group: true, ws: true }, store.get("cb_lb_ui", {}));
  S.q = "";
  if (!qs.get("rep") && !qs.get("grp") && !qs.get("acct")) S.acct = "";
  if (qs.get("line") && /^(RF|OIYK|ALL)$/.test(qs.get("line"))) S.line = qs.get("line");
  if (qs.get("acct") && acctById(qs.get("acct"))) S.acct = qs.get("acct");
  const save = () => { const o = Object.assign({}, S); delete o.q; store.set("cb_lb_ui", o); };
  let tray = store.get("cb_lb_tray", { RF: [], OIYK: [] });
  if (!tray || !Array.isArray(tray.RF) || !Array.isArray(tray.OIYK)) tray = { RF: [], OIYK: [] };
  const saveTray = () => { store.set("cb_lb_tray", tray); drawTrayBtn(); };
  const inTray = (it) => tray[it.line].includes(it.sku);
  let board = store.get("cb_lb_board", null);
  const inBoard = (it) => !!(board && board.line === it.line && (board.skus || []).includes(it.sku));

  /* ------------------------------------------------ filtering + sorting */
  function matches(it, skip) {
    if (S.line !== "ALL" && it.line !== S.line) return false;
    if (S.cat && it.cat !== S.cat) return false;
    if (S.style && it.style !== S.style) return false;
    if (S.motif && !(it.motifs || []).includes(S.motif)) return false;
    if (S.fam && !(it.fams || []).includes(S.fam)) return false;
    if (S.price) { const p = PRICE.find((x) => x[0] === S.price); if (p && !(it.msrp >= p[2] && it.msrp < p[3])) return false; }
    if (S.trend && !dated(it)) return false;   // "Trending now": the dated In the Know signals, not the perennial notes
    if (S.stock && it.line === "RF" && !((+it.qty || 0) >= 24)) return false;
    if (S.acct && skip !== "acct") { const f = fitOf(it); if (f && (f.hard)) return false; }
    if (S.q) {
      const hay = [it.sku, it.name, it.cname, it.mtext, it.style, (it.motifs || []).join(" "), (it.fams || []).join(" "), it.cat, it.collection].join(" ").toLowerCase();
      if (!S.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
    }
    return true;
  }
  function score(it) {
    let s = 0;
    if (S.acct) { const f = fitOf(it); s += f ? f.s * 100 : 40; }
    const h = hot(it)[0];
    if (h) s += 20 + 10 * (1 - h.share); else if (trendOf(it).length) s += 5;
    if (it.line === "RF") s += Math.min(20, (+it.qty || 0) / 10);
    return s;
  }
  // Featured: a varied first screen. Keeps the ranking but doesn't repeat a trend within four cards or a category three in a row.
  function mix(list) {
    const key = (it) => (hot(it)[0] || {}).id || "none:" + it.cat, out = [], rest = list.slice();
    while (rest.length) {
      const last = out.slice(-3).map(key), cats = out.slice(-2).map((x) => x.cat);
      let i = rest.findIndex((it) => !last.includes(key(it)) && !(cats.length === 2 && cats[0] === it.cat && cats[1] === it.cat));
      if (i < 0 || i > 150) i = 0;
      out.push(rest.splice(i, 1)[0]);
    }
    list.splice(0, list.length, ...out);
  }
  function results() {
    const list = allItems().filter((it) => matches(it));
    const by = { featured: (a, b) => score(b) - score(a) || a.name.localeCompare(b.name), low: (a, b) => a.msrp - b.msrp || a.name.localeCompare(b.name), high: (a, b) => b.msrp - a.msrp || a.name.localeCompare(b.name), name: (a, b) => a.name.localeCompare(b.name), stock: (a, b) => (+b.qty || 0) - (+a.qty || 0) };
    list.sort(by[S.sort] || by.featured);
    if (S.sort === "featured" && !S.acct) mix(list);
    if (!S.group) return list.map((it) => ({ key: it.sku, it, colors: [it] }));
    const seen = new Map(), out = [];
    for (const it of list) {
      const k = it.line + ":" + (it.base || it.sku);
      if (seen.has(k)) { seen.get(k).colors.push(it); continue; }
      const g = { key: k, it, colors: [it] }; seen.set(k, g); out.push(g);
    }
    return out;
  }

  /* ------------------------------------------------ rendering */
  let view = [];   // the cards on screen, in order (detail view pages through them)
  const imgSrc = (it) => it.img;
  function dots(colors) {
    if (colors.length < 2) return "";
    return `<span class="dots">${colors.slice(0, 6).map((c) => `<i style="background:${FAM[c.dom] || FAM[(c.fams || [])[0]] || "#ccc"}"></i>`).join("")}<em>${colors.length} colors</em></span>`;
  }
  function badges(it) {
    const b = [], st = stockOf(it);
    const h = hot(it)[0];
    if (h) b.push(`<span class="bd tr" title="In the Know: ${esc(h.trend)} (${esc(h.direction)})">↑ ${esc(h.trend.length > 30 ? h.trend.slice(0, 28).replace(/\s+\S*$/, "") + "…" : h.trend)}</span>`);
    if (st.cls !== "ok") b.push(`<span class="bd ${st.cls}">${esc(st.text)}</span>`);
    const f = S.acct ? fitOf(it) : null;
    if (f) b.push(`<span class="bd fit ${fitCls(f)}">${esc(f.label)}</span>`);
    return b.join("");
  }
  function card(g, i) {
    const it = g.it, l = lineOf(it), fo = firstOrder(it);
    return `<div class="card${inTray(it) ? " picked" : ""}" data-i="${i}" role="button" tabindex="0" aria-label="${esc(it.name)}">
      <div class="im"><img loading="lazy" decoding="async" src="${esc(imgSrc(it))}" alt="${esc(it.name)}">${g.colors.some(inBoard) ? `<span class="inb" title="In the builder's capsule">✓ In capsule</span>` : ""}
        <button class="add" data-add="${esc(it.sku)}" aria-label="${inTray(it) ? "Remove from picks" : "Add to picks"}">${inTray(it) ? "✓" : "+"}</button></div>
      <div class="b"><div class="ln ${l.id.toLowerCase()}">${esc(LINE_NAME[l.id])}</div><div class="nm">${esc(it.name)}</div>
        <div class="sub">${g.colors.length > 1 ? dots(g.colors) : esc(it.cname || "")} <span class="sku">${esc(it.sku)}</span></div>
        <div class="px"><b>${retail(it.msrp)}</b> retail${S.ws ? ` · <span>${money(fo.each)} wholesale</span>` : ""}</div>
        <div class="bds">${badges(it)}</div></div></div>`;
  }
  function draw() {
    view = results();
    const n = view.length, styles = view.reduce((a, g) => a + g.colors.length, 0);
    $("count").textContent = S.group ? `${n} styles · ${styles} colorways` : `${n} pieces`;
    $("grid").innerHTML = n ? view.map(card).join("") : `<div class="empty"><b>Nothing matches.</b>Clear a filter or the search.</div>`;
    drawChips();
    save();
  }

  /* ------------------------------------------------ filter bar */
  function counts(key, val) { const o = Object.assign({}, S); S[key] = val; const c = allItems().filter((it) => matches(it)).length; Object.assign(S, o); return c; }
  function chip(key, val, label) {
    const on = S[key] === val;
    return `<button class="chip${on ? " on" : ""}" data-k="${key}" data-v="${esc(val)}">${esc(label)}</button>`;
  }
  function drawChips() {
    document.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.line === S.line));
    $("cats").innerHTML = chip("cat", "", "All") + Object.entries(CAT).map(([k, v]) => chip("cat", k, v)).join("");
    $("tog").innerHTML = `<button class="chip${S.trend ? " on" : ""}" data-t="trend">★ Trending now</button>` +
      `<button class="chip${S.stock ? " on" : ""}" data-t="stock" title="Retro Forever colorways with 24 or more on hand${STOCK_AS_OF ? ` (stock as of ${STOCK_AS_OF})` : ""}. Styles with fewer can still fill smaller first-order quantities.">24+ in stock (RF)</button>` +
      `<button class="chip${S.group ? " on" : ""}" data-t="group">One card per style</button>` +
      `<button class="chip${S.ws ? " on" : ""}" data-t="ws">Wholesale prices</button>`;
    const sel = (id, key, opts) => { const el = $(id); el.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join(""); el.value = S[key]; el.classList.toggle("set", !!S[key]); };
    sel("fStyle", "style", [["", "Any look"]].concat(Object.entries(STYLE).filter(([k]) => counts("style", k))));
    sel("fMotif", "motif", [["", "Any motif"]].concat(Object.entries(MOTIF).filter(([k]) => counts("motif", k))));
    sel("fFam", "fam", [["", "Any color"]].concat(Object.keys(FAM).filter((k) => counts("fam", k)).map((k) => [k, k.replace(/\//g, " / ").replace(/^./, (c) => c.toUpperCase())])));
    sel("fPrice", "price", [["", "Any retail price"]].concat(PRICE.map((p) => [p[0], p[1]])));
    sel("fSort", "sort", [["featured", S.acct ? "Best fit first" : "Featured"], ["low", "Price: low to high"], ["high", "Price: high to low"], ["name", "Name"], ["stock", "Most in stock"]]);
    const shown = groupsShown(), by = {};
    (ACC.accounts || []).filter((a) => !shown || shown.includes(a.group) || a.id === S.acct).forEach((a) => (by[a.group] = by[a.group] || []).push(a));
    $("fAcct").innerHTML = `<option value="">No account lens</option>` + Object.entries(by).map(([g, list]) => `<optgroup label="${esc(groupName(g))}">${list.map((a) => `<option value="${esc(a.id)}">${esc(a.name.split(" (")[0])}</option>`).join("")}</optgroup>`).join("") + (shown ? `<option value="__all">Show every account…</option>` : "");
    $("fAcct").value = S.acct; $("fAcct").classList.toggle("set", !!S.acct);
    const any = S.cat || S.style || S.motif || S.fam || S.price || S.trend || S.stock || S.q || S.acct;
    $("clear").classList.toggle("hide", !any);
    const a = acctById(S.acct);
    $("acctNote").innerHTML = a ? `<b>${esc(a.name.split(" (")[0])}</b>: pieces it never carries are hidden; the rest are sorted by how well they fit how it merchandises jewelry today. ${a.lines[S.line === "ALL" ? "RF" : S.line] && a.lines[S.line === "ALL" ? "RF" : S.line].summary ? esc(a.lines[S.line === "ALL" ? "RF" : S.line].summary) : ""}` : "";
    if (a) $("acctNote").innerHTML += `<div class="adisc">About the account lens: a representative guide that compares our styles with ${esc(a.name.split(" (")[0])}'s publicly listed jewelry assortment${a.checked ? ` as of ${esc(new Date(String(a.checked) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }))}` : ""}. It is not the retailer's own product line, buying plan or order. Retro Forever and Only If You Know™ are not affiliated with, sponsored by or endorsed by this retailer, and its name and trademarks belong to their owner.</div>`;   // v1.9.5 (Dan, 3 Oct 2026)
    $("acctNote").classList.toggle("hide", !a);
    document.body.classList.toggle("line-oiyk", S.line === "OIYK");
    $("logo").src = S.line === "OIYK" ? "logo_oiyk.png?h=64cbd40d" : "logo_rf.png?h=88500682";
  }

  /* ------------------------------------------------ detail sheet */
  let cur = -1, curSku = null, zoom = false, photo = 0;
  function photos(it) {
    const e = extra(it), list = [];
    if (e.hd) list.push({ src: e.hd + "?width=1400", fb: it.img });
    list.push({ src: it.img, fb: it.img, sq: true });
    (e.more || []).forEach((u) => list.push({ src: u + "?width=1400", fb: null }));
    return e.hd ? list.filter((p, i) => !(p.sq && i === 1)) : list;   // the website photo replaces the square one; it's the fallback
  }
  function openAt(i, sku) {
    if (i < 0 || i >= view.length) return;
    cur = i; const g = view[i];
    const it = sku ? (g.colors.find((c) => c.sku === sku) || lineOf(g.it).items.find((c) => c.sku === sku) || g.it) : g.it;
    curSku = it.sku; photo = 0; zoom = false;
    drawDetail(it);
    $("detail").classList.remove("hide"); document.body.classList.add("noscroll");
    try { history.replaceState(null, "", "#" + encodeURIComponent(it.sku)); } catch (e) { /* ignore */ }
  }
  function closeDetail() { $("detail").classList.add("hide"); document.body.classList.remove("noscroll"); cur = -1; try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ } }
  function drawDetail(it) {
    const l = lineOf(it), e = extra(it), fo = firstOrder(it), st = stockOf(it), terms = l.cfg.terms || {};
    const sibs = (l.bases.get(it.base || it.sku) || [it]);
    const ph = photos(it), p = ph[Math.min(photo, ph.length - 1)];
    const f = fitOf(it), tn = trendOf(it);
    const unitsTxt = l.id === "RF" ? (fo.units === 6 ? "½ dozen" : fo.units % 12 === 0 ? `${fo.units / 12} dozen` : `${fo.units} pcs`) : `${fo.units} pcs`;
    const setNote = l.id === "OIYK" && fo.units < 12 ? ` (this style is made in sets of ${fo.units})` : "";
    const tiers = l.id === "OIYK" && it.tiers && Object.keys(it.tiers).length && fo.units < 12 ? `<tr><th>Set prices</th><td>${Object.entries(it.tiers).sort((a, b) => a[0] - b[0]).map(([u, v]) => `${u}+: ${money(v)}`).join(" · ")}</td></tr>` : "";
    const onPage = l.listed.has(String(it.sku).toUpperCase());
    $("dBody").innerHTML = `
      <div class="dimg${zoom ? " zoom" : ""}">
        <img id="dPhoto" src="${esc(p.src)}" alt="${esc(it.name)}" data-fb="${esc(p.fb || "")}">
        ${ph.length > 1 ? `<div class="pdots">${ph.map((_, k) => `<button data-ph="${k}" class="${k === photo ? "on" : ""}" aria-label="Photo ${k + 1}"></button>`).join("")}</div>` : ""}
        <button class="nav prev" data-nav="-1" aria-label="Previous">‹</button><button class="nav next" data-nav="1" aria-label="Next">›</button>
      </div>
      <div class="dinfo">
        <div class="ln ${l.id.toLowerCase()}">${esc(LINE_NAME[l.id])}</div>
        <h2>${esc(it.name)}</h2>
        <div class="dsub">${esc(it.cname || "")} · <span class="sku">${esc(it.sku)}</span></div>
        <div class="dpx"><div><span>Retail</span><b>${retail(it.msrp)}</b></div>${S.ws ? `<div><span>Wholesale</span><b>${money(fo.each)}</b></div><div><span>First order</span><b>${esc(unitsTxt)}</b>${money(fo.total)}</div>` : ""}</div>
        ${sibs.length > 1 ? `<div class="sw"><div class="lbl">${sibs.length} colorways</div><div class="swr">${sibs.map((c) => `<button class="swc${c.sku === it.sku ? " on" : ""}" data-sku="${esc(c.sku)}" title="${esc(c.cname || c.sku)}"><img loading="lazy" src="${esc(c.img)}" alt=""><span>${esc(c.cname || c.sku)}</span></button>`).join("")}</div></div>` : ""}
        <div class="acts">
          <button class="btn primary" data-act="tray">${inTray(it) ? "✓ In your picks (remove)" : "+ Add to picks"}</button>
          <button class="btn" data-act="send" title="Adds this piece to the capsule open in the Capsule Builder">Send to Capsule Builder</button>
          ${onPage ? `<a class="btn" target="_blank" rel="noopener" href="${esc(orderLink(l.id, [it]))}">Order this style ↗</a>` : ""}
        </div>
        <p class="desc">${esc(it.desc || "")}</p>
        ${tn.length ? `<div class="itk"><div class="lbl">In the Know</div>${tn.map((n) => `<p><b>${esc(n.trend)}</b>${n.evergreen ? "" : ` <span class="dir">${esc(n.direction || "")}</span>`}<br>${esc(n.text)}</p>`).join("")}</div>` : ""}
        ${f ? `<div class="fitbox ${fitCls(f)}"><div class="lbl">${esc(acctById(S.acct).name.split(" (")[0])}: ${esc(f.label)}</div>${(f.plus || []).slice(0, 3).map((x) => `<p>+ ${esc(x)}</p>`).join("")}${(f.minus || []).slice(0, 2).map((x) => `<p>– ${esc(x)}</p>`).join("")}</div>` : ""}
        <table class="facts">
          <tr><th>Availability</th><td><span class="bd ${st.cls}">${esc(st.text)}</span> ${esc(st.long)}${it.line === "RF" && STOCK_AS_OF ? ` <span class="small">(stock as of ${esc(STOCK_AS_OF)})</span>` : ""}</td></tr>
          <tr><th>Minimum</th><td>${esc(unitsTxt)} a style on a first order${esc(setNote)}; ${money(terms.orderMinimum || 0)} order minimum${l.id === "RF" ? ". Sold by the dozen; a first order may include a few ½-dozen styles." : ". Reorders: a dozen a style."}</td></tr>
          ${tiers}
          <tr><th>Materials</th><td>${esc(it.mtext || (it.mats || []).join(", "))}</td></tr>
          ${e.len ? `<tr><th>Length</th><td>${esc(e.len)}${e.ext ? ` plus ${esc(e.ext)} extender` : ""}</td></tr>` : ""}
          ${e.extPendant ? `<tr><th>Extension / pendant</th><td>${esc(e.extPendant)}</td></tr>` : ""}
          ${e.wt ? `<tr><th>Weight</th><td>${esc(e.wt)}</td></tr>` : ""}
          <tr><th>Category</th><td>${esc(CAT[it.cat] || it.cat)}${it.sub ? " · " + esc(it.sub) : ""}${it.collection ? " · " + esc(it.collection) + " collection" : ""}</td></tr>
          ${terms.retailNote ? `<tr><th>Retail</th><td>${esc(terms.retailNote)}</td></tr>` : ""}
          ${onPage ? "" : `<tr><th>Ordering</th><td>Not on the wholesale order page yet: write it in the order notes or ask us.</td></tr>`}
        </table>
      </div>`;
    // the builder's own photo shows at once (it's already on the page); the website's high-resolution photo replaces it
    // when it has loaded, so a slow or offline booth connection never leaves a blank frame
    const im = $("dPhoto"), want = p.src, key = it.sku + ":" + photo;
    im.onerror = () => { const fb = im.dataset.fb; if (fb && im.getAttribute("src") !== fb) im.src = fb; };
    if (p.fb && want !== p.fb) {
      im.src = p.fb;
      const hi = new Image();
      hi.onload = () => { if (curSku + ":" + photo === key && $("dPhoto") === im) im.src = want; };
      hi.src = want;
    }
    $("dPos").textContent = view.length ? `${cur + 1} of ${view.length}` : "";
  }

  /* ------------------------------------------------ links: order page, capsule page, builder */
  function orderLink(line, items) {
    const l = L[line], op = l.cfg.orderPage; if (!op) return "";
    const parts = items.filter((it) => l.listed.has(String(it.sku).toUpperCase())).map((it) => {
      const u = firstOrder(it).units, q = op.qtyIn === "pieces" ? u : Math.round((u / 12) * 2) / 2;
      return `${encodeURIComponent(it.sku)}:${q}`;
    });
    let url = `${op.url}?cart=${parts.join(",")}`;
    const st = store.get("cb_lb_store", "");
    if (st.trim()) url += `&store=${encodeURIComponent(st.trim())}`;
    if (rep()) url += `&rep=${encodeURIComponent(rep())}`;
    return url;
  }
  function capsulePageLink(line, items) {
    const page = (B.capsulePage || {}).url; if (!page || !items.length) return "";
    let url = `${page}?l=${line}&i=${items.map((it) => `${encodeURIComponent(it.sku)}:${firstOrder(it).units}`).join(",")}&a=1`;
    const st = store.get("cb_lb_store", "");
    if (st.trim()) url += `&st=${encodeURIComponent(st.trim())}`;
    url += `&n=${encodeURIComponent(st.trim() ? `Picked for ${st.trim()}` : "Picked from the line book")}&lb=p`;
    if (rep()) url += `&rep=${encodeURIComponent(rep())}`;
    return url;
  }
  function builderUrl() {
    if (location.protocol === "file:") return "Capsule Builder.html";
    const u = (B.builderPage || {}).url || "index.html";
    const p = new URLSearchParams();   // v1.9.8: the Line Book's own link context (rep, account groups) travels to the builder
    if (rep()) p.set("rep", rep());
    if (linkGroups && linkGroups.length) p.set("grp", linkGroups.join(","));
    const q = p.toString();
    return u + (q ? "?" + q : "");
  }
  // Send SKUs to the Capsule Builder: a builder tab that is open (any tab on this site) picks the message up at once and
  // answers; with none open, a new builder tab opens and reads the waiting message when it loads (lb_bridge.js).
  function sendToBuilder(line, skus, mode) {
    if (!skus.length) return;
    const id = "lb" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    store.set("cb_lb_cmd", { id, line, skus, mode: mode || "add", name: String(store.get("cb_lb_store", "")).trim(), t: Date.now() });
    let done = false;
    const onAck = (e) => { if (e.key === "cb_lb_ack") { const a = store.get("cb_lb_ack", {}); if (a.id === id) { done = true; toast(a.text || "Sent to the Capsule Builder"); window.removeEventListener("storage", onAck); } } };
    window.addEventListener("storage", onAck);
    setTimeout(() => {
      if (done) return;
      window.removeEventListener("storage", onAck);
      const w = window.open(builderUrl(), "cb_builder");
      toast(w ? "Opening the Capsule Builder with your picks…" : "Open the Capsule Builder: your picks are waiting there");
    }, 900);
  }

  /* ------------------------------------------------ pick tray */
  function drawTrayBtn() { const n = tray.RF.length + tray.OIYK.length; $("trayN").textContent = n || ""; $("trayBtn").classList.toggle("has", n > 0); }
  function toggleTray(it) {
    const a = tray[it.line], k = a.indexOf(it.sku);
    if (k >= 0) a.splice(k, 1); else a.push(it.sku);
    saveTray();
    return k < 0;
  }
  function drawTray() {
    const st = esc(store.get("cb_lb_store", ""));
    const sec = (id) => {
      const l = L[id]; if (!l) return "";
      const items = tray[id].map((s) => l.eng.bySku.get(s)).filter(Boolean);
      if (!items.length) return "";
      const tot = items.reduce((a, it) => a + firstOrder(it).total, 0), min = (l.cfg.terms || {}).orderMinimum || 0;
      const off = items.filter((it) => !l.listed.has(String(it.sku).toUpperCase()));
      return `<section class="tsec"><h3><span class="ln ${id.toLowerCase()}">${esc(LINE_NAME[id])}</span> <small>${items.length} styles</small></h3>
        ${items.map((it) => { const fo = firstOrder(it); return `<div class="trow"><img src="${esc(it.img)}" alt=""><div><b>${esc(it.name)}</b><small>${esc(it.sku)} · ${esc(it.cname || "")}</small>${S.ws ? `<small>${id === "RF" ? (fo.units === 6 ? "½ dozen" : fo.units / 12 + " dozen") : fo.units + " pcs"} × ${money(fo.each)} = ${money(fo.total)}</small>` : ""}</div><button class="x" data-rm="${esc(it.sku)}" data-line="${id}" aria-label="Remove">×</button></div>`; }).join("")}
        ${S.ws ? `<div class="ttot">First order <b>${money(tot)}</b> ${tot >= min ? `<span class="okm">meets the ${money(min)} minimum</span>` : `<span class="lowm">${money(min - tot)} under the ${money(min)} minimum</span>`}</div>` : ""}
        ${off.length ? `<div class="small warn">Not on the order page yet, so not pre-filled: ${off.map((i) => esc(i.sku)).join(", ")}</div>` : ""}
        <div class="tacts"><button class="btn primary" data-send="${id}">Open in Capsule Builder</button>
          <a class="btn" target="_blank" rel="noopener" data-olink="${id}" href="#">Order page, pre-filled ↗</a>
          <a class="btn" target="_blank" rel="noopener" data-clink="${id}" href="#">Buyer's capsule page ↗</a>
          <button class="btn ghost" data-clear="${id}">Clear</button></div></section>`;
    };
    const body = sec("RF") + sec("OIYK");
    $("trayBody").innerHTML = `<label class="f" for="trayStore">Store name <span class="small">(goes on the order page and capsule page)</span></label><input id="trayStore" type="text" value="${st}" placeholder="e.g. Sea Breeze Boutique">`
      + `<div class="small">Rep code: <b>${esc(rep() || "none")}</b>${rep() ? "" : " (orders are credited only when this page is opened from your own rep link or from the Capsule Builder)"}</div>`
      + (body || `<div class="empty"><b>No picks yet.</b>Tap + on any piece. Retro Forever and Only If You Know™ picks stay separate, as they order separately.</div>`);
    const upd = () => document.querySelectorAll("[data-olink],[data-clink]").forEach((a) => {
      const id = a.dataset.olink || a.dataset.clink, items = tray[id].map((s) => L[id].eng.bySku.get(s)).filter(Boolean);
      a.href = a.dataset.olink ? orderLink(id, items) : capsulePageLink(id, items);
    });
    $("trayStore").oninput = () => { store.set("cb_lb_store", $("trayStore").value.slice(0, 80)); upd(); };
    upd();
  }
  function openTray() { drawTray(); $("tray").classList.remove("hide"); }

  /* ------------------------------------------------ toast */
  let tt;
  function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("on"), 2600); }

  /* ------------------------------------------------ events */
  document.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => { S.line = b.dataset.line; draw(); window.scrollTo({ top: 0 }); }));
  $("filters").addEventListener("click", (e) => {
    const c = e.target.closest(".chip"); if (!c) return;
    if (c.dataset.t) S[c.dataset.t] = !S[c.dataset.t];
    else if (c.dataset.k) S[c.dataset.k] = S[c.dataset.k] === c.dataset.v ? "" : c.dataset.v;
    draw();
  });
  [["fStyle", "style"], ["fMotif", "motif"], ["fFam", "fam"], ["fPrice", "price"], ["fSort", "sort"]].forEach(([id, k]) => ($(id).onchange = () => { S[k] = $(id).value; draw(); }));
  $("fAcct").onchange = () => {
    if ($("fAcct").value === "__all") { linkGroups = null; drawChips(); return; }
    S.acct = $("fAcct").value; if (S.acct) S.sort = "featured"; draw();
  };
  let qt; $("q").oninput = () => { clearTimeout(qt); qt = setTimeout(() => { S.q = $("q").value.trim(); draw(); }, 160); };
  $("clear").onclick = () => { Object.assign(S, { cat: "", style: "", motif: "", fam: "", price: "", trend: false, stock: false, acct: "", q: "" }); $("q").value = ""; draw(); };
  $("grid").addEventListener("click", (e) => {
    const a = e.target.closest("[data-add]");
    if (a) {
      e.stopPropagation();
      const it = allItems().find((x) => x.sku === a.dataset.add); if (!it) return;
      const on = toggleTray(it); toast(on ? `Added ${it.name}` : `Removed ${it.name}`);
      const c = a.closest(".card"); c.classList.toggle("picked", on); a.textContent = on ? "✓" : "+";
      return;
    }
    const c = e.target.closest(".card"); if (c) openAt(+c.dataset.i);
  });
  $("grid").addEventListener("keydown", (e) => { if (e.key === "Enter") { const c = e.target.closest(".card"); if (c) openAt(+c.dataset.i); } });
  $("detail").addEventListener("click", (e) => {
    const t = e.target;
    if (t.id === "detail" || t.closest("[data-close]")) return closeDetail();
    const it = allItems().find((x) => x.sku === curSku);
    const nav = t.closest("[data-nav]"); if (nav) return openAt(cur + +nav.dataset.nav);
    const sw = t.closest("[data-sku]"); if (sw) { const s = lineOf(it).eng.bySku.get(sw.dataset.sku); curSku = s.sku; photo = 0; return drawDetail(s); }
    const pd = t.closest("[data-ph]"); if (pd) { photo = +pd.dataset.ph; return drawDetail(it); }
    const act = t.closest("[data-act]");
    if (act && act.dataset.act === "tray") { const on = toggleTray(it); toast(on ? `Added ${it.name}` : `Removed ${it.name}`); drawDetail(it); draw(); return; }
    if (act && act.dataset.act === "send") return sendToBuilder(it.line, [it.sku], "add");
    if (t.id === "dPhoto") { zoom = !zoom; t.closest(".dimg").classList.toggle("zoom", zoom); if (zoom) { const r = t.getBoundingClientRect(); t.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`; } }
  });
  // swipe: left/right pages through the results, on the photo it pages through the photos first
  let sx = null, sy = null;
  $("detail").addEventListener("touchstart", (e) => { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
  $("detail").addEventListener("touchend", (e) => {
    if (sx == null || zoom) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    const it = allItems().find((x) => x.sku === curSku), ph = photos(it), onPhoto = e.target.closest(".dimg");
    if (onPhoto && ph.length > 1 && ((dx < 0 && photo < ph.length - 1) || (dx > 0 && photo > 0))) { photo += dx < 0 ? 1 : -1; return drawDetail(it); }
    openAt(cur + (dx < 0 ? 1 : -1));
  }, { passive: true });
  document.addEventListener("keydown", (e) => {
    if ($("detail").classList.contains("hide")) { if (e.key === "Escape") $("tray").classList.add("hide"); return; }
    if (e.key === "Escape") closeDetail(); else if (e.key === "ArrowRight") openAt(cur + 1); else if (e.key === "ArrowLeft") openAt(cur - 1);
  });
  $("trayBtn").onclick = openTray;
  $("tray").addEventListener("click", (e) => {
    const t = e.target;
    if (t.id === "tray" || t.closest("[data-tclose]")) return $("tray").classList.add("hide");
    const rm = t.closest("[data-rm]"); if (rm) { const a = tray[rm.dataset.line]; a.splice(a.indexOf(rm.dataset.rm), 1); saveTray(); drawTray(); draw(); return; }
    const cl = t.closest("[data-clear]"); if (cl) { tray[cl.dataset.clear] = []; saveTray(); drawTray(); draw(); return; }
    const sd = t.closest("[data-send]"); if (sd) return sendToBuilder(sd.dataset.send, tray[sd.dataset.send].slice(), "new");
  });
  $("builderBtn").onclick = (e) => { e.preventDefault(); window.open(builderUrl(), "cb_builder"); };
  window.addEventListener("storage", (e) => {
    if (e.key === "cb_lb_board") { board = store.get("cb_lb_board", null); draw(); }
    if (e.key === "cb_lb_tray") { tray = store.get("cb_lb_tray", tray); drawTrayBtn(); }
  });

  /* ------------------------------------------------ start */
  $("totals").textContent = Object.values(L).map((l) => `${l.items.length} ${LINE_NAME[l.id]}`).join(" · ");
  drawTrayBtn(); draw();
  const h = decodeURIComponent((location.hash || "").slice(1));
  if (h) { const it = allItems().find((x) => x.sku === h); if (it) { S.line = S.line === "ALL" ? "ALL" : it.line; draw(); const i = view.findIndex((g) => g.colors.some((c) => c.sku === h)); if (i >= 0) openAt(i, h); } }
  window.__lb = { S, L, draw, results, openAt, closeDetail, tray: () => tray, toggleTray, sendToBuilder, orderLink, capsulePageLink, fitOf, trendOf, stockOf, firstOrder, extra, photos };
})();
