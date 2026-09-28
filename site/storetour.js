/* Capsule Builder v1.7.2 — "Her store" training: a guided walk-through on the real screen.
   Opens from the Her store tab (▶ Her store training), from Guided mode, or with the link ?mode=store&line=RF.
   Each step points at the part of the screen it's about, says what to do and what to tell the buyer,
   and ticks itself off when the rep has done it. Nothing here changes the catalog, prices or orders. */
(function () {
  "use strict";
  const A = window.__cb;
  if (!A) return;
  const { $, esc, state } = A;
  const T = { on: false, i: 0, start: null };
  const items = () => state.context.items;
  const STEPS = [
    { pane: "store", target: ".standins", title: "Add what she wears most",
      do: "Tap a quick add that looks like her best-selling clothing, for example the navy knit dress.",
      say: "“What's selling best on your floor right now? Let's put it next to our line.”",
      why: "The builder matches our jewelry to what she already sells. One or two of her key pieces is enough to start.",
      done: () => items().length > T.start.items },
    { pane: "store", target: "#ctxItems .cx", title: "Make it hers",
      do: "On the card, change what it is (for example dress to jumpsuit) and tap her real colors. The name and picture follow.",
      say: "“Is it more of a jumpsuit? Navy or black?”",
      why: "The type sets which necklace shapes suit it (the neckline matters most), and the colors drive the matches.",
      done: () => T.edited },
    { pane: "store", target: "#ctxDrop", title: "Add a photo, her palette or her list",
      do: "Snap or drop a photo of her floor or a garment, tap a store palette, or import her vendor list. Photos read their own colors; fix them with one tap.",
      say: "“Can I take a quick photo of this rack?”",
      why: "Photos and palettes stay on this device and never go on the order. More context gives better matches.",
      done: () => items().some((x) => ["photo", "camera", "paste", "link", "palette", "file"].includes(x.source)) },
    { pane: "store", target: "#ctxSummary", title: "Read her store at a glance",
      do: "Look at her palette bar, metal and look. The note under it says whether her clothing is mostly prints or solids.",
      say: "“Your floor leans navy and tan, so gold and warm stones will pop.”",
      why: "Prints call for quieter jewelry; solids can carry a statement piece. The builder uses this automatically.",
      done: null },
    { pane: "store", target: "#ctxComp", title: "Build from the best match",
      do: "Tap “Build from this” on a piece in Best from our line for her store (or keep the buyer's own pick if she has one).",
      say: "“This one goes with your navy dress. Let's build around it.”",
      why: "This list is ranked on her store alone: our in-stock pieces that suit it best, one colorway each.",
      done: () => !!state.capsule },
    { pane: "store", target: "#ctxStrength", title: "Set how much her store counts",
      do: "Try Strong, then Light, and read the line under the buttons: it says how many pieces her store changed.",
      say: "(To yourself) Light keeps the buyer's favorite leading; Strong reshapes the capsule around her floor.",
      why: "Light: her store only breaks ties. Medium: it shares the say. Strong: it leads. The buyer's pick, stock and minimums always hold.",
      done: () => T.strengths.size >= 2 },
    { pane: "capsule", target: "#board .ctxstrip", title: "Show her the capsule beside her store",
      do: "On the Capsule tab, her store sits above the capsule, and pieces it brought in are marked “Chosen for her store.”",
      say: "“Here's how our pieces sit next to what you carry. Each one says what it goes with.”",
      why: "Her items are context only: never on the order page, the QR code, the Excel or any total.",
      done: null },
    { pane: "capsule", target: "#sheetBtn", title: "Send it with her store in it",
      do: "Open Line sheet (PDF), tick “Shown with her store” under Extra pages, then Email as PDF.",
      say: "“I'll send this tonight with your pieces beside ours, and the order link filled in.”",
      why: "The page shows her pieces labeled as hers, for context. The order and prices cover only our line.",
      done: () => !!state.sheet.ctxPage },
  ];

  function el(sel) { return sel ? document.querySelector(sel) : null; }
  function draw() {
    const s = STEPS[T.i], n = STEPS.length;
    if (s.pane && window.CB_PANE) { const cur = document.querySelector(".mtabs button.on"); if (!cur || cur.dataset.pane !== s.pane) window.CB_PANE(s.pane); }
    document.querySelectorAll(".st-focus").forEach((x) => x.classList.remove("st-focus"));
    const t = el(s.target); if (t) { t.classList.add("st-focus"); t.scrollIntoView({ block: "center", behavior: "smooth" }); }
    const ok = !s.done || s.done();
    let box = $("storeTour");
    if (!box) { box = document.createElement("div"); box.id = "storeTour"; document.body.appendChild(box); }
    box.innerHTML = `<div class="stt-h"><span>Her store training · step ${T.i + 1} of ${n}</span><button class="x" id="sttX" title="Leave training">✕</button></div>
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
    A.store.set("capsule_storetour_done", new Date().toISOString());
    stop();
    A.toast("Her store training complete. Use it with the next buyer: two or three of her pieces is enough.");
  }
  function stop() {
    T.on = false;
    document.querySelectorAll(".st-focus").forEach((x) => x.classList.remove("st-focus"));
    const b = $("storeTour"); if (b) b.remove();
    document.body.classList.remove("tour-on");
  }
  function start() {
    if (window.CB_GUIDED && window.CB_GUIDED.state.on) window.CB_GUIDED.stop();
    if (window.CB_SIMILAR) { if (window.CB_PANE) window.CB_PANE("store"); window.CB_SIMILAR.setMode("match"); }   // v1.7.4: the training is on "Goes with her store"
    T.on = true; T.i = 0; T.edited = false; T.strengths = new Set(); T.start = { items: items().length };
    document.body.classList.add("tour-on");
    draw();
  }
  // tick steps off as the rep works (the tour redraws after each change)
  const redraw = () => { if (T.on) setTimeout(draw, 60); };
  A.hooks.context.push(redraw);
  A.hooks.board.push(redraw);
  document.addEventListener("change", (e) => {
    if (!T.on) return;
    if (e.target.closest && e.target.closest("#ctxItems .cx")) T.edited = true;
    if (e.target.id === "shCtxPage") redraw();
    redraw();
  }, true);
  document.addEventListener("click", (e) => {
    if (!T.on || !e.target.closest) return;
    if (e.target.closest("#ctxItems .cx-cols button")) T.edited = true;
    const sb = e.target.closest("#ctxStrength button"); if (sb) T.strengths.add(sb.dataset.s);
    if (e.target.closest("#paneStore, .mtabs, #sheetDlg")) redraw();
  }, true);
  window.CB_STORETOUR = { start, stop, steps: STEPS, state: T };
})();
