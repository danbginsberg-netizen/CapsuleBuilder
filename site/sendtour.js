/* Capsule Builder v1.8.3 — "Send it" training: two walk-throughs on the real screen, the same way as Store training.
   Opens from Training mode (step 4 of a training run), from the ▶ Guided mode list, or with a link:
     ?mode=send&line=RF     Send a capsule: rep code, build, read it, Send capsule…, preview the page, get it to the buyer, follow it
     ?mode=follow&line=RF   Follow up a buyer who has ordered: Find similar, the buyer's order, the picks, build, send
   Each step points at the part of the screen it's about, says what to do and what to tell the buyer, and ticks itself off
   when the rep has done it. Nothing here changes the catalog, prices or orders, and nothing is sent from the builder. */
(function () {
  "use strict";
  const A = window.__cb;
  if (!A) return;
  const { $, esc, state } = A;
  const TRAIN_KEY = "capsule_training";   // shared with Training mode (guided.js)
  const T = { on: false, track: "send", i: 0, previewed: false, sent: false, pdf: false, tabbed: false };
  const sim = () => (window.CB_SIMILAR ? window.CB_SIMILAR.state() : {});
  const dlgOpen = () => !!($("sendDlg") && $("sendDlg").classList.contains("open"));
  const built = () => { const S = sim(); return !!(S.built && S.built.line === A.line() && state.capsule); };

  const TRACKS = {
    send: {
      name: "Send a capsule",
      done: "Send training complete. Next buyer: build it, preview it, then send it with your rep code on.",
      steps: [
        { pane: "capsule", dlg: false, target: "#repCode", title: "Set your rep code and the store's name",
          do: "Under Buyer, type your rep code once (letters, numbers, dashes) and the buyer's store name. The browser remembers your code.",
          say: "“What's the name of your store?”",
          why: "Your rep code rides on the capsule page and the order link, so orders from this capsule are credited to you. The store name travels with the links and fills in on the order page.",
          done: () => !!state.rep && !!(state.buyer || "").trim() },
        { pane: "capsule", dlg: false, target: "#buildBtn", title: "Build the buyer's capsule",
          do: "Type a SKU or name in Pick 1 (Pick 2 is optional). Choose First order or Reorder, then a number of pieces or a budget, and click Build capsule. Or use ▶ Guided mode for the four-step version.",
          say: "“Which piece did you pick up twice?”",
          why: "One favorite in, a balanced capsule out. First order or Reorder decides the quantities and minimums on everything that follows.",
          done: () => !!state.capsule },
        { pane: "capsule", dlg: false, target: "#board", title: "Read it before you send it",
          do: "Look at the board. Swap a piece you don't like, Lock one you want to keep, or click Show another version. ⓘ Why these pieces explains the capsule in plain words.",
          say: "“Anything you'd swap? I can change it while we talk.”",
          why: "The capsule page and the order link carry exactly what is on this board, so fix it here first.",
          done: null },
        { pane: "capsule", target: "#sendBtn", title: "Open Send capsule…",
          do: "Click Send capsule…. It shows the email the buyer will get: your note, the capsule pieces with photos and why each was chosen, and an Order this capsule button that opens the pre-filled order page.",
          say: "“I'll send you a page with your pieces and an order button.”",
          why: "The capsule page shows photos by category, a reason under every piece, the terms, a Print / save as PDF button and an Order this capsule button. The capsule travels inside the link, so nothing is stored anywhere.",
          done: () => dlgOpen() },
        { pane: "capsule", dlg: true, target: "#sdOpen", title: "Preview what the buyer will see",
          do: "Read the Email preview, then click Preview page ↗ to open the capsule page the See it online button leads to. Check the pieces and their reasons, and that Order this capsule opens the pre-filled order page. Wholesale prices show only if you tick “Show wholesale prices”; the market brief only if you tick it.",
          say: "(To yourself) Open every link before it goes out.",
          why: "It is the same page the buyer opens. A wrong piece is easier to fix now than after the buyer has seen it.",
          done: () => T.previewed },
        { pane: "capsule", dlg: true, target: "#sdCopyEmail", title: "Get it to the buyer",
          do: "Click Copy email, open a new message in whatever email program you use (Gmail, Outlook, Apple Mail), paste, add the subject (Copy subject) and send it from there. The photos and the order button come with it. Or click Copy capsule link and paste it into an email you've already written. On a phone, Share… works too.",
          say: "“It's on its way. The order button on the page already has these styles in it.”",
          why: "Nothing is sent from the builder. Your rep code and the capsule ID ride on both links.",
          done: () => T.sent },
        { pane: "capsule", dlg: false, target: "#saveBtn", title: "Save it and follow it",
          do: "Click Save so you can reopen this capsule and change it if the buyer asks. The capsule ID (c…) is how it is traced: Send log (CSV) lists every send, share and copy from this browser, and orders arrive marked “Credited to: Rep code … · Capsule …”.",
          say: "(To yourself) If the buyer wants changes, swap the piece here and send the new link.",
          why: "Sent, opened and ordered are three sources joined on the capsule ID. That is how we learn which capsules work.",
          done: null },
      ],
    },
    follow: {
      name: "Follow up a buyer who has ordered",
      done: "Follow-up training complete. Next buyer who orders: paste the buyer's order, keep the strongest matches, send one page.",
      steps: [
        { pane: "store", dlg: false, mode: "match", target: "#storeMode", title: "Open Find similar · follow up",
          do: "On the Store tab, click “Find similar · follow up”. It is the follow-up for a buyer who has ordered: what the buyer bought, what the buyer asked about, and what we have like it.",
          say: "“Send me a photo, or tell me what you were looking for, and I'll send back what we have.”",
          why: "One page for the buyer: here's what you bought, and here's what we have in the stones you asked about.",
          done: () => document.body.classList.contains("sim-on") },
        { pane: "store", dlg: false, mode: "similar", target: "#simDrop", title: "What the buyer asked for",
          do: "Drop or paste the buyer's photo, or type the buyer's request in the buyer's words, for example “small faceted stone strands in tourmaline and hematite”. Tap the chips to adjust. If the buyer only reordered, you can skip this step.",
          say: "“What did you like about it: the stones, the size, the color?”",
          why: "The buyer's photo and words shape the results. The buyer's photo is read on this device; it is never uploaded and never goes on an order.",
          done: () => { const S = sim(); return !!((S.words || "").trim() || (S.photos || []).length || (S.ref || "").trim()); } },
        { pane: "store", dlg: false, mode: "similar", target: ".sim-bought", title: "What the buyer bought",
          do: "Paste the buyer's order: select the items on the Shopify order page (or the order email or invoice) and paste. Style numbers alone work. Click Read the order.",
          say: "“I'll start from what you took home so I don't repeat it.”",
          why: "Colorways the buyer already has are marked and never suggested, the style the buyer bought shows up in new stones, and the colorways on the buyer's order are ticked as the buyer's reorder. Nothing is looked up online.",
          done: () => !!((sim().orderText || "").trim()) },
        { pane: "store", dlg: false, mode: "similar", target: ".sim-res", title: "Choose the pieces",
          do: "Tick what the buyer is reordering and the new colorways you want to show the buyer, or click Pick the top matches for me. The tray at the bottom counts the buyer's reorder and the new picks.",
          say: "“These are the same style in the new stones you asked about.”",
          why: "You choose the new picks; none are picked until you pick. If the buyer bought more than two pieces, keep the strongest matches instead of everything, so the capsule stays in proportion.",
          done: () => !!document.querySelector("#simTray:not(.empty)") },
        { pane: "store", dlg: false, mode: "similar", target: "#simTray", title: "Build a capsule from the picks",
          do: "Click Build a capsule from my picks. It makes a capsule of exactly the buyer's reorder and your new picks, marks what the buyer bought, and switches to reorder quantities, a dozen per style.",
          say: "(To yourself) The buyer's name goes in “For” first, so the capsule and the page carry it.",
          why: "The order link and QR fill in the buyer's reorder and every pick. The first piece is the capsule's anchor, so it is the one the buyer bought.",
          done: () => built() },
        { pane: "capsule", target: () => document.querySelector("#board .simstrip") || $("sendBtn"), title: "Send it",
          do: "Click Send capsule… for a web page with an order button, exactly as in the first walk-through. Or click Follow-up PDF (what the buyer bought + this capsule) for the document version to attach.",
          say: "“Here's what you bought, and here's what goes with it. Tell me what to swap and a new version comes back the same day.”",
          why: "Send capsule… carries your rep code and the capsule ID. The Follow-up PDF has the buyer's order, the buyer's request and every piece, with a QR code to the pre-filled order page.",
          done: () => dlgOpen() || T.pdf },
      ],
    },
  };

  const steps = () => TRACKS[T.track].steps;
  const target = (s) => { const t = typeof s.target === "function" ? s.target() : s.target; return typeof t === "string" ? document.querySelector(t) : t; };

  function draw() {
    const R = TRACKS[T.track], S = R.steps, s = S[T.i], n = S.length;
    if (s.pane && window.CB_PANE) { const cur = document.querySelector(".mtabs button.on"); if (!cur || cur.dataset.pane !== s.pane) window.CB_PANE(s.pane); }
    if (s.mode && window.CB_SIMILAR && s.pane === "store" && !T.tabbed[T.i]) {   // set the Store mode once per step; after that the rep drives
      T.tabbed[T.i] = true; window.CB_SIMILAR.setMode(s.mode);
    }
    // the Send dialog: open it for the steps inside it, close it for the steps outside it
    if (s.dlg === true && !dlgOpen() && state.capsule && $("sendBtn") && !$("sendBtn").disabled) $("sendBtn").click();
    if (s.dlg === false && dlgOpen()) A.closeDlg("sendDlg");
    document.querySelectorAll(".st-focus").forEach((x) => x.classList.remove("st-focus"));
    const t = target(s); if (t) { t.classList.add("st-focus"); t.scrollIntoView({ block: "center", behavior: "smooth" }); }
    const ok = !s.done || s.done();
    let box = $("storeTour");
    if (!box) { box = document.createElement("div"); box.id = "storeTour"; document.body.appendChild(box); }
    box.classList.toggle("tr-right", dlgOpen());
    box.classList.toggle("tr-side", s.pane === "store");   // Find similar fills the main area, so the card sits over the (unused) left sidebar
    box.innerHTML = `<div class="stt-h"><span>${esc(R.name)} · step ${T.i + 1} of ${n}</span><button class="x" id="sttX" title="Leave training">✕</button></div>
      <div class="stt-bar"><i style="width:${((T.i + (ok ? 1 : 0)) / n) * 100}%"></i></div>
      <h3>${esc(s.title)}</h3>
      <p><b>Do:</b> ${esc(s.do)}</p><p><b>Say:</b> ${esc(s.say)}</p><p class="why"><b>Why:</b> ${esc(s.why)}</p>
      ${s.done ? `<div class="stt-check ${ok ? "ok" : ""}">${ok ? "✓ Done" : "Waiting for you to try it…"}</div>` : ""}
      <div class="stt-a"><button class="btn" id="sttBack" ${T.i ? "" : "disabled"}>Back</button><button class="btn primary" id="sttNext">${T.i === n - 1 ? "Finish" : ok ? "Next" : "Skip"}</button></div>`;
    $("sttX").onclick = stop;
    $("sttBack").onclick = () => { T.i = Math.max(0, T.i - 1); draw(); };
    $("sttNext").onclick = () => { if (T.i === n - 1) { finish(); return; } T.i++; draw(); };
  }
  function finish() {
    const tr = Object.assign({}, A.store.get(TRAIN_KEY, {})); tr[T.track] = true; A.store.set(TRAIN_KEY, tr);
    const msg = TRACKS[T.track].done;
    stop();
    A.toast(msg);
  }
  function stop() {
    T.on = false;
    document.querySelectorAll(".st-focus").forEach((x) => x.classList.remove("st-focus"));
    const b = $("storeTour"); if (b) b.remove();
    document.body.classList.remove("tour-on", "send-tour-on");
    if (dlgOpen()) A.closeDlg("sendDlg");
  }
  function start(track) {
    if (window.CB_GUIDED && window.CB_GUIDED.state.on) window.CB_GUIDED.stop();
    if (window.CB_STORETOUR && window.CB_STORETOUR.state.on) window.CB_STORETOUR.stop();
    T.track = TRACKS[track] ? track : "send"; T.on = true; T.i = 0; T.previewed = false; T.sent = false; T.pdf = false; T.tabbed = {};
    document.body.classList.add("tour-on", "send-tour-on");
    draw();
  }
  // tick steps off as the rep works
  const redraw = () => { if (T.on) setTimeout(draw, 60); };
  A.hooks.board.push(redraw);
  A.hooks.context.push(redraw);
  document.addEventListener("input", (e) => { if (T.on && e.target && (e.target.id === "repCode" || e.target.id === "buyer" || /^sim/.test(e.target.id || ""))) redraw(); }, true);
  document.addEventListener("change", () => { if (T.on) redraw(); }, true);
  document.addEventListener("click", (e) => {
    if (!T.on || !e.target.closest) return;
    const c = (sel) => e.target.closest(sel);
    if (c("#sdOpen")) T.previewed = true;
    if (c("#sdCopyEmail, #sdCopyLink, #sdCopy, #sdShare")) {
      T.sent = true;
      if (T.track === "send" && state.rep && c("#sdCopyEmail")) { const tr = Object.assign({}, A.store.get(TRAIN_KEY, {})); tr.sent = true; A.store.set(TRAIN_KEY, tr); }   // the Training certification: a real send with a rep code
    }
    if (c("#simFollowPdf")) T.pdf = true;
    if (c("#paneStore, .mtabs, #sendDlg, #board, #sendBtn, #buildBtn, #saveBtn")) redraw();
  }, true);

  window.CB_SENDTOUR = { start, stop, tracks: TRACKS, state: T };

  // from the link: ?mode=send&line=RF or ?mode=follow&line=RF
  const q = new URLSearchParams(location.search), m = q.get("mode");
  if (m === "send" || m === "follow") {
    const L = String(q.get("line") || "").toUpperCase();
    if ((L === "RF" || L === "OIYK") && L !== A.line()) A.switchLine(L, false);
    if (q.get("rep") && window.__capsule && window.__capsule.setRep) window.__capsule.setRep(q.get("rep"));
    setTimeout(() => start(m), 0);
  }
})();
