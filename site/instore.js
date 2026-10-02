/* Capsule Builder v1.7.0 "In the store" (v1.7.5: In the Know social side in "About this research"): tabs, Market brief (In the Know), store size, extra line-sheet pages
   (market brief, shown with the store, buyer packet), Boards and the rep kit. Builds on window.__cb (app/ui.js). */
(function () {
  "use strict";
  const A = window.__cb;
  if (!A) return;
  const { $, esc, state, money } = A;
  const today = () => new Date().toISOString().slice(0, 10);
  const dayNum = (d) => Math.floor(Date.parse(String(d).slice(0, 10) + "T00:00:00Z") / 86400000);

  /* ================================================= tabs */
  const PANES = ["capsule", "store", "boards", "brief"];
  let pane = "capsule";
  function show(p) {
    if (!PANES.includes(p)) p = "capsule";
    pane = p;
    PANES.forEach((k) => $("pane" + k[0].toUpperCase() + k.slice(1)).classList.toggle("hide", k !== p));
    document.querySelectorAll(".mtabs [data-pane]").forEach((b) => b.classList.toggle("on", b.dataset.pane === p));
    if (p === "brief") drawBrief();
    if (p === "boards") drawBoards();
    if (p === "store" && window.CB_CONTEXT) window.CB_CONTEXT.draw();
    if (p === "store" && window.CB_SIMILAR) window.CB_SIMILAR.draw();   // v1.7.4 (draws only when Find similar is open)
    try { sessionStorage.setItem("cb_pane", p); } catch (e) { /* ignore */ }
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  window.CB_PANE = show;

  /* ================================================= market brief (In the Know) */
  // The Rep & Buyer Brief from the latest In the Know edition for this line (buyer-safe: no brand, retailer or price
  // claims), with its trend notes. Line-locked; hidden from buyer-facing outputs 60 days after the edition.
  function briefFile() { const T = window.TREND_SIGNALS || {}; const f = T[A.line()]; return f && f.brief && String(f.line).toUpperCase() === A.line() ? f : null; }
  function briefAge(f) { return dayNum(today()) - dayNum(f.edition || (f.signals[0] || {}).asOf); }
  function briefLive(f) { return f && briefAge(f) <= (f.maxAgeDays == null ? 60 : f.maxAgeDays); }
  function liveSignals(f) {
    const max = f.maxAgeDays == null ? 60 : f.maxAgeDays, now = dayNum(today());
    return (f.signals || []).filter((s) => { const a = now - dayNum(s.asOf); return a >= 0 && a <= max && String(s.direction).toLowerCase() !== "cooling"; });
  }
  function matchedIds() {
    if (!state.capsule) return new Set();
    const r = A.engine().trendNotes(window.TREND_SIGNALS[A.line()], A.orderedItems().map((o) => o.it), today(), { max: 99 });
    return new Set(r.notes.map((n) => n.id));
  }
  const expires = (f) => A.fmtDay(new Date((dayNum(f.edition) + (f.maxAgeDays == null ? 60 : f.maxAgeDays)) * 86400000).toISOString().slice(0, 10));
  // v1.7.2: "About this research": proprietary, how wide, which kinds of sources, how often it's refreshed (buyer-safe)
  const methodOf = (f) => f.method || null;
  const cap1 = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  function aboutText(f) {
    const M = methodOf(f); if (!M) return [];
    return ["ABOUT THIS RESEARCH", M.who, (M.stats || []).map((x) => `${x[0]} ${x[1]}`).join(" · ") + ".", M.design, M.retail, M.social, M.rigor, M.cadence].filter(Boolean);
  }
  function aboutHTML(f, compact) {
    const M = methodOf(f); if (!M) return "";
    if (compact) return `<div class="about"><b>About this research.</b> ${esc(M.who)} ${esc((M.stats || []).map((x) => `${x[0]} ${x[1]}`).join(" · "))}.<br><b>Design side:</b> ${esc(cap1(M.design.replace(/^What's being designed:\s*/, "")))}<br><b>Retail side:</b> ${esc(cap1(M.retail.replace(/^What's actually selling:\s*/, "")))}${M.social ? `<br><b>Social side:</b> ${esc(cap1(M.social.replace(/^What's being shared:\s*/, "")))}` : ""}<br>${esc(M.rigor)} <b>${esc(M.cadence)}</b></div>`;
    return `<div class="panel bf-about"><h3>About this research</h3><p>${esc(M.who)}</p>
      <div class="bf-stats">${(M.stats || []).map((x) => `<div><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join("")}</div>
      <div class="bf-two"><p><b>The design side: what's being designed.</b> ${esc(cap1(M.design.replace(/^What's being designed:\s*/, "")))}</p><p><b>The retail side: what's actually selling.</b> ${esc(cap1(M.retail.replace(/^What's actually selling:\s*/, "")))}</p>${M.social ? `<p><b>The social side: what's being shared.</b> ${esc(cap1(M.social.replace(/^What's being shared:\s*/, "")))}</p>` : ""}</div>
      <p>${esc(M.rigor)}</p><p><b>${esc(M.cadence)}</b></p><p class="note">This edition: ${esc(A.fmtDay(f.edition))}. Shared text names no brand, retailer, price or sales figure.</p></div>`;
  }
  function briefText(f) {
    const B = f.brief, sig = liveSignals(f);
    return [B.title.toUpperCase(), "", B.lede, "", "WHAT THE MARKET IS DOING", ...B.points.map((p) => "- " + p), "", "DISPLAY IDEAS A STORE CAN COPY", ...B.display.map((p) => "- " + p), "", "TIMING", ...B.timing.map((p) => "- " + p),
      ...(sig.length ? ["", "TREND NOTES", ...sig.map((s) => "- " + s.buyerLine)] : []), ...(methodOf(f) ? ["", ...aboutText(f)] : []), "", `${A.cfg().name} · Market brief from In the Know, ${A.fmtDay(f.edition)}.`].join("\n");
  }
  function dots(n) { return `<span class="dots" title="Confidence ${n} of 3">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`; }
  function drawBrief() {
    const el = $("paneBrief"), f = briefFile();
    if (!f) { el.innerHTML = `<div class="bf"><h1>Market brief</h1><p class="note">No In the Know brief is loaded for ${esc(A.cfg().name)} yet. It arrives with the next trend-signal refresh.</p></div>`; return; }
    const B = f.brief, live = briefLive(f), sig = liveSignals(f), hit = matchedIds();
    el.innerHTML = `<div class="bf">
      <div class="bf-top"><span class="eyebrow">Market brief · ${esc(f.label || A.cfg().name)} · In the Know, ${esc(A.fmtDay(f.edition))} edition</span><span class="chip safe">No brand names · safe to share</span></div>
      ${live ? "" : `<div class="short">This brief is due to be replaced with new insights from current research. Until the next update arrives it stays off buyer-facing sends and line sheets.</div>`}
      <h1>${esc(B.title)}</h1><p class="lede">${esc(B.lede)}</p>
      <div class="row bf-acts"><button class="btn primary" id="bfMail" ${live ? "" : "disabled"} title="Copies the brief as a formatted email. Paste it into any email program.">Copy for email</button><button class="btn${window.CB_MAIL && window.CB_MAIL.touchDevice() ? "" : " hide"}" id="bfShare" ${live ? "" : "disabled"}>Share…</button><button class="btn" id="bfCopy" ${live ? "" : "disabled"}>Copy as text</button><button class="btn" id="bfPdf" ${live ? "" : "disabled"}>Download PDF</button>
        <label class="tog"><input type="checkbox" id="bfSheet" ${state.sheet.brief ? "checked" : ""} ${live ? "" : "disabled"}> Add to the line sheet PDF</label>
        <label class="tog"><input type="checkbox" id="bfSend" ${A.store.get("capsule_brief_in_send", false) ? "checked" : ""} ${live ? "" : "disabled"}> Add to "Send capsule" emails and capsule pages</label></div>
      <div class="note" id="bfNote"></div>
      <div class="bf-grid">
        <div class="panel"><h3>What the market is doing</h3><ul>${B.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
        <div class="panel"><h3>Display ideas a store can copy</h3><ul>${B.display.map((p) => `<li>${esc(p)}</li>`).join("")}</ul><h3>Timing</h3><ul>${B.timing.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
      </div>
      <h3 class="bf-h">Trend notes</h3><p class="note">A note shows on a ${esc(A.cfg().name)} capsule when its pieces match. These notes reflect research through ${esc(A.fmtDay(f.edition))} and will be replaced with new insights from current research by ${esc(expires(f))}.${state.capsule ? " Marked: notes that match the capsule on the board." : ""}</p>
      <div class="bf-sigs">${sig.map((s) => `<div class="panel sig ${hit.has(s.id) ? "hit" : ""}"><div class="meta"><span class="dir">${esc(s.direction)}</span>${dots(s.confidence || 1)}${s.source === "social" ? `<span class="pill soc" title="From the social and customer-post read">Social</span>` : ""}${hit.has(s.id) ? `<span class="pill">In this capsule</span>` : ""}</div><p>${esc(s.buyerLine)}</p></div>`).join("")}</div>
      ${aboutHTML(f)}</div>`;
    const subj = () => `${A.cfg().name}: ${B.title}`;
    $("bfCopy").onclick = () => { A.copyText(briefText(f), "bfNote", "Brief"); A.logSend("brief-copy"); };
    // v1.8.9: a formatted email on the clipboard; nothing opens another app (Dan, 2 Oct 2026)
    $("bfMail").onclick = async () => {
      const M = window.CB_MAIL, cfg = A.cfg();
      const bm = M.brief(f, A.line(), today(), state.capsule ? A.orderedItems().map((o) => o.it) : [], A.engine());
      if (!bm) return;
      const o = { accent: A.line() === "OIYK" ? "#8d7bb8" : "#cf4331", logo: A.absUrl(cfg.logo, `logo_${A.line().toLowerCase()}.png`), name: cfg.name, brief: bm,
        note: "Hi,\n\nHere is our read of what the market is launching this season, with display ideas you can use.", signoff: "Best,", footer: (cfg.lineSheet || {}).contactLine || "" };
      const ok = await M.copyRich(M.briefEmailHTML(o), M.briefEmailText(o));
      if (ok) { A.logSend("brief-copy-email"); A.flash("bfNote", `Brief copied as an email. Paste it into a new message in any email program; subject: <b>${esc(subj())}</b>. Nothing is sent from here.`); }
      else A.flash("bfNote", '<span class="warn">Copy is blocked in this browser.</span> Use Copy as text instead.');
    };
    $("bfShare").onclick = async () => {
      let file = null; try { file = await briefPDF(f); } catch (e) { /* no PDF from a local copy */ }
      const data = file && navigator.canShare && navigator.canShare({ files: [file] }) ? { files: [file], title: subj(), text: briefText(f) } : { title: subj(), text: briefText(f) };
      if (!navigator.share) { A.copyText(briefText(f), "bfNote", "Sharing isn't available here, so the brief was"); return; }
      navigator.share(data).then(() => A.logSend("brief-share")).catch(() => {});
    };
    $("bfPdf").onclick = async () => { try { const file = await briefPDF(f); A.download(file.name, file, "application/pdf"); A.logSend("brief-pdf"); } catch (e) { A.flash("bfNote", "This copy can't make the PDF. Use the web copy (onlyifyouknow.com/pages/capsule-builder)."); } };
    $("bfSheet").onchange = () => { state.sheet.brief = $("bfSheet").checked; A.persist(); A.flash("bfNote", state.sheet.brief ? "The brief is now the last page of the line sheet." : "Off the line sheet."); };
    $("bfSend").onchange = () => { A.store.set("capsule_brief_in_send", $("bfSend").checked); if ($("sdBrief")) $("sdBrief").checked = $("bfSend").checked; if (state.capsule && A.drawSendSide) A.drawSendSide(); };
  }
  function briefPageHTML(f, hit) {
    const B = f.brief, sig = liveSignals(f);
    return `<div class="sh-brief"><div class="sh-title">${esc(B.title)}</div><div class="lede">${esc(B.lede)}</div><div class="sh-rule"></div>
      <div class="cols"><div><h5>What the market is doing</h5><ul>${B.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
      <div><h5>Display ideas a store can copy</h5><ul>${B.display.map((p) => `<li>${esc(p)}</li>`).join("")}</ul><h5>Timing</h5><ul>${B.timing.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div></div>
      ${sig.length ? `<h5>Trend notes</h5><ul class="sig">${sig.map((s) => `<li>${esc(s.buyerLine)}${hit && hit.has(s.id) ? " <b>· in this capsule</b>" : ""}</li>`).join("")}</ul>` : ""}
      ${aboutHTML(f, true)}<div class="src">Market brief from In the Know, ${esc(A.fmtDay(f.edition))}. No brand names.</div></div>`;
  }
  // v1.7.5: the brief always fits its page. With the social read it runs longer, so the type steps down until it fits (never under 7pt)
  function fitBrief(pg) {
    const el = pg && pg.querySelector(".sh-brief"); if (!el) return;
    for (let fs = 9.6; fs >= 7; fs -= 0.2) { el.style.fontSize = fs.toFixed(1) + "pt"; if (el.scrollHeight <= el.clientHeight + 1) break; }
  }
  // a stand-alone brief PDF (one Letter page), drawn the same way as the line sheet PDF
  async function briefPDF(f) {
    if (!window.jspdf || !window.html2canvas) throw new Error("pdf");
    const host = document.createElement("div"); host.style.cssText = "position:fixed;left:-20000px;top:0;background:#fff;";
    document.body.appendChild(host);
    try {
      const pg = document.createElement("div"); pg.className = "sheet sheet-" + A.line().toLowerCase(); pg.style.width = "7.6in"; pg.style.height = "10.1in";
      pg.innerHTML = `<div class="sh-mini"><img src="${esc(A.cfg().logo)}" alt=""><div class="t"><small>${esc(A.cfg().name)}</small>Market brief</div></div>` + briefPageHTML(f, null) + `<div class="sh-foot"><span class="l"></span><span class="c">${esc(A.cfg().lineSheet.contactLine)}</span><span class="r"></span></div>`;
      host.appendChild(pg); fitBrief(pg);
      await Promise.all([...host.querySelectorAll("img")].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
      const c = await window.html2canvas(pg, { scale: 2, backgroundColor: "#ffffff", logging: false });
      const doc = new window.jspdf.jsPDF({ unit: "in", format: "letter", orientation: "portrait", compress: true });
      doc.addImage(c.toDataURL("image/jpeg", 0.9), "JPEG", 0.45, 0.45, 7.6, 10.1, undefined, "FAST");
      return new File([doc.output("blob")], `${A.fileSafe(A.cfg().name + " market brief " + f.edition)}.pdf`, { type: "application/pdf" });
    } finally { host.remove(); }
  }
  // v1.8.9: Send capsule builds the brief into the email itself (app/email.js), and onto the capsule page (&mb=1)

  /* ================================================= store size -> budget */
  function storeNote(msg) { $("storeNote").innerHTML = msg || ""; }
  function drawStoreSize() {
    const S = A.cfg().storeSizes || { sizes: [] };
    $("storeSize").innerHTML = `<option value="">Not set</option>` + S.sizes.map((z) => `<option value="${z.id}" ${state.storeSize === z.id ? "selected" : ""}>${esc(z.label)}: ${esc(z.sales)}</option>`).join("") + `<option value="custom" ${String(state.storeSize).startsWith("$") ? "selected" : ""}>I know the store's monthly jewelry sales…</option>`;
    $("storeSales").classList.toggle("hide", !String(state.storeSize).startsWith("$") && $("storeSize").value !== "custom");
    if (String(state.storeSize).startsWith("$")) $("storeSales").value = state.storeSize.slice(1);
  }
  function applyStoreSize(v) {
    const S = A.cfg().storeSizes, min = (A.cfg().terms || {}).orderMinimum || 0;
    let budget = null, why = "";
    if (!v) { state.storeSize = ""; storeNote(""); A.persist(); return; }
    if (v.startsWith("$")) {
      const sales = +v.slice(1); if (!(sales > 0)) return;
      budget = Math.round((sales * S.pctOfMonthly) / 25) * 25; why = `${Math.round(S.pctOfMonthly * 100)}% of ${money(sales, 0)} a month in jewelry sales`;
    } else {
      const z = S.sizes.find((x) => x.id === v); if (!z) return;
      budget = z.budget; why = `${z.label} store (${z.sales}; roughly ${z.traffic})${z.note ? ", " + z.note : ""}`;
    }
    let note = `Budget set to <b>${money(budget, 0)}</b>: ${esc(why)}. You can change it.`;
    if (budget < min) { note = `That works out to ${money(budget, 0)}, under ${esc(A.cfg().name)}'s ${money(min, 0)} first-order minimum, so the budget is set to <b>${money(min, 0)}</b>.`; budget = min; }
    state.storeSize = v; A.persist(); storeNote(note);
    A.setBudget(budget);
  }

  /* ================================================= extra line-sheet pages */
  A.hooks.sheetPages.push((P) => {
    const S = P.S, cfg = A.cfg();
    // market brief (buyer-safe; only while fresh)
    const f = briefFile();
    if (S.brief && f && briefLive(f)) fitBrief(P.add(P.newPage(P.miniHead("Market brief") + briefPageHTML(f, matchedIds()))));
    // shown with the store (context only)
    const cx = state.context.items;
    if (S.ctxPage && cx.length) {
      const ours = P.items.slice(0, 16);
      const pick = new Map(state.capsule.picks.map((p) => [p.item.sku, p]));
      P.add(P.newPage(P.miniHead("Shown with your assortment") + `<div class="sh-ctx">
        <h5>What you carry now <span>other brands and your own clothing · for context, not part of this order</span></h5>
        <div class="theirs">${cx.slice(0, 12).map((x) => `<div class="t">${x.thumb ? `<img src="${esc(x.thumb)}" alt="">` : window.CB_SILHOUETTE(x)}<small>${esc(x.name || x.type || "")}${x.brand ? `<br><i>${esc(x.brand)}</i>` : ""}</small></div>`).join("")}</div>
        <h5>Our capsule beside it</h5>
        <div class="ours">${ours.map((o) => { const e = pick.get(o.it.sku), w = e && e.sc && e.sc.ctx && e.sc.ctx.why && e.sc.ctx.pts > 0.5 ? `goes with your ${esc(e.sc.ctx.why.item)}` : o.anchor ? "your pick" : ""; return `<div class="t"><img src="${esc(o.it.img)}" alt=""><small><b>${esc(o.it.sku)}</b> ${esc(o.it.name)}${w ? `<br><i>${w}</i>` : ""}</small></div>`; }).join("")}</div></div>`));
    }
    // buyer packet: item facts a reviewer needs without the rep
    if (S.packet) {
      const u = P.activeUnits(), H = A.HT(), wsOn = !!S.fields.wholesale;
      const soldAs = (it) => { const n = P.minFor(it); return H ? P.qtyWord(n) : `${n} pcs`; };
      const rows = P.items.map((o) => {
        const it = o.it, c = A.engine().lineCost(it, u);
        return `<tr><td class="im"><img src="${esc(it.img)}" alt=""></td><td><b>${esc(it.sku)}</b><br>${esc(it.name)}${it.mtext ? `<br><span class="mt">${esc(it.mtext)}</span>` : ""}</td><td>${esc(A.CAT_LABEL[it.cat].replace(/s$/, ""))}<br>${esc(it.cname || A.label(it.dom))}</td><td class="num">${it.msrp ? money(it.msrp) : "—"}</td>${wsOn ? `<td class="num">${money(c.each)}</td>` : ""}<td class="num">${esc(soldAs(it))}</td></tr>`;
      });
      const head = `<tr><th></th><th>Style</th><th>Category · color</th><th class="num">Suggested retail</th>${wsOn ? `<th class="num">Wholesale each</th>` : ""}<th class="num">Suggested qty</th></tr>`;
      const rc = String(A.store.get("capsule_rep_contact", "") || "").trim();
      const who = [rc, state.rep ? `rep code ${state.rep}` : ""].filter(Boolean).join(" · ") || `${cfg.lineSheet.contactLine}${cfg.contactEmail ? " · " + cfg.contactEmail : ""}`;
      const intro = `<div class="pk-intro"><b>${esc(A.capTitle())}</b>${state.buyer.trim() ? ` · prepared for ${esc(state.buyer.trim())}` : ""} · ${esc(cfg.name)} · ${esc(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}
        ${S.committee ? `<p>For the store's review committee: every figure is from ${esc(cfg.name)}'s published wholesale terms, and nothing is ordered until the store submits an order.</p>` : ""}</div>`;
      const tail = `<div class="pk-terms">${P.termsRows().map((r) => `<b>${esc(r[0])}</b><span>${esc(r[1])}</span>`).join("")}<b>UPC</b><span>Not on file yet; available on request.</span><b>Your rep</b><span>${esc(who)}</span></div>`;
      const title = S.committee ? "For review committee" : "Buyer packet";
      let i = 0, first = true;
      while (i < rows.length || first) {
        const pg = P.add(P.newPage(P.miniHead(title) + (first ? intro : "") + `<div class="pk-body"><table class="pk"><thead>${head}</thead><tbody></tbody></table></div>`));
        const body = pg.querySelector(".pk-body"), tb = pg.querySelector("tbody");
        let placed = 0;
        while (i < rows.length) { tb.insertAdjacentHTML("beforeend", rows[i]); if (body.scrollHeight > body.clientHeight + 1 && placed > 0) { tb.lastElementChild.remove(); break; } i++; placed++; }
        first = false;
        if (i >= rows.length) {
          body.insertAdjacentHTML("beforeend", tail);
          if (body.scrollHeight > body.clientHeight + 1) { body.lastElementChild.remove(); P.add(P.newPage(P.miniHead(title) + `<div class="pk-body">${tail}</div>`)); }
          break;
        }
      }
    }
  });

  /* ================================================= boards */
  // Named, themed capsules a rep opens, sets the store's budget and sends. Built-in boards ship in app/boards.js
  // (data/boards.json); boards the rep saves live in this browser and export as a boards file for the next release.
  const LOCAL = "capsule_boards_local";
  const localBoards = () => A.store.get(LOCAL, []);
  const PREV = new Map();
  function allBoards() {
    const L = A.line();
    const built = ((window.BOARDS || {})[L] || []).map((b) => Object.assign({ line: L, builtIn: true }, b));
    return built.concat(localBoards().filter((b) => b.line === L));
  }
  function boardCard(b) {
    const e = A.engine();
    let prev = b.picks || b.preview;
    if (!prev || !prev.length) {   // a board built fresh: preview today's top picks around its anchor (cached per session)
      const k = b.id + "|" + A.line();
      if (!PREV.has(k)) { try { const cap = e.build(b.anchors.filter((s) => e.bySku.has(s)), { size: b.size || 12, minQty: state.minQty }); PREV.set(k, cap.picks.slice(0, 3).map((p) => p.item.sku)); } catch (err) { PREV.set(k, []); } }
      prev = PREV.get(k);
    }
    const ims = (b.anchors || []).concat(prev || []).map((s) => e.bySku.get(s)).filter(Boolean).slice(0, 4);
    const ok = (b.anchors || []).some((s) => e.bySku.has(s));
    return `<div class="bd ${ok ? "" : "off"}" data-id="${esc(b.id)}">
      <div class="bd-im">${ims.map((it, k) => `<img src="${esc(it.img)}" alt="" loading="lazy" class="${k ? "" : "big"}">`).join("")}</div>
      <div class="bd-b"><div class="bd-tag">${b.builtIn ? esc(b.source || "Starter board") : `Yours · saved ${esc(new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }))}`}</div>
        <h3>${esc(b.name)}</h3><p>${esc(b.theme || "")}</p>${b.window ? `<div class="note">${esc(b.window)}</div>` : ""}
        <div class="note">${b.picks && b.picks.length ? `${b.anchors.length + b.picks.length} styles, as saved` : `Built fresh around ${esc((e.bySku.get(b.anchors[0]) || { name: b.anchors[0] }).name)}${b.budget ? ` at ${money(b.budget, 0)}` : ` · ${b.size || 12} styles`}`}</div>
        <div class="row">${ok ? `<button class="btn primary" data-a="open">Open</button><button class="btn" data-a="send">Send…</button><button class="btn" data-a="guided" title="Show it in guided mode">▶ Guided</button>` : `<span class="warn">Its pieces are no longer in the catalog.</span>`}${b.builtIn ? "" : `<button class="btn" data-a="del">Delete</button>`}</div></div></div>`;
  }
  function drawBoards() {
    const bs = allBoards();
    $("paneBoards").innerHTML = `<div class="bdp"><div class="bdp-h"><div><h1>Boards</h1><p class="note">Ready-made capsules by theme and season for ${esc(A.cfg().name)}. Open one, set the store's budget or size, and send it. Starter boards come from the In the Know trend notes; save your own from any capsule.</p></div>
      <div class="row"><button class="btn primary" id="bdSave" ${state.capsule ? "" : "disabled"}>Save this capsule as a board…</button><button class="btn" id="bdExport" ${localBoards().length ? "" : "disabled"}>Export my boards</button></div></div>
      <div class="bd-grid">${bs.map(boardCard).join("") || '<p class="note">No boards for this line yet.</p>'}</div></div>`;
    $("paneBoards").querySelectorAll(".bd [data-a]").forEach((btn) => (btn.onclick = () => {
      const id = btn.closest(".bd").dataset.id, b = bs.find((x) => x.id === id);
      if (btn.dataset.a === "del") { A.store.set(LOCAL, localBoards().filter((x) => x.id !== id)); drawBoards(); return; }
      if (!A.restoreBoard(b)) { A.toast("That board's pieces aren't in the catalog."); return; }
      A.logSend("board-open", { to: b.name });
      if (btn.dataset.a === "guided" && window.CB_GUIDED) { window.CB_GUIDED.start("guided", { step: 3 }); return; }
      show("capsule");
      if (btn.dataset.a === "send") A.openSend();
    }));
    $("bdSave").onclick = () => { $("bdName").value = A.capTitle(); $("bdTheme").value = ""; $("bdWindow").value = ""; $("bdKeep").checked = true; A.openDlg("boardDlg"); $("bdName").focus(); };
    $("bdExport").onclick = () => {
      const out = { app: "Capsule Builder", kind: "boards", exported: new Date().toISOString(), boards: localBoards() };
      A.download(`capsule_boards_${today()}.json`, JSON.stringify(out, null, 1), "application/json");
      A.toast("Boards file downloaded. Send it to Claude or Lloyd to add to the built-in boards.");
    };
  }
  function saveBoard() {
    const name = $("bdName").value.trim(); if (!name) { $("bdName").focus(); return; }
    const b = {
      id: "b" + Date.now().toString(36), line: A.line(), name, theme: $("bdTheme").value.trim(), window: $("bdWindow").value.trim(),
      anchors: state.anchors.filter(Boolean), picks: $("bdKeep").checked ? state.capsule.picks.map((p) => p.item.sku) : undefined,
      preview: state.capsule.picks.slice(0, 3).map((p) => p.item.sku), budget: state.mode === "budget" ? state.budget : undefined, size: state.mode === "pieces" ? state.size : undefined,
      createdAt: new Date().toISOString(), by: state.rep || undefined,
    };
    const L = localBoards(); L.push(b);
    if (!A.store.set(LOCAL, L)) { A.toast("This browser is blocking local storage, so the board couldn't be saved."); return; }
    A.closeDlg("boardDlg"); drawBoards(); A.toast(`Saved the board “${esc(name)}”.`);
  }

  /* ================================================= rep kit (RF): MarketTime + RepZio item files and SKU.jpg photos */
  window.CB_REPKIT = async function () {
    if (A.line() !== "RF") { A.toast("OIYK stays off MarketTime and RepZio until 1Q 2027."); return; }
    const items = A.catalog().items.filter((it) => A.engine().orderable(it)), rule = "Sold by the dozen. First orders may include a limited number of ½-dozen styles.";
    const desc = (it) => [it.desc, it.mtext ? "Materials: " + it.mtext + "." : "", rule].filter(Boolean).join(" ");
    const cat = (it) => A.CAT_LABEL[it.cat].replace(/s$/, "");
    const mt = A.simpleXLSX("", "Items", ["Item Number", "Item Name", "Description", "Wholesale Price", "Retail Price", "Minimum Qty", "Order Multiple", "Category", "Color", "UPC", "Image File"],
      items.map((it) => [it.sku, it.name, desc(it), it.ws, it.msrp || "", 6, 6, cat(it), it.cname || A.label(it.dom), "", it.sku + ".jpg"]), true);
    const rz = A.simpleXLSX("", "Products", ["ItemID", "ItemName", "Description", "BasePrice", "RetailPrice", "MinQty", "Multiple", "Category", "Color", "UPC", "ImageName"],
      items.map((it) => [it.sku, it.name, desc(it), it.ws, it.msrp || "", 6, 6, cat(it), it.cname || A.label(it.dom), "", it.sku + ".jpg"]), true);
    A.toast(`Collecting ${items.length} photos…`);
    const files = [{ name: "MarketTime_items_Retro_Forever.xlsx", bytes: mt }, { name: "RepZio_products_Retro_Forever.xlsx", bytes: rz }];
    let miss = 0;
    for (const it of items) {
      try { const r = await fetch(it.img); if (!r.ok) throw 0; files.push({ name: `images/${it.sku}.jpg`, bytes: new Uint8Array(await r.arrayBuffer()) }); } catch (e) { miss++; }
    }
    files.push({ name: "README.txt", text: [
      "Retro Forever rep kit (" + today() + ")", "",
      "For a rep agency that writes orders on MarketTime or RepZio. Load it under the agency's own license; Retro Forever holds no license and pays no fee.", "",
      "MarketTime: Items > Import, choose MarketTime_items_Retro_Forever.xlsx, then upload the images folder. Photos are named SKU.jpg.",
      "RepZio: WebManager > Manage Data, choose RepZio_products_Retro_Forever.xlsx, then upload the images folder (.jpg, no spaces).",
      "If a platform's import template uses different column names, map them on its import screen: Item Number/ItemID = our SKU.", "",
      "Prices are wholesale per piece. Minimum 6, order multiple 6: " + rule, "UPC: not on file yet.",
      "Test one basket with a Quick Import file from the Capsule Builder (Send to > MarketTime) and check the totals. Do not submit a test order.",
      miss ? `\n${miss} photos could not be collected; open the kit from the web copy of the Capsule Builder to include them.` : "",
    ].join("\r\n") });
    const zip = A.zipStore(files);
    A.download(`Retro_Forever_rep_kit_${today()}.zip`, zip, "application/zip");
    A.logSend("rep-kit");
    A.toast(`Rep kit downloaded: ${items.length} styles${miss ? `, ${miss} photos missing (use the web copy)` : ""}.`);
  };

  /* ================================================= mount */
  function mount() {
    document.querySelectorAll(".mtabs [data-pane]").forEach((b) => (b.onclick = () => show(b.dataset.pane)));
    if (window.CB_CONTEXT) window.CB_CONTEXT.mount();
    drawStoreSize();
    $("storeSize").onchange = () => { const v = $("storeSize").value; $("storeSales").classList.toggle("hide", v !== "custom"); if (v === "custom") { $("storeSales").focus(); return; } applyStoreSize(v); };
    $("storeSales").onchange = () => { const v = +$("storeSales").value; if (v > 0) applyStoreSize("$" + v); };
    $("bdSaveGo").onclick = saveBoard;
    if ($("sdBrief")) $("sdBrief").checked = !!A.store.get("capsule_brief_in_send", false);
    if ($("sdBrief")) $("sdBrief").onchange = () => A.store.set("capsule_brief_in_send", $("sdBrief").checked);
    let p0 = "capsule"; try { p0 = sessionStorage.getItem("cb_pane") || "capsule"; } catch (e) { /* ignore */ }
    show(p0);
  }
  A.hooks.line.push(() => { drawStoreSize(); if (pane === "brief") drawBrief(); if (pane === "boards") drawBoards(); const f = briefFile(); const sb = $("sdBriefRow"); if (sb) sb.classList.toggle("hide", !(f && briefLive(f))); });
  A.hooks.board.push(() => { if (pane === "brief") drawBrief(); });
  A.hooks.context.push(() => { drawStoreSize(); storeNote(""); });
  A.hooks.sheetOpts.push((S) => { const f = briefFile(), live = f && briefLive(f); if ($("shBrief")) { $("shBrief").disabled = !live; $("shBriefRow").title = live ? "" : "No fresh In the Know brief for this line"; } if ($("shCtxPage")) $("shCtxPage").disabled = !state.context.items.length; });
  window.CB_INSTORE = { fitBrief, show, briefFile, briefLive, briefText, liveSignals, drawBoards, drawBrief, applyStoreSize };
  mount();
})();
