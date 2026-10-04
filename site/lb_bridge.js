/* Capsule Builder v1.9.3: the builder's side of the Line Book (Dan, 2 Oct 2026).
   - "Line book ↗" in the tab bar opens the full line in its own tab (onlyifyouknow.com/pages/line-book, or Line Book.html
     beside this file when the builder runs from the folder), carrying the rep code and the chosen account.
   - Pieces the rep sends from the line book arrive here: same-origin localStorage message "cb_lb_cmd" {id, line, skus, mode}.
     "add" puts them into the capsule on the board when it's the same line; otherwise (or "new") they become a new capsule.
     A builder tab that's open answers at once ("cb_lb_ack"); a builder that opens later picks up a message under 2 minutes old.
   - The capsule on the board is published as "cb_lb_board" {line, skus} so the line book can tick the pieces already in it. */
(function () {
  "use strict";
  const A = window.__cb;
  if (!A) return;
  const { $, store, state } = A;
  const B = window.CAPSULE_CONFIG || {};
  const LINE_NAME = { RF: "Retro Forever", OIYK: "Only If You Know™" };

  function lineBookUrl() {
    const p = new URLSearchParams();
    if (state.rep) p.set("rep", state.rep);
    const g = store.get("capsule_acct_groups", null);   // v1.9.8: the Line Book now reads rep and groups only from its link
    if (Array.isArray(g) && g.length) p.set("grp", g.join(","));
    p.set("line", A.line());
    if (state.account) p.set("acct", state.account);
    const q = "?" + p.toString();
    if (location.protocol === "file:") return "Line Book.html" + q;
    return ((B.lineBookPage || {}).url || "linebook.html") + q;
  }
  const tabs = $("mtabs");
  if (tabs && !$("lineBookBtn")) {
    const b = document.createElement("button");
    b.id = "lineBookBtn"; b.className = "gm"; b.type = "button";
    b.title = "Every style in both lines, with big photos, in its own tab. Send pieces from it straight into this capsule.";
    b.textContent = "Line book ↗";
    b.onclick = () => window.open(lineBookUrl(), "cb_linebook");
    const g = $("guidedBtn");
    tabs.insertBefore(b, g || null);
  }

  /* publish the board */
  function publish() {
    const c = state.capsule;
    const skus = c ? c.anchors.map((a) => a.sku).concat(c.picks.map((p) => p.item.sku)) : [];
    store.set("cb_lb_board", { line: A.line(), skus, t: Date.now() });
  }
  A.hooks.board.push(publish);
  A.hooks.line.push(publish);

  /* receive picks */
  const done = new Set(store.get("cb_lb_done", []));
  function apply(cmd, fresh) {
    if (!cmd || !cmd.id || done.has(cmd.id) || !Array.isArray(cmd.skus) || !cmd.skus.length) return;
    if (!fresh && Date.now() - (cmd.t || 0) > 120000) return;
    done.add(cmd.id); store.set("cb_lb_done", [...done].slice(-30));
    const same = state.capsule && cmd.line === A.line();
    if (cmd.line && cmd.line !== A.line()) A.switchLine(cmd.line, false);   // picks from the other line start a capsule there
    const add = cmd.mode !== "new" && same;
    const name = !add && cmd.name ? `Curated for ${cmd.name}` : "";
    const ok = A.buildFromPicks(cmd.skus, { add, name });
    const n = cmd.skus.length;
    const text = ok === false ? "Those pieces aren't in this line's catalog" : add ? `Added ${n === 1 ? "1 piece" : n + " pieces"} from the line book` : `New ${LINE_NAME[cmd.line] || ""} capsule from ${n === 1 ? "1 piece" : n + " line-book picks"}`;
    if (cmd.name && !add && $("buyer") && !state.buyer.trim()) { $("buyer").value = cmd.name; $("buyer").dispatchEvent(new Event("input")); }
    store.set("cb_lb_ack", { id: cmd.id, text, t: Date.now() });
    if (A.toast) A.toast(text);
    try { window.focus(); } catch (e) { /* ignore */ }
  }
  window.addEventListener("storage", (e) => { if (e.key === "cb_lb_cmd") apply(store.get("cb_lb_cmd", null), true); });
  setTimeout(() => { apply(store.get("cb_lb_cmd", null), false); publish(); }, 400);
  window.CB_LINEBOOK = { url: lineBookUrl, apply, publish };
})();
