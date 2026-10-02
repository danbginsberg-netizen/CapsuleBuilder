/* Capsule Builder v1.8.9: the capsule as an email you paste anywhere (Dan, 2 Oct 2026).
   Shared by the builder (Send capsule, Market brief) and the buyer's capsule page (view.js), so the email, the page and
   the market brief all say the same thing.
   - emailHTML(m): the capsule page as email-safe HTML (tables and inline styles only, photos by https address, 600px wide),
     so it pastes into Gmail, Outlook, Apple Mail or any other program with its photos and buttons.
   - emailText(m): the same content as plain text (the clipboard's fallback, and "Copy as plain text").
   - copyRich(html, text): puts both on the clipboard. Nothing opens another app; nothing is sent from here.
   - brief(file, line, today, items, engine): the In the Know brief for this line, or null when there is none, it belongs to
     the other line, or it is past its 60 days. Same rules as the Market brief tab; never brand names.
   - labels(lb), buyerWords(reason, L), terms(cfg, engine, reorder, prices), meta(...): the capsule page's wording. */
(function (root) {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (v) => "$" + (v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money0 = (v) => "$" + Math.round(v || 0).toLocaleString("en-US");
  const dayNum = (d) => Math.floor(Date.parse(String(d).slice(0, 10) + "T00:00:00Z") / 86400000);
  const fmtDay = (d) => { const t = Date.parse(String(d).slice(0, 10) + "T12:00:00Z"); return isNaN(t) ? String(d || "") : new Date(t).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }); };
  const CAT_LABEL = { necklace: "Necklaces", bracelet: "Bracelets", earring: "Earrings" };

  /* ---------- the capsule page's wording (v1.8.4 lb=), one copy for the page and the email ---------- */
  const LABELS = {
    b: { tag: "You bought this", one: "You bought this. Everything else was chosen to go with it.", many: "One of the pieces you bought.", ref1: "the piece you bought", ref2: "the two pieces you bought", refP: "the pieces you bought" },
    p: { tag: "Built around this piece", one: "The capsule is built around this piece. Everything else was chosen to go with it.", many: "One of the pieces this capsule is built around.", ref1: "this piece", ref2: "these two pieces", refP: "these pieces" },
    n: { tag: "", one: "", many: "", ref1: "the lead piece", ref2: "the two lead pieces", refP: "the lead pieces" },
    _: { tag: "Your pick", one: "Your pick. Everything else was chosen to go with it.", many: "One of your picks.", ref1: "your pick", ref2: "your two picks", refP: "your picks" },
  };
  const labels = (lb) => LABELS[lb] || LABELS._;
  // the engine's reasons say "the anchor"; buyers read "your pick" (or the lb= wording)
  const buyerWords = (r, L) => String(r || "").replace(/\bthe anchor (necklace|bracelet|earrings|earring)\b/g, "your $1").replace(/\bthe anchor's\b/g, L.ref1 + "'s").replace(/\bthe anchor\b/g, L.ref1).replace(/the buyer's two picks/g, L.ref2).replace(/the buyer's pick/g, L.ref1);
  function terms(cfg, engine, reorder, prices) {
    const t = cfg.terms || {};
    return [
      ["Minimum", t.orderMinimum ? `${money0(t.orderMinimum)} on a first order` : ""],
      ["Quantities", reorder ? `Reorder: ${engine.reorderUnits()} pieces per style.` : t.unitsNote],
      ["Pricing", prices && t.tiered ? t.tierNote : ""],
      ["Payment", t.paymentTerms], ["Shipping", t.shipping], ["Returns", t.returns], ["Retail", t.retailNote],
    ].filter((r) => r[1]);
  }
  // quantities as the capsule page words them (RF by the dozen; OIYK pieces with the dozen spelled out)
  const qty = (n, half) => (half ? (n === 6 ? "½ dozen" : n % 12 === 0 ? `${n / 12} dozen` : `${n} pcs`) : n % 12 === 0 ? `${n / 12} dozen (${n} pcs)` : `${n} pcs`);
  function meta(cats, n, reorder, store) {
    const parts = ["necklace", "bracelet", "earring"].filter((c) => cats[c]).map((c) => `${cats[c]} ${cats[c] === 1 ? c : CAT_LABEL[c].toLowerCase()}`);
    return [`${n} styles`].concat(parts, reorder ? ["reorder"] : [], store ? [`prepared for ${store}`] : []).join(" · ");
  }

  /* ---------- the In the Know brief (line-locked, 60 days, never brand names) ---------- */
  function brief(f, line, today, items, engine) {
    if (!f || !f.brief || String(f.line).toUpperCase() !== String(line).toUpperCase()) return null;
    const max = f.maxAgeDays == null ? 60 : f.maxAgeDays, now = dayNum(today);
    const ed = f.edition || ((f.signals || [])[0] || {}).asOf;
    if (!ed || now - dayNum(ed) > max) return null;
    const live = (f.signals || []).filter((s) => { const a = now - dayNum(s.asOf); return a >= 0 && a <= max && String(s.direction).toLowerCase() !== "cooling"; });
    let hit = new Set();
    if (engine && items && items.length) { try { hit = new Set(engine.trendNotes(f, items, today, { max: 99 }).notes.map((n) => n.id)); } catch (e) { /* no matches */ } }
    const B = f.brief, M = f.method || null;
    return {
      title: B.title, lede: B.lede, points: B.points || [], display: B.display || [], timing: B.timing || [], edition: ed, editionText: fmtDay(ed),
      signals: live.map((s) => ({ text: s.buyerLine, hit: hit.has(s.id) })),
      about: M ? { who: M.who, stats: (M.stats || []).map((x) => `${x[0]} ${x[1]}`).join(" · "), cadence: M.cadence } : null,
    };
  }
  function briefText(b) {
    return [b.title.toUpperCase(), "", b.lede, "", "WHAT THE MARKET IS DOING", ...b.points.map((p) => "- " + p), "", "DISPLAY IDEAS A STORE CAN COPY", ...b.display.map((p) => "- " + p),
      ...(b.timing.length ? ["", "TIMING", ...b.timing.map((p) => "- " + p)] : []),
      ...(b.signals.length ? ["", "TREND NOTES", ...b.signals.map((s) => "- " + s.text + (s.hit ? " (in this capsule)" : ""))] : []),
      ...(b.about ? ["", "ABOUT THIS RESEARCH", [b.about.who, b.about.stats ? b.about.stats + "." : "", b.about.cadence].filter(Boolean).join(" ")] : []),
      "", `Market brief from In the Know, ${b.editionText}. No brand names.`].join("\n");
  }

  /* ---------- email-safe HTML ---------- */
  const C = { ink: "#1f1d24", mut: "#6b6775", line: "#ebe3dc", bg: "#faf4ef" };
  const SANS = "font-family:Helvetica,Arial,sans-serif;", SERIF = "font-family:Georgia,'Times New Roman',serif;";
  // the note: blank lines make paragraphs; {capsule link} / {order link} typed by the rep become links
  function noteHTML(text, links, acc) {
    return String(text || "").trim().split(/\n\s*\n/).filter((p) => p.trim()).map((p) => {
      let h = esc(p.trim()).replace(/\n/g, "<br>");
      h = h.replace(/\{capsule link\}/g, links.page ? `<a href="${esc(links.page)}" style="color:${acc}">see your capsule</a>` : "")
        .replace(/\{order link\}/g, links.order ? `<a href="${esc(links.order)}" style="color:${acc}">order page</a>` : "");
      return `<p style="margin:0 0 14px;${SANS}font-size:15px;line-height:1.55;color:${C.ink}">${h}</p>`;
    }).join("");
  }
  function noteText(text, links) {
    return String(text || "").trim().replace(/\{capsule link\}/g, links.page || "").replace(/\{order link\}/g, links.order || "");
  }
  function button(href, label, acc, solid) {
    return `<td style="padding:4px 5px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr><td align="center" bgcolor="${solid ? acc : "#ffffff"}" style="border-radius:99px;background:${solid ? acc : "#ffffff"};border:1px solid ${solid ? acc : C.line}">`
      + `<a href="${esc(href)}" target="_blank" style="display:inline-block;padding:12px 22px;${SANS}font-size:14px;font-weight:bold;line-height:1;color:${solid ? "#ffffff" : C.ink};text-decoration:none;border-radius:99px">${esc(label)}</a></td></tr></table></td>`;
  }
  function card(x, acc) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#ffffff;border:1px solid ${x.tag ? acc : C.line};border-radius:12px">`
      + `<tr><td style="padding:${x.tag ? "8px 10px 0" : "0"}">${x.tag ? `<span style="display:inline-block;background:${acc};color:#ffffff;${SANS}font-size:11px;font-weight:bold;line-height:1;border-radius:99px;padding:4px 9px">${esc(x.tag)}</span>` : ""}</td></tr>`
      + `<tr><td align="center" style="padding:6px 6px 0"><img src="${esc(x.img)}" width="164" alt="${esc(x.name)}" style="display:block;width:100%;max-width:164px;height:auto;border:0;outline:none;text-decoration:none"></td></tr>`
      + `<tr><td style="padding:8px 10px 12px;${SANS}word-wrap:break-word;overflow-wrap:anywhere">`
      + `<div style="font-size:14px;font-weight:bold;line-height:1.3;color:${C.ink}">${esc(x.name)}</div>`
      + `<div style="font-size:12px;line-height:1.4;color:${C.mut};margin-top:3px;word-break:break-all">${esc(x.sku)}${x.qty ? ` · ${esc(x.qty)}` : ""}</div>`
      + (x.price ? `<div style="font-size:12px;line-height:1.4;color:${C.ink};margin-top:3px">${esc(x.price)}</div>` : "")
      + (x.why ? `<div style="font-size:12px;line-height:1.45;color:${C.mut};margin-top:6px">${esc(x.why)}</div>` : "")
      + `</td></tr></table>`;
  }
  function grid(items, acc) {
    let h = "";
    for (let i = 0; i < items.length; i += 3) {
      const row = items.slice(i, i + 3);
      h += `<tr>${[0, 1, 2].map((k) => `<td width="33%" valign="top" style="padding:6px;width:33%">${row[k] ? card(row[k], acc) : ""}</td>`).join("")}</tr>`;
    }
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed">${h}</table>`;
  }
  const h3 = (t, acc) => `<div style="${SANS}font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${acc};margin:16px 0 6px">${esc(t)}</div>`;
  const ul = (a, fn) => `<ul style="margin:0;padding:0 0 0 18px">${a.map((x) => `<li style="${SANS}font-size:14px;line-height:1.5;color:${C.ink};margin:0 0 5px">${fn ? fn(x) : esc(x)}</li>`).join("")}</ul>`;
  function briefHTML(b, acc) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#ffffff;border:1px solid ${C.line};border-radius:14px;margin-top:20px"><tr><td style="padding:18px 20px 16px">`
      + `<div style="${SANS}font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${acc}">Market brief · In the Know · ${esc(b.editionText)}</div>`
      + `<div style="${SERIF}font-size:22px;line-height:1.25;color:${C.ink};margin:8px 0 6px">${esc(b.title)}</div>`
      + `<div style="${SANS}font-size:14px;line-height:1.5;color:${C.mut}">${esc(b.lede)}</div>`
      + h3("What the market is doing", acc) + ul(b.points)
      + h3("Display ideas a store can copy", acc) + ul(b.display)
      + (b.timing.length ? h3("Timing", acc) + ul(b.timing) : "")
      + (b.signals.length ? h3("Trend notes", acc) + ul(b.signals, (s) => esc(s.text) + (s.hit ? ` <b style="color:${acc}">· in this capsule</b>` : "")) : "")
      + (b.about ? `<div style="${SANS}font-size:12px;line-height:1.5;color:${C.mut};margin-top:14px;padding-top:10px;border-top:1px solid ${C.line}"><b style="color:${C.ink}">About this research.</b> ${esc(b.about.who)}${b.about.stats ? ` ${esc(b.about.stats)}.` : ""} ${esc(b.about.cadence || "")}</div>` : "")
      + `<div style="${SANS}font-size:11px;color:${C.mut};margin-top:8px">Market brief from In the Know, ${esc(b.editionText)}. No brand names.</div>`
      + `</td></tr></table>`;
  }
  /* m = { accent, logo, name, tagline, title, meta, note, signoff, orderUrl, pageUrl, totals:{label,total,pieces,retail} | null,
           groups:[{label, items:[{img,name,sku,qty,price,why,tag}]}], brief | null, terms:[[k,v]], footer } */
  function emailHTML(m) {
    const acc = m.accent || "#cf4331", links = { page: m.pageUrl, order: m.orderUrl };
    let body = `<div style="text-align:center">`
      + (m.logo ? `<img src="${esc(m.logo)}" alt="${esc(m.name)}" height="56" style="display:inline-block;height:56px;width:auto;border:0">` : "")
      + (m.tagline ? `<div style="${SANS}font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.mut};margin-top:6px">${esc(m.tagline)}</div>` : "")
      + `<div style="${SERIF}font-size:28px;line-height:1.2;color:${C.ink};margin:10px 0 6px">${esc(m.title)}</div>`
      + `<div style="${SANS}font-size:13px;color:${C.mut}">${esc(m.meta)}</div></div>`;
    const btns = [m.orderUrl ? button(m.orderUrl, "Order this capsule", acc, true) : "", m.pageUrl ? button(m.pageUrl, "See it online", acc, false) : ""].join("");
    if (btns) body += `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto 4px"><tr>${btns}</tr></table>`
      + `<div style="${SANS}font-size:12px;line-height:1.5;color:${C.mut};text-align:center;margin:4px 0 0">${m.orderUrl ? "The order button opens our wholesale order page with these styles filled in. " : ""}${m.pageUrl ? "Online: why each piece was chosen, and a printable line sheet." : ""}</div>`;
    if (m.totals) body += `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto 0"><tr>`
      + [[m.totals.label, money(m.totals.total), `${m.totals.pieces} pieces`], ["Retail value", money0(m.totals.retail), m.totals.total ? `${(m.totals.retail / m.totals.total).toFixed(1)}× your cost` : ""]].map((t) =>
        `<td style="padding:0 5px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#ffffff;border:1px solid ${C.line};border-radius:12px"><tr><td align="center" style="padding:10px 18px;${SANS}"><div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.mut}">${esc(t[0])}</div><div style="font-size:20px;font-weight:bold;color:${C.ink}">${esc(t[1])}</div><div style="font-size:12px;color:${C.mut}">${esc(t[2])}</div></td></tr></table></td>`).join("") + `</tr></table>`;
    for (const g of m.groups) {
      body += `<div style="${SERIF}font-size:21px;color:${C.ink};margin:22px 0 4px 6px">${esc(g.label)} <span style="display:inline-block;${SANS}font-size:12px;font-weight:bold;line-height:1;color:#ffffff;background:${acc};border-radius:99px;padding:4px 8px;vertical-align:middle">${g.items.length}</span></div>`;
      body += grid(g.items, acc);
    }
    if (m.brief) body += briefHTML(m.brief, acc);
    if (m.terms && m.terms.length) body += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#ffffff;border:1px solid ${C.line};border-radius:14px;margin-top:20px"><tr><td style="padding:14px 20px 12px">`
      + `<div style="${SERIF}font-size:20px;color:${C.ink};margin:0 0 8px">Terms</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">`
      + m.terms.map((r) => `<tr><td valign="top" width="110" style="padding:3px 10px 3px 0;${SANS}font-size:13px;font-weight:bold;color:${C.ink}">${esc(r[0])}</td><td valign="top" style="padding:3px 0;${SANS}font-size:13px;line-height:1.45;color:${C.ink}">${esc(r[1])}</td></tr>`).join("")
      + `</table></td></tr></table>`;
    if (m.footer) body += `<div style="${SANS}font-size:12px;color:${C.mut};text-align:center;margin-top:18px">${esc(m.footer)}</div>`;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td align="left">`
      + `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse">`
      + (m.note ? `<tr><td style="padding:0 2px 8px">${noteHTML(m.note, links, acc)}</td></tr>` : "")
      + `<tr><td bgcolor="${C.bg}" style="background:${C.bg};border-radius:16px;padding:22px 14px 20px">${body}</td></tr>`
      + (m.signoff ? `<tr><td style="padding:16px 2px 0">${noteHTML(m.signoff, links, acc)}</td></tr>` : "")
      + `</table></td></tr></table>`;
  }
  function emailText(m) {
    const links = { page: m.pageUrl, order: m.orderUrl }, out = [];
    if (m.note) out.push(noteText(m.note, links), "");
    out.push(m.title.toUpperCase(), m.meta, "");
    if (m.orderUrl) out.push("Order this capsule (our order page with these styles filled in):", m.orderUrl, "");
    if (m.pageUrl) out.push("See it online (photos, why each piece was chosen, a printable line sheet):", m.pageUrl, "");
    if (m.totals) out.push(`${m.totals.label}: ${money(m.totals.total)} for ${m.totals.pieces} pieces. Retail value ${money0(m.totals.retail)}.`, "");
    for (const g of m.groups) {
      out.push(g.label.toUpperCase());
      g.items.forEach((x) => out.push(`- ${x.name} (${x.sku})${x.qty ? " · " + x.qty : ""}${x.price ? " · " + x.price : ""}${x.tag ? " · " + x.tag : ""}`));
      out.push("");
    }
    if (m.brief) out.push("What the market is doing this season (our In the Know read):", "", briefText(m.brief), "");
    if (m.terms && m.terms.length) { out.push("TERMS"); m.terms.forEach((r) => out.push(`- ${r[0]}: ${r[1]}`)); out.push(""); }
    if (m.signoff) out.push(noteText(m.signoff, links));
    if (m.footer) out.push("", m.footer);
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  // a short email that is only the brief (Market brief tab)
  function briefEmailHTML(o) {
    const acc = o.accent || "#cf4331";
    return `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse">`
      + (o.note ? `<tr><td style="padding:0 2px 4px">${noteHTML(o.note, {}, acc)}</td></tr>` : "")
      + `<tr><td bgcolor="${C.bg}" style="background:${C.bg};border-radius:16px;padding:16px 14px 18px">`
      + (o.logo ? `<div style="text-align:center"><img src="${esc(o.logo)}" alt="${esc(o.name)}" height="48" style="display:inline-block;height:48px;width:auto;border:0"></div>` : "")
      + briefHTML(o.brief, acc) + (o.footer ? `<div style="${SANS}font-size:12px;color:${C.mut};text-align:center;margin-top:14px">${esc(o.footer)}</div>` : "") + `</td></tr>`
      + (o.signoff ? `<tr><td style="padding:16px 2px 0">${noteHTML(o.signoff, {}, acc)}</td></tr>` : "")
      + `</table>`;
  }
  function briefEmailText(o) { return [o.note, "", briefText(o.brief), "", o.signoff, o.footer ? "\n" + o.footer : ""].filter((x) => x != null).join("\n").replace(/\n{3,}/g, "\n\n").trim(); }

  /* ---------- clipboard: formatted email + plain text, from a click; nothing opens another app ---------- */
  function copyRich(html, text) {
    let done = false;
    const h = (e) => { try { e.clipboardData.setData("text/html", html); e.clipboardData.setData("text/plain", text); e.preventDefault(); done = true; } catch (x) { done = false; } };
    document.addEventListener("copy", h, true);
    try { document.execCommand("copy"); } catch (e) { /* fall through */ }
    document.removeEventListener("copy", h, true);
    if (done) return Promise.resolve(true);
    if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== "undefined") {
      return navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]).then(() => true, () => false);
    }
    return Promise.resolve(false);
  }
  // phones and tablets keep the share sheet; on a computer the builder only copies (Dan: don't open apps on my desktop)
  const touchDevice = () => { try { return !!(navigator.share && window.matchMedia && window.matchMedia("(pointer: coarse)").matches); } catch (e) { return false; } };
  const doc = (inner) => `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:14px;background:#ffffff">${inner}</body></html>`;

  root.CB_MAIL = { qty, esc, money, money0, fmtDay, labels, buyerWords, terms, meta, brief, briefText, briefHTML, emailHTML, emailText, briefEmailHTML, briefEmailText, copyRich, touchDevice, doc, CAT_LABEL };
})(typeof window !== "undefined" ? window : this);
