/* Capsule Builder v1.7.0 — guided mode: one four-step flow, four uses, switched by the link.
     ?mode=guided&line=RF&rep=CODE   booth or storefront, rep present: prices hidden until the rep taps "Show prices"; ends with the pre-filled order page
     ?mode=kiosk&line=RF             unattended (program page, kiosk): prices hidden until "Show prices" is tapped; Exit asks first; ends with "Request this capsule"
     ?mode=train&rep=CODE            new reps: coach notes beside each step and the four training sessions
     ?mode=send / ?mode=follow       the two "Send it" walk-throughs (app/sendtour.js), also started from Training's fourth session
     ?mode=demo&line=RF              recruiting: the flow on featured styles, ending with "Rep this line"
   Each link is locked to one line, so RF and OIYK never mix. The rep's settings, tuning and saved lists stay hidden. */
(function () {
  "use strict";
  const A = window.__cb;
  if (!A) return;
  const { $, esc, state, money } = A;
  const MODES = {
    guided: { name: "Booth", title: "Booth or storefront", who: "The buyer in front of you, on an iPad or phone", prices: "tap", end: "order" },
    kiosk: { name: "Kiosk", title: "Unattended kiosk or program page", who: "Booth traffic after hours; landing pages", prices: "tap", end: "request" },
    train: { name: "Training", title: "Training", who: "New reps in week one", prices: "always", end: "order" },
    demo: { name: "Recruiting demo", title: "Recruiting demo", who: "Prospective reps on calls and at markets", prices: "always", end: "rep" },
  };
  const g = { on: false, mode: "guided", step: 1, cat: "all", col: "all", priced: false, locked: false, idle: null, confirmExit: false };
  const TRAIN_KEY = "capsule_training";
  const train = () => Object.assign({ anchors: [], orderPage: false, sent: false, send: false, follow: false }, A.store.get(TRAIN_KEY, {}));
  const setTrain = (t) => A.store.set(TRAIN_KEY, t);

  /* ---------------- coach notes (training) ---------------- */
  const COACH = {
    1: { sees: "A photo grid of the line, filtered by category and color.", say: "“Which piece did you pick up twice?” Let her tap it herself.", why: "The capsule is built around one piece she already loves, and that piece stays in the order." },
    2: { sees: "Budget tiles and store sizes.", say: "“What's your opening budget for jewelry?” If she doesn't know: “Roughly how much jewelry do you sell in a month?”", why: "Store size sets the budget at about 38% of a month's jewelry sales, never below the line's first-order minimum." },
    3: { sees: "Her capsule: a balanced mix around her piece, with a market note when one fits.", say: "Tap a piece and read its reason aloud. Show prices only when she asks, then point to the retail value.", why: "Every pick has a reason she can repeat to her staff. The mix, stock and minimums are already handled." },
    4: { sees: "A QR code that opens the order page with her capsule filled in.", say: "“Scan this. Your quantities are in; change anything you like and submit when you're ready.”", why: "Your rep code rides on the link, so the order is credited to you. Never submit for her." },
  };

  /* ---------------- helpers ---------------- */
  const priced = () => MODES[g.mode].prices === "always" || (MODES[g.mode].prices === "tap" && g.priced);
  function pool() {
    const e = A.engine();
    let L = A.catalog().items.filter((it) => e.inStock(it, state.minQty) && e.orderable(it));
    if (g.mode === "demo") {   // featured: deepest stock first (RF), one colorway per style, an even category spread
      const seen = new Set(), per = { necklace: [], earring: [], bracelet: [] };
      L.slice().sort((a, b) => (b.qty || 0) - (a.qty || 0) || a.sku.localeCompare(b.sku)).forEach((it) => { if (!seen.has(it.base)) { seen.add(it.base); per[it.cat].push(it); } });
      L = []; for (let i = 0; i < 8; i++) ["necklace", "earring", "bracelet"].forEach((c) => per[c][i] && L.push(per[c][i]));
    }
    return L;
  }
  function header() {
    const steps = ["Pick a piece", "Budget", "Your capsule", g.mode === "demo" ? "Rep this line" : g.mode === "kiosk" ? "Keep it" : "Take it with you"];
    return `<header class="g-hd"><img src="${esc(A.cfg().logo)}" alt="${esc(A.cfg().name)}" id="gLogo"><div class="g-steps">${steps.map((s, i) => `<button data-step="${i + 1}" class="${g.step === i + 1 ? "on" : ""} ${i + 1 < g.step ? "done" : ""}" ${i + 1 > g.step + 0 && !(i + 1 <= maxStep()) ? "disabled" : ""}><i>${i + 1}</i><span>${esc(s)}</span></button>`).join("")}</div>
      <div class="g-tools">${MODES[g.mode].prices === "tap" ? `<button class="g-pr ${g.priced ? "on" : ""}" id="gPrices">${g.priced ? "Hide prices" : "Show prices"}</button>` : ""}${g.mode === "train" ? `<span class="pill">Training</span>` : ""}${g.mode === "demo" ? `<span class="pill">Demo</span>` : ""}<button class="g-x" id="gExit">Exit</button></div></header>`;
  }
  const maxStep = () => (!state.anchors[0] ? 1 : !state.capsule ? 2 : 4);

  /* ---------------- steps ---------------- */
  function step1() {
    const L = pool(), cats = [["all", "Everything"], ["necklace", "Necklaces"], ["earring", "Earrings"], ["bracelet", "Bracelets"]];
    const fams = [...new Set(L.map((it) => it.dom))].filter((f) => !["gold", "silver"].includes(f)).slice(0, 14);
    const SW = (window.CB_CONTEXT || {}).SW || {};
    const list = L.filter((it) => (g.cat === "all" || it.cat === g.cat) && (g.col === "all" || it.dom === g.col || (it.fams || []).includes(g.col)));
    return `<div class="g-q"><h1>${g.mode === "demo" ? "Pick a style, any style" : "Which piece caught your eye?"}</h1><p>${g.mode === "demo" ? "This is what your buyers see: one piece in, a balanced capsule out." : "Tap the one you'd pick up first. Everything else is chosen to go with it."}</p></div>
      <div class="g-f"><div class="chips">${cats.map(([k, t]) => `<button data-cat="${k}" class="${g.cat === k ? "on" : ""}">${t}</button>`).join("")}</div>
        <div class="g-sw"><button data-col="all" class="${g.col === "all" ? "on" : ""}">All colors</button>${fams.map((f) => `<button data-col="${esc(f)}" class="${g.col === f ? "on" : ""}" title="${esc(A.label(f))}"><i style="background:${SW[f] || "#ccc"}"></i>${esc(A.label(f))}</button>`).join("")}</div></div>
      <div class="g-grid">${list.slice(0, 96).map((it) => `<button class="g-tile ${state.anchors[0] === it.sku ? "on" : ""}" data-sku="${esc(it.sku)}"><img src="${esc(it.img)}" alt="" loading="lazy"><b>${esc(it.name)}</b>${priced() ? `<small>${esc(A.wsShort(it))} wholesale</small>` : ""}</button>`).join("") || '<p class="note">Nothing matches. Try another color.</p>'}</div>`;
  }
  function step2() {
    const it = A.engine().bySku.get(state.anchors[0]), S = A.cfg().storeSizes || { sizes: [] }, min = (A.cfg().terms || {}).orderMinimum || 0;
    return `<div class="g-q"><div class="g-pick">${it ? `<img src="${esc(it.img)}" alt=""><span>Built around<br><b>${esc(it.name)}</b></span>` : ""}</div><h1>What's your opening budget?</h1><p>Wholesale, for a first order. Or tell us the store's size and we'll suggest one. ${esc(A.cfg().name)}'s first-order minimum is ${money(min, 0)}.</p></div>
      <div class="g-budget">${(A.cfg().budgetPresets || []).map((p) => `<button class="g-big" data-amt="${p.amount}"><b>${esc(p.label)}</b><small>${esc(p.note || "")}</small></button>`).join("")}</div>
      <h3 class="g-sub">Or by store size</h3>
      <div class="g-budget">${S.sizes.map((z) => `<button class="g-big" data-size="${z.id}"><b>${esc(z.label)} store</b><small>${esc(z.sales)} · ${esc(z.traffic)}</small></button>`).join("")}</div>
      <div class="g-own"><label>Another amount $<input type="number" id="gAmt" min="${min}" step="25" inputmode="numeric"></label><button class="btn primary" id="gAmtGo">Build it</button><button class="btn" id="g12">Just show me 12 styles</button></div>`;
  }
  function step3() {
    const cap = state.capsule;
    if (!cap) return `<div class="g-q"><h1>Building…</h1></div>`;
    const items = A.allItems(), u = A.activeUnits(), eco = A.engine().economics(items, u), cur = u === "reorder" ? eco.reorder : eco.first;
    const notes = A.trendNow().notes || [];
    const why = new Map(cap.picks.map((p) => [p.item.sku, p.reason]));
    return `<div class="g-q"><h1>${esc(A.capTitle())}</h1><p>${items.length} styles: ${cap.counts.necklace} necklaces, ${cap.counts.earring} earrings, ${cap.counts.bracelet} bracelets. Tap any piece to see why it's here.</p></div>
      ${notes.length ? `<div class="trendnote"><b>Market note</b>${notes.map((n) => `<span>${esc(n.text)}</span>`).join("")}</div>` : ""}
      ${priced() ? `<div class="g-eco"><div><small>First order</small><b>${money(cur.total, 0)}</b></div><div><small>Retail value</small><b>${money(cur.retail, 0)}</b></div><div><small>Markup</small><b>${cur.total ? (cur.retail / cur.total).toFixed(1) : "–"}x</b></div><div><small>Pieces</small><b>${cur.units}</b></div></div>` : ""}
      <div class="g-cap">${items.map((it, k) => `<button class="g-card ${k < cap.anchors.length ? "anchor" : ""}" data-sku="${esc(it.sku)}"><img src="${esc(it.img)}" alt="" loading="lazy">${k < cap.anchors.length ? `<span class="tag">Your pick</span>` : ""}<b>${esc(it.name)}</b>${priced() ? `<small>${esc(A.wsShort(it))} · ${esc(A.qtyWord(A.minFor(it)))}</small>` : ""}<span class="g-why">${esc(k < cap.anchors.length ? "The piece you picked. Everything else goes with it." : why.get(it.sku) || "")}</span></button>`).join("")}</div>
      <div class="g-acts"><button class="btn" id="gAnother">Show another version</button><button class="btn" id="gBudget">Change the budget</button><button class="btn" id="gRestart">Start over</button><button class="btn primary g-next" id="gNext">${g.mode === "demo" ? "Next: rep this line" : g.mode === "kiosk" ? "Keep this capsule" : "Take it with you"} →</button></div>`;
  }
  function step4() {
    const cfg = A.cfg(), ol = A.orderLink(), cl = A.capsuleLink(false);
    if (g.mode === "demo") {
      return `<div class="g-q"><h1>Rep ${esc(cfg.name)}</h1><p>What you just did takes about two minutes with a buyer: one piece in, a balanced first order out, and a pre-filled order page carrying your rep code, so the order is credited to you.</p></div>
        <div class="g-end"><div class="g-card-rep"><ul><li>Built for the booth, the showroom and follow-up emails: line sheets, order forms and platform files come from the same capsule.</li><li>${esc(cfg.name)} ${cfg.line === "OIYK" || A.line() === "OIYK" ? "is made to order, with premium pricing tiers." : "ships in stock from our U.S. warehouse."}</li><li>Terms, territories and the proof pack are on our program page.</li></ul>
          <div class="row"><a class="btn primary" href="${esc(A.cfg().programPage.url)}" target="_blank" rel="noopener">Open the program page ↗</a><a class="btn" href="mailto:${esc(cfg.contactEmail || "")}?subject=${encodeURIComponent("Repping " + cfg.name)}" target="_top">Email Dan Ginsberg</a></div>
          <p class="note">Dan Ginsberg · ${esc((cfg.lineSheet.contactLine || "").replace(/^For inquiries\s*/i, ""))}${cfg.contactEmail ? " · " + esc(cfg.contactEmail) : ""}</p></div>
          <div class="g-qr">${A.qrSVG(A.cfg().programPage.url)}<small>Scan for the program page</small></div></div>
        <div class="g-acts"><button class="btn" id="gRestart">Try another piece</button></div>`;
    }
    if (g.mode === "kiosk") {
      return `<div class="g-q"><h1>Keep this capsule</h1><p>Scan to keep it on your phone, or send a request and we'll follow up with the order page and terms.</p></div>
        <div class="g-end"><div class="g-qr big">${cl ? A.qrSVG(cl, "L") : ""}<small>Scan to open your capsule</small></div>
          <div class="g-card-rep"><h3>Request this capsule</h3><p>Opens an email to ${esc(cfg.name)} with your capsule attached as a link. Add your store name and phone, then press Send.</p>
            <label>Store name <input type="text" id="gStore" value="${esc(state.buyer)}" autocomplete="organization"></label>
            <button class="btn primary" id="gRequest">Request this capsule</button><p class="note" id="gReqNote"></p></div></div>
        <div class="g-acts"><button class="btn" id="gRestart">Start over</button></div>`;
    }
    const t = g.mode === "train" ? train() : null;
    return `<div class="g-q"><h1>Take it with you</h1><p>Scan to open our order page with this capsule filled in. Change any quantity, add your details and submit when you're ready.</p></div>
      <div class="g-end"><div class="g-qr big">${ol ? A.qrSVG(ol.url) : ""}<small>Order page, pre-filled${state.rep ? ` · rep ${esc(state.rep)}` : ""}</small></div>
        <div class="g-card-rep"><label>Store name <input type="text" id="gStore" value="${esc(state.buyer)}" autocomplete="organization"></label>
          <div class="g-col"><button class="btn primary" id="gOrder">Open the order page</button><button class="btn" id="gMail">Email me this capsule</button><button class="btn" id="gShare">Text or share…</button></div>
          <p class="note" id="gReqNote"></p>
          ${t ? `<div class="g-train"><h3>Training sessions</h3><ol>
            <li class="${t.anchors.length >= 5 ? "done" : ""}"><b>Five anchors.</b> Build five capsules from five different pieces (${Math.min(5, t.anchors.length)} of 5).</li>
            <li class="${t.orderPage ? "done" : ""}"><b>The order path.</b> Open the pre-filled order page and change one quantity. Don't submit.</li>
            <li class="${t.send && t.follow ? "done" : ""}"><b>Send it and follow up.</b> Two walk-throughs on the real screen: send a capsule (${t.send ? "done" : "not yet"}) and follow up a buyer who has ordered (${t.follow ? "done" : "not yet"}).
              <div class="g-trbtns"><button class="btn" id="gTrSend">${t.send ? "Repeat" : "Start"}: send a capsule</button><button class="btn" id="gTrFollow">${t.follow ? "Repeat" : "Start"}: follow up a buyer who ordered</button></div></li>
            <li class="${t.sent ? "done" : ""}"><b>Certification.</b> Send one real capsule to a buyer with your rep code${state.rep ? ` (${esc(state.rep)})` : " (set it in the builder first)"}.</li></ol></div>` : ""}</div></div>
      <div class="g-acts"><button class="btn" id="gBack3">Back to the capsule</button><button class="btn" id="gRestart">Start over</button></div>`;
  }

  /* ---------------- draw + wire ---------------- */
  function draw() {
    const el = $("guided");
    const body = g.step === 1 ? step1() : g.step === 2 ? step2() : g.step === 3 ? step3() : step4();
    const c = COACH[g.step];
    el.className = "g-on g-" + g.mode;
    el.innerHTML = header() + `<div class="g-wrap"><main class="g-body">${body}</main>${g.mode === "train" ? `<aside class="g-coach"><h3>Coach notes · step ${g.step}</h3><p><b>What she sees:</b> ${esc(c.sees)}</p><p><b>What to say:</b> ${esc(c.say)}</p><p><b>Why:</b> ${esc(c.why)}</p></aside>` : ""}</div>
      ${g.confirmExit ? `<div class="g-confirm"><span>Leave kiosk mode?</span><button class="btn primary" id="gExitYes">Leave</button><button class="btn" id="gExitNo">Stay</button></div>` : ""}`;
    wire();
    el.scrollTop = 0;
  }
  function go(n) { g.step = n; draw(); }
  function wire() {
    const el = $("guided");
    el.querySelectorAll(".g-steps [data-step]").forEach((b) => (b.onclick = () => { const n = +b.dataset.step; if (n <= maxStep()) go(n); }));
    const x = $("gExit"); if (x) x.onclick = () => { if (g.mode === "kiosk") { g.confirmExit = true; draw(); } else stop(); };   // an unattended kiosk asks before leaving
    const pr = $("gPrices"); if (pr) pr.onclick = () => { g.priced = !g.priced; draw(); };
    // kiosk: hold the logo for 3 seconds to leave
    const logo = $("gLogo"); let t = null;
    if (g.mode === "kiosk") {
      const down = () => { t = setTimeout(() => { g.confirmExit = true; draw(); }, 3000); }, up = () => clearTimeout(t);
      logo.addEventListener("pointerdown", down); logo.addEventListener("pointerup", up); logo.addEventListener("pointerleave", up);
    }
    const yes = $("gExitYes"); if (yes) yes.onclick = stop;
    const no = $("gExitNo"); if (no) no.onclick = () => { g.confirmExit = false; draw(); };
    if (g.step === 1) {
      el.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => { g.cat = b.dataset.cat; draw(); }));
      el.querySelectorAll("[data-col]").forEach((b) => (b.onclick = () => { g.col = b.dataset.col; draw(); }));
      el.querySelectorAll(".g-tile").forEach((b) => (b.onclick = () => {
        state.anchors = [null, null]; state.capsule = null; A.setAnchor(0, b.dataset.sku);
        if (g.mode === "train") { const tr = train(); if (!tr.anchors.includes(b.dataset.sku)) tr.anchors.push(b.dataset.sku); setTrain(tr); }
        go(2);
      }));
    }
    if (g.step === 2) {
      el.querySelectorAll("[data-amt]").forEach((b) => (b.onclick = () => { A.setBudget(+b.dataset.amt); go(3); }));
      el.querySelectorAll("[data-size]").forEach((b) => (b.onclick = () => { window.CB_INSTORE.applyStoreSize(b.dataset.size); go(3); }));
      $("gAmtGo").onclick = () => { const v = +$("gAmt").value; if (v > 0) { A.setBudget(Math.max(v, (A.cfg().terms || {}).orderMinimum || 0)); go(3); } else $("gAmt").focus(); };
      $("gAmt").onkeydown = (e) => { if (e.key === "Enter") $("gAmtGo").click(); };
      $("g12").onclick = () => { A.setSize(12); go(3); };
    }
    if (g.step === 3) {
      el.querySelectorAll(".g-card").forEach((b) => (b.onclick = () => b.classList.toggle("open")));
      const an = $("gAnother"); if (an) an.onclick = () => { A.build({ exclude: state.capsule.picks.map((p) => p.item.sku) }); draw(); };
      const bu = $("gBudget"); if (bu) bu.onclick = () => go(2);
      const nx = $("gNext"); if (nx) nx.onclick = () => go(4);
    }
    const rs = $("gRestart"); if (rs) rs.onclick = restart;
    const b3 = $("gBack3"); if (b3) b3.onclick = () => go(3);
    if (g.step === 4) {
      const ts = $("gTrSend"); if (ts) ts.onclick = () => window.CB_SENDTOUR && window.CB_SENDTOUR.start("send");
      const tf = $("gTrFollow"); if (tf) tf.onclick = () => window.CB_SENDTOUR && window.CB_SENDTOUR.start("follow");
      const st = $("gStore"); if (st) st.oninput = () => { state.buyer = st.value; $("buyer").value = st.value; A.persist(); };
      const cfg = A.cfg();
      const od = $("gOrder"); if (od) od.onclick = () => { const l = A.orderLink(); if (!l) return; window.open(l.url, "_blank", "noopener"); A.logSend("guided-order-page"); if (g.mode === "train") { const tr = train(); tr.orderPage = true; setTrain(tr); } };
      const ml = $("gMail"); if (ml) ml.onclick = () => {
        const l = A.orderLink(), cl = A.capsuleLink(false);
        const body = `Here is the ${cfg.name} capsule we built together: ${A.allItems().length} styles.\n\nSee it (photos and why each piece was chosen):\n${cl}\n\nReady to order? This opens the order page with it filled in:\n${l ? l.url : ""}\n`;
        const a = document.createElement("a"); a.href = `mailto:?subject=${encodeURIComponent(`${cfg.name}: ${A.capTitle()}`)}&body=${encodeURIComponent(body)}`; a.target = "_top"; document.body.appendChild(a); a.click(); a.remove();
        A.logSend("guided-email");
        if (g.mode === "train" && state.rep) { const tr = train(); tr.sent = true; setTrain(tr); }
        $("gReqNote").textContent = "Your email app opened. Add the buyer's address and press Send there.";
      };
      const sh = $("gShare"); if (sh) sh.onclick = () => { const cl = A.capsuleLink(false); if (navigator.share) navigator.share({ title: `${cfg.name}: ${A.capTitle()}`, url: cl }).then(() => A.logSend("guided-share")).catch(() => {}); else A.copyText(cl, "gReqNote", "Capsule link"); };
      const rq = $("gRequest"); if (rq) rq.onclick = () => {
        const cl = A.capsuleLink(false), store = ($("gStore").value || "").trim();
        const body = `I'd like this ${cfg.name} capsule (${A.allItems().length} styles):\n${cl}\n\nStore: ${store}\nMy name:\nPhone:\nCity and state:\n`;
        const a = document.createElement("a"); a.href = `mailto:${cfg.contactEmail || ""}?subject=${encodeURIComponent(`Capsule request: ${store || A.capTitle()}`)}&body=${encodeURIComponent(body)}`; a.target = "_top"; document.body.appendChild(a); a.click(); a.remove();
        A.logSend("kiosk-request", { to: cfg.contactEmail });
        $("gReqNote").textContent = "Your email app opened with the request. Add your name and phone, then press Send.";
      };
    }
    kick();
  }
  function restart() { state.anchors = [null, null]; state.capsule = null; g.cat = "all"; g.col = "all"; g.priced = false; if (g.mode === "kiosk") { state.buyer = ""; } A.persist(); go(1); }
  // an unattended kiosk goes back to the start after 3 idle minutes
  function kick() { clearTimeout(g.idle); if (g.mode === "kiosk" && g.step > 1) g.idle = setTimeout(restart, 180000); }
  ["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, () => g.on && kick(), true));

  function start(mode, opt) {
    opt = opt || {};
    g.mode = MODES[mode] ? mode : "guided"; g.on = true; g.priced = false; g.confirmExit = false;
    if (opt.line && opt.line !== A.line()) A.switchLine(opt.line, false);
    g.step = opt.step || (state.capsule ? 3 : state.anchors[0] ? 2 : 1);
    if (g.mode === "kiosk" || g.mode === "demo") { if (!opt.step) { state.anchors = [null, null]; state.capsule = null; g.step = 1; } }
    document.body.classList.add("guided-on");
    A.closeDlg("gmDlg");
    draw();
    A.logSend("guided-start", { to: g.mode });
  }
  function stop() {
    g.on = false; clearTimeout(g.idle);
    document.body.classList.remove("guided-on");
    $("guided").className = ""; $("guided").innerHTML = "";
    if (/[?&]mode=/.test(location.search)) try { history.replaceState(null, "", location.pathname); } catch (e) { /* ignore */ }
    if (state.anchors[0]) A.build(); A.renderBoard && state.capsule && A.renderBoard();
    window.CB_PANE && window.CB_PANE("capsule");
  }
  // keep the overlay in step with the builder (a build finishing, a line switch)
  A.hooks.board.push(() => { if (g.on && g.step === 3) draw(); });

  /* ---------------- launcher (builder -> guided mode) ---------------- */
  function link(mode) {
    const base = A.cfg().builderPage.url, p = new URLSearchParams({ mode, line: A.line() });
    if (state.rep && mode !== "kiosk" && mode !== "demo") p.set("rep", state.rep);
    return `${base}?${p.toString()}`;
  }
  function openLauncher() {
    $("gmBody").innerHTML = Object.entries(MODES).map(([k, m]) => `<div class="gm-row"><div><b>${esc(m.title)}</b><div class="note">${esc(m.who)}. ${k === "guided" ? "Prices stay hidden until you tap Show prices; ends with the pre-filled order page." : k === "kiosk" ? "Prices stay hidden until someone taps Show prices; ends with “Request this capsule,” an email to us. Exit asks before leaving, and it starts over after 3 idle minutes." : k === "train" ? "Coach notes beside each step and the four training sessions." : "Featured styles, ending with a “Rep this line” card."}</div>
      <div class="gm-link">${esc(link(k))}</div></div><div class="gm-a"><button class="btn primary" data-go="${k}">Start here</button><button class="btn" data-copy="${k}">Copy link</button></div></div>`).join("") +
      `<div class="gm-row"><div><b>Her store training</b><div class="note">Reps learning “Her store”: an eight-step walk-through on the real screen (add her pieces, fix them, read her palette, build from the best match, set Light/Medium/Strong, show and send it). Each step ticks itself off.</div>
        <div class="gm-link">${esc(A.cfg().builderPage.url + "?mode=store&line=" + A.line())}</div></div><div class="gm-a"><button class="btn primary" id="gmStore">Start here</button><button class="btn" id="gmStoreCopy">Copy link</button></div></div>` +
      [["send", "Send a capsule training", "Reps learning to send: rep code, build, Send capsule…, preview the page she will see, get it to her, and follow it. A seven-step walk-through on the real screen."],
       ["follow", "Follow-up training", "Reps following up a buyer who has ordered: Find similar, paste her order, choose the pieces, build, send. A six-step walk-through on the real screen."]].map(([k, t, d]) => `<div class="gm-row"><div><b>${esc(t)}</b><div class="note">${esc(d)}</div>
        <div class="gm-link">${esc(A.cfg().builderPage.url + "?mode=" + k + "&line=" + A.line())}</div></div><div class="gm-a"><button class="btn primary" data-tour="${k}">Start here</button><button class="btn" data-tourcopy="${k}">Copy link</button></div></div>`).join("") +
      `<p class="note">Each link opens ${esc(A.cfg().name)} only${state.rep ? ` and carries your rep code ${esc(state.rep)} (booth and training)` : ". Set your rep code under Buyer first so booth and training links carry it"}.</p>`;
    $("gmBody").querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => start(b.dataset.go)));
    $("gmBody").querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => A.copyText(link(b.dataset.copy), "gmNote", "Link")));
    $("gmBody").querySelectorAll("[data-tour]").forEach((b) => (b.onclick = () => { A.closeDlg("gmDlg"); window.CB_SENDTOUR && window.CB_SENDTOUR.start(b.dataset.tour); }));
    $("gmBody").querySelectorAll("[data-tourcopy]").forEach((b) => (b.onclick = () => A.copyText(A.cfg().builderPage.url + "?mode=" + b.dataset.tourcopy + "&line=" + A.line(), "gmNote", "Link")));
    $("gmStore").onclick = () => { A.closeDlg("gmDlg"); window.CB_STORETOUR && window.CB_STORETOUR.start(); };
    $("gmStoreCopy").onclick = () => A.copyText(A.cfg().builderPage.url + "?mode=store&line=" + A.line(), "gmNote", "Link");
    A.openDlg("gmDlg");
  }
  $("guidedBtn").onclick = openLauncher;

  // from the link
  const q = new URLSearchParams(location.search), m = q.get("mode");
  if (m === "store") {   // v1.7.2: Her store training
    const L = String(q.get("line") || "").toUpperCase();
    if ((L === "RF" || L === "OIYK") && L !== A.line()) A.switchLine(L, false);
    setTimeout(() => window.CB_STORETOUR && window.CB_STORETOUR.start(), 0);
  }
  if (m && MODES[m]) {
    const L = String(q.get("line") || "").toUpperCase();
    if (q.get("rep") && window.__capsule && window.__capsule.setRep) window.__capsule.setRep(q.get("rep"));
    start(m, { line: L === "RF" || L === "OIYK" ? L : undefined });
  }
  window.CB_GUIDED = { start, stop, openLauncher, link, state: g };
})();
