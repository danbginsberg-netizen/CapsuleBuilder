/* Capsule Builder v1.9.0 — Account fit (Dan, 2 Oct 2026).
   Pick the retailer a capsule is for. Its profile (app/accounts.js, built from data/accounts.json) records how that retailer
   merchandises jewelry today: price tiers, palette, metals, motifs, materials, what it never carries, comparable brands and
   sources, with the date it was read. The builder then:
   - marks every piece with its fit and the reason, in the account's terms ("in its third-party designer tier ($88-$375)");
   - grades the whole capsule and names anything off-brand before it goes out;
   - on "Rebuild for this account", pulls the picks toward the account and skips what it never carries (locked pieces stay);
   - opens the ready-made capsules built for that account;
   - prints a rep-facing fit report, and can put the buyer-facing line on the line sheet and the capsule page.
   Everything here is advice: stock, minimums, the buyer's pick and the variety rules are unchanged. */
(function () {
  "use strict";
  const A = window.__cb;
  if (!A || !window.ACCOUNTS) return;
  const { $, esc, state } = A;
  const ACC = window.ACCOUNTS;
  const groupName = (g) => ((ACC.groups || []).find((x) => x.id === g) || {}).name || "Accounts";
  const ROLE = { lead: "Lead line for this account", secondary: "Second line for this account", "not a fit": "Not a fit for this account" };
  const GCLS = { strong: "g-strong", good: "g-good", stretch: "g-stretch", off: "g-off", mixed: "g-stretch", poor: "g-off" };
  const fmtDate = (d) => { const t = new Date(String(d) + "T12:00:00"); return isNaN(t) ? d : t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
  const short = (a) => a.name.split(" (")[0];
  let open = false;   // "How it merchandises jewelry" folded or not

  /* ---------------- left panel: the Account picker ---------------- */
  function mount() {
    if ($("acctSel")) return;
    const after = $("buyer");
    if (!after) return;
    const wrap = document.createElement("div");
    wrap.id = "acctWrap";
    wrap.innerHTML = `<label class="f" for="acctSel">Account <span class="note">checks the fit</span></label><select id="acctSel"></select><div class="note" id="acctNote"></div>`;
    after.insertAdjacentElement("afterend", wrap);
    const by = {};
    ACC.accounts.forEach((a) => (by[a.group] = by[a.group] || []).push(a));
    $("acctSel").innerHTML = `<option value="">— No account —</option>` + Object.entries(by).map(([g, list]) =>
      `<optgroup label="${esc(groupName(g))}">${list.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}</optgroup>`).join("");
    $("acctSel").onchange = () => choose($("acctSel").value);
    draw();
  }
  function choose(id) {
    state.account = id || "";
    const a = A.acctOf(state.account);
    if (a && !state.buyer.trim()) { state.buyer = short(a); $("buyer").value = state.buyer; }
    A.applyContext(); A.persist();
    draw();
    if (state.capsule) A.renderBoard();
  }
  function draw() {
    if (!$("acctSel")) return;
    $("acctSel").value = state.account || "";
    const a = A.acctOf(state.account), P = A.acctProfile(A.line());
    let h = "";
    if (a) {
      const role = P ? P.role : "not a fit";
      h = `<span class="${role === "not a fit" ? "warn" : ""}">${esc(ROLE[role] || "")}${role === "not a fit" && P && P.summary ? ": " + esc(P.summary) : ""}</span>`;
      const other = A.line() === "RF" ? "OIYK" : "RF", Po = a.lines[other];
      if (Po && Po.role !== "not a fit" && role === "not a fit") h += ` <a class="link" data-sw="${other}">Switch to ${other === "RF" ? "Retro Forever" : "OIYK"}</a>`;
      const caps = (a.capsules || []).filter((c) => c.line === A.line());
      if (caps.length) h += `<div class="acaps">Ready-made: ${caps.map((c, i) => `<a class="link" data-cap="${a.capsules.indexOf(c)}">${esc(c.name.split(" · ").slice(1).join(" · ") || c.name)}</a>`).join(" · ")}</div>`;
      h += `<div>Read ${esc(fmtDate(a.checked))} · ${esc(a.confidence)} confidence</div>`;
    }
    $("acctNote").innerHTML = h;
    $("acctNote").querySelectorAll("[data-sw]").forEach((x) => (x.onclick = () => A.switchLine(x.dataset.sw)));
    $("acctNote").querySelectorAll("[data-cap]").forEach((x) => (x.onclick = () => openCap(a, +x.dataset.cap)));
  }
  function openCap(a, i) {
    const c = a.capsules[i];
    if (!c) return;
    if (!state.buyer.trim()) { state.buyer = short(a); $("buyer").value = state.buyer; }
    A.restoreBoard({ line: c.line, anchors: c.anchors, picks: c.picks, exact: true, name: c.name, account: a.id, size: c.anchors.length + c.picks.length });
    window.CB_PANE && window.CB_PANE("capsule");
  }

  /* ---------------- the board: fit panel + a fit line on every card ---------------- */
  function items() { const c = state.capsule; return c ? c.anchors.concat(c.picks.map((p) => p.item)) : []; }
  function report() {
    const P = A.acctProfile(A.line()), eng = A.engine();
    return P && eng && state.capsule ? eng.accountReport(items(), P, P.accountName) : null;
  }
  function board() {
    const a = A.acctOf(state.account), P = A.acctProfile(A.line()), eng = A.engine();
    const bd = $("board");
    if (!bd || !state.capsule) return;
    const old = bd.querySelector(".acctbox"); if (old) old.remove();
    bd.querySelectorAll(".fitline").forEach((x) => x.remove());
    if (!a || !P) return;
    const R = report();
    const box = document.createElement("div");
    box.className = "acctbox";
    const sources = (a.sources || []).map((s) => `<li><a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a></li>`).join("");
    const comps = (a.comparables || []).length ? `<table class="acomp"><thead><tr><th>Brand at ${esc(short(a))}</th><th>Piece</th><th>Retail</th></tr></thead><tbody>${a.comparables.map((c) => `<tr><td>${esc(c.brand)}</td><td>${esc(c.item)}</td><td>$${esc(c.price)}</td></tr>`).join("")}</tbody></table>` : "";
    const caps = (a.capsules || []).map((c, i) => `<button data-cap="${i}" ${c.line !== A.line() ? `title="${c.line === "RF" ? "Retro Forever" : "OIYK"} capsule"` : ""}>${esc(c.name)}</button>`).join("");
    box.innerHTML = `<div class="h"><b>Account fit · ${esc(a.name)}</b>${R ? `<span class="grade ${GCLS[R.grade]}">${esc(R.label)} · ${R.score}</span>` : ""}
      <span class="sp"></span><button data-ac="rebuild" title="Rebuild with the account's fit pulling the picks; locked pieces stay">Rebuild for ${esc(short(a))}</button><button data-ac="report">Fit report</button>${P.pitch && P.role !== "not a fit" ? `<button data-ac="pitch" title="Put the buyer-facing line on the line sheet">Pitch on line sheet</button>` : ""}</div>
      ${P.role === "not a fit" ? `<div class="awarn">${esc(P.summary || "This line isn't a fit for this account.")}</div>` : ""}
      ${R ? `<div class="atext">${esc(R.text)}</div>` : ""}
      ${P.summary && P.role !== "not a fit" ? `<div class="asum"><b>Built to:</b> ${esc(P.summary)}</div>` : ""}
      ${P.pitch && P.role !== "not a fit" ? `<div class="apitch"><b>Buyer-facing line:</b> “${esc(P.pitch)}”</div>` : ""}
      <a class="link amore" data-ac="more">${open ? "Hide" : "How"} ${esc(short(a))} merchandises jewelry ${open ? "▴" : "▾"}</a>
      <div class="adetail ${open ? "" : "hide"}">
        <p>${esc(a.read)}</p>${comps}
        ${(a.watch || []).length ? `<h4>Watch</h4><ul>${a.watch.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
        <h4>How to reach the buyer</h4><p>${esc(a.route)}</p>
        ${caps ? `<h4>Ready-made capsules</h4><div class="acapbtns">${caps}</div>` : ""}
        <h4>Sources (read ${esc(fmtDate(a.checked))}, ${esc(a.confidence)} confidence)</h4><ul class="asrc">${sources}</ul>
      </div>`;
    bd.insertBefore(box, bd.firstChild);
    box.querySelectorAll("[data-ac]").forEach((b) => (b.onclick = () => act(b.dataset.ac)));
    box.querySelectorAll("[data-cap]").forEach((b) => (b.onclick = () => openCap(a, +b.dataset.cap)));
    // a fit line on every card
    bd.querySelectorAll(".card[data-sku]").forEach((card) => {
      const it = eng.bySku.get(card.dataset.sku); if (!it) return;
      const f = eng.accountFit(it, P); if (!f) return;
      const el = document.createElement("div");
      const g = f.hard ? "off" : f.grade;
      el.className = "fitline " + GCLS[g];
      const why = f.hard ? (f.minus[0] || "") : (f.plus[0] || "") + (f.minus.length && g !== "strong" ? ` · but ${f.minus[0]}` : "");
      el.innerHTML = `<b>${esc(f.label)}</b> ${esc(why)}`;
      el.title = [].concat(f.plus.map((x) => "+ " + x), f.minus.map((x) => "– " + x)).join("\n");
      const px = card.querySelector(".px");
      (px || card.querySelector(".b")).insertAdjacentElement(px ? "afterend" : "afterbegin", el);
    });
  }
  function act(k) {
    if (k === "more") { open = !open; board(); return; }
    if (k === "rebuild") { A.applyContext(); A.build(); A.toast && A.toast(`Rebuilt for ${short(A.acctOf(state.account))}: picks lean to its fit; locked pieces stayed.`); return; }
    if (k === "pitch") {
      const P = A.acctProfile(A.line()); if (!P || !P.pitch) return;
      state.sheet.note = P.pitch; A.persist();
      A.toast && A.toast("The buyer-facing line is now the line-sheet note (edit it in Line sheet).");
      return;
    }
    if (k === "report") fitReport();
  }

  /* ---------------- rep-facing fit report (opens in a new tab; downloads if the browser blocks it) ---------------- */
  function fitReport() {
    const a = A.acctOf(state.account), P = A.acctProfile(A.line()), eng = A.engine(), R = report();
    if (!a || !P || !R) return;
    const u = A.activeUnits ? A.activeUnits() : "first";
    const rows = R.fits.map(({ it, f }) => {
      const c = eng.lineCost(it, u);
      return `<tr class="${f.hard ? "off" : f.grade}"><td><img src="${esc(new URL(it.img, location.href).href)}" alt=""></td><td><b>${esc(it.name)}</b><br><small>${esc(it.sku)}</small></td><td>$${esc(it.msrp)}</td><td>${c.units} × $${c.each.toFixed(2)}</td><td><b>${esc(f.label)}</b> (${Math.round(f.s * 100)})</td><td>${f.plus.map((x) => `<div>+ ${esc(x)}</div>`).join("")}${f.minus.map((x) => `<div class="m">– ${esc(x)}</div>`).join("")}</td></tr>`;
    }).join("");
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fit report · ${esc(A.capTitle())}</title>
<style>body{font:14px/1.45 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1f1d24;max-width:1100px;margin:24px auto;padding:0 16px}h1{font:600 24px Georgia,serif;margin:0 0 4px}h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#6b6775;margin:22px 0 6px}.meta{color:#6b6775}.g{display:inline-block;border-radius:99px;padding:2px 10px;font-weight:700;background:#e8f4ec;color:#2f7d4f}.g.mixed,.g.poor{background:#fff3e0;color:#a15c00}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e6e2ee;padding:6px 8px;text-align:left;vertical-align:top}th{font-size:12px;text-transform:uppercase;color:#6b6775}img{width:64px;height:64px;object-fit:contain}tr.off{background:#fdecea}tr.stretch{background:#fff8ec}.m{color:#a15c00}blockquote{border-left:3px solid #b8a9d9;margin:8px 0;padding:4px 12px;background:#faf9fc}small{color:#6b6775}@media print{body{margin:0}tr{break-inside:avoid}}</style></head><body>
<h1>Fit report · ${esc(A.capTitle())}</h1>
<div class="meta">${esc(a.name)} · ${esc(A.line() === "RF" ? "Retro Forever" : "Only If You Know")} · ${R.n} styles · rep ${esc(state.rep || "—")} · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
<p><span class="g ${R.grade}">${esc(R.label)} · ${R.score}</span> ${esc(R.text)}</p>
${P.summary ? `<p><b>Built to:</b> ${esc(P.summary)}</p>` : ""}
${P.pitch && P.role !== "not a fit" ? `<blockquote><b>Buyer-facing line:</b> “${esc(P.pitch)}”</blockquote>` : ""}
<h2>Piece by piece</h2><table><thead><tr><th></th><th>Piece</th><th>Retail</th><th>${u === "reorder" ? "Reorder" : "First order"}</th><th>Fit</th><th>Why</th></tr></thead><tbody>${rows}</tbody></table>
<h2>How ${esc(short(a))} merchandises jewelry</h2><p>${esc(a.read)}</p>
${(a.comparables || []).length ? `<table><thead><tr><th>Brand</th><th>Piece</th><th>Retail</th></tr></thead><tbody>${a.comparables.map((c) => `<tr><td>${esc(c.brand)}</td><td>${esc(c.item)}</td><td>$${esc(c.price)}</td></tr>`).join("")}</tbody></table>` : ""}
${(a.watch || []).length ? `<h2>Watch</h2><ul>${a.watch.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
<h2>How to reach the buyer</h2><p>${esc(a.route)}</p>
<h2>Sources</h2><p class="meta">Read ${esc(fmtDate(a.checked))} · ${esc(a.confidence)} confidence. Retailers change their assortment often; re-check before a big pitch.</p><ul>${(a.sources || []).map((s) => `<li><a href="${esc(s.u)}">${esc(s.t)}</a></li>`).join("")}</ul>
<p class="meta">Internal: for the rep, not the buyer.</p></body></html>`;
    const name = `${A.fileSafe ? A.fileSafe("Fit report " + A.capTitle()) : "Fit_report"}.html`;
    let w = null;
    try { w = window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank"); } catch (e) { w = null; }
    if (!w) A.download(name, html, "text/html;charset=utf-8");
  }

  /* ---------------- wiring ---------------- */
  A.hooks.board.push(board);
  A.hooks.line.push(draw);
  A.hooks.account.push(draw);
  window.CB_ACCOUNT = { choose, report, fitReport, openCap: (id, i) => openCap(A.acctOf(id), i), draw, board };
  mount();
  A.applyContext();
  if (state.capsule) A.renderBoard();
})();
