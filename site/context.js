/* Capsule Builder v1.7.0 — "The store": what the buyer already carries, beside our capsule.
   Photos (upload, camera, paste, drag), quick stand-ins, store palettes and CSV/Excel imports become context items:
   other brands' jewelry and the store's own apparel and accessories. They never enter a capsule, an order, a total or an export;
   they only nudge our picks toward pieces that go with them (engine.setContext / contextScore). Nothing is uploaded:
   photos are shrunk to small thumbnails and kept in this browser and in the saved capsule. */
(function () {
  "use strict";
  const A = window.__cb;
  if (!A) return;
  const { $, esc, state, label } = A;
  const MAX_ITEMS = 30;

  /* ---------------- vocab ---------------- */
  const SW = {   // swatch colors for our color families
    "coral/red": "#e0513c", orange: "#ef8a2c", yellow: "#f1c232", "blush pink": "#f3b5c1", "hot pink": "#dc3a8a",
    "lavender/purple": "#9a7cc8", "cobalt/navy": "#233f7a", blue: "#3f7fcf", aqua: "#5cc6c8", turquoise: "#2aa89c",
    "seafoam/mint": "#a2dcc4", "emerald/green": "#1f8a4c", "ivory/pearl": "#f1e9d4", white: "#ffffff", neutral: "#c3a17f",
    grey: "#9aa0a6", black: "#1d1d1f", "crystal/clear": "#e3eef3", gold: "#cfa83a", silver: "#bfc3c8",
  };
  const CNAME = {   // how the rep says it
    "coral/red": "red / coral", orange: "orange / rust", yellow: "yellow / mustard", "blush pink": "blush / pale pink", "hot pink": "hot pink / fuchsia",
    "lavender/purple": "lavender / purple", "cobalt/navy": "navy / cobalt", blue: "blue / denim", aqua: "aqua", turquoise: "turquoise / teal",
    "seafoam/mint": "mint / seafoam", "emerald/green": "green / olive", "ivory/pearl": "ivory / cream", white: "white", neutral: "tan / camel / brown",
    grey: "grey / charcoal", black: "black", "crystal/clear": "clear", gold: "gold", silver: "silver",
  };
  const cword = (f) => (CNAME[f] || f).split(" / ")[0];
  const KINDS = {
    apparel: { label: "Clothing", types: ["top", "shirt / blouse", "sweater / knit", "dress", "jacket / coat", "pants / skirt", "jumpsuit"] },
    accessory: { label: "Accessories", types: ["bag", "scarf", "hat", "belt", "shoes", "hair accessory", "sunglasses"] },
    jewelry: { label: "Other jewelry", types: ["necklace", "earrings", "bracelet", "ring", "watch"] },
    palette: { label: "Store palette", types: ["palette"] },
  };
  const NECK_TYPES = ["top", "shirt / blouse", "sweater / knit", "dress", "jumpsuit"];
  const NECKLINES = [["", "Neckline…"], ["v-neck", "V-neck"], ["crew/high", "Crew / high"], ["scoop/square", "Scoop / square"], ["off-shoulder/strapless", "Off-shoulder / strapless"], ["collared/button-down", "Collared"], ["turtleneck", "Turtleneck"]];
  const PATTERNS = [["solid", "Solid"], ["floral", "Floral"], ["stripe", "Stripe"], ["animal", "Animal print"], ["plaid", "Plaid / check"], ["geometric", "Geometric"], ["print", "Other print"]];
  const FABRICS = {
    apparel: ["knit", "linen", "denim", "cotton", "silk / satin", "lace", "velvet", "leather", "sequin"],
    accessory: ["leather", "straw / raffia", "canvas", "suede", "silk", "metal hardware"],
    jewelry: ["pearl", "gemstone", "glass bead", "seed bead", "resin/epoxy", "shell", "crystal/CZ", "enamel", "metal", "cord/thread"],
  };
  const STYLES = [["boho", "Boho"], ["coastal", "Coastal"], ["classic pearl", "Classic"], ["minimal", "Minimal"], ["statement", "Bold / statement"], ["retro/vintage", "Retro"], ["playful", "Playful"], ["glam", "Glam / evening"]];
  const SCALES = [["", "Scale…"], ["delicate", "Delicate"], ["medium", "Medium"], ["statement", "Statement"]];
  const METALS = [["", "Metal…"], ["gold", "Gold"], ["silver", "Silver"], ["mixed", "Mixed"], ["none", "No metal"]];
  const PALETTES = [
    ["Warm neutrals", ["neutral", "ivory/pearl", "white"]], ["Coastal blues", ["blue", "white", "aqua"]], ["Jewel tones", ["emerald/green", "cobalt/navy", "lavender/purple"]],
    ["Holiday", ["coral/red", "emerald/green", "gold"]], ["Black & white", ["black", "white"]], ["Pastels", ["blush pink", "seafoam/mint", "lavender/purple"]],
    ["Brights", ["hot pink", "orange", "turquoise"]], ["Earth tones", ["neutral", "emerald/green", "orange"]],
  ];
  const STANDINS = [
    { name: "navy knit dress", kind: "apparel", type: "dress", colors: ["cobalt/navy"], pattern: "solid", neckline: "crew/high", materials: ["knit"] },
    { name: "white linen top", kind: "apparel", type: "top", colors: ["white"], pattern: "solid", neckline: "v-neck", materials: ["linen"] },
    { name: "denim jacket", kind: "apparel", type: "jacket / coat", colors: ["blue"], pattern: "solid", neckline: "collared/button-down", materials: ["denim"] },
    { name: "floral maxi dress", kind: "apparel", type: "dress", colors: ["blush pink", "emerald/green"], pattern: "floral", neckline: "v-neck", styles: ["boho"] },
    { name: "striped top", kind: "apparel", type: "top", colors: ["white", "cobalt/navy"], pattern: "stripe", neckline: "crew/high", styles: ["coastal"] },
    { name: "camel coat", kind: "apparel", type: "jacket / coat", colors: ["neutral"], pattern: "solid", neckline: "collared/button-down" },
    { name: "black dress", kind: "apparel", type: "dress", colors: ["black"], pattern: "solid", neckline: "scoop/square", styles: ["glam"] },
    { name: "red sweater", kind: "apparel", type: "sweater / knit", colors: ["coral/red"], pattern: "solid", neckline: "crew/high", materials: ["knit"] },
    { name: "leopard scarf", kind: "accessory", type: "scarf", colors: ["neutral", "black"], pattern: "animal" },
    { name: "black crossbody", kind: "accessory", type: "bag", colors: ["black"], pattern: "solid", materials: ["leather"], metal: "gold" },
    { name: "straw tote", kind: "accessory", type: "bag", colors: ["neutral"], pattern: "solid", materials: ["straw / raffia"], styles: ["coastal", "boho"] },
    { name: "gold hoops (other brand)", kind: "jewelry", type: "earrings", colors: ["gold"], metal: "gold", materials: ["metal"], scale: "medium", styles: ["minimal"] },
    { name: "pearl strand (other brand)", kind: "jewelry", type: "necklace", colors: ["ivory/pearl"], metal: "gold", materials: ["pearl"], scale: "delicate", styles: ["classic pearl"] },
    { name: "silver cuff (other brand)", kind: "jewelry", type: "bracelet", colors: ["silver"], metal: "silver", materials: ["metal"], scale: "statement", styles: ["minimal"] },
  ];
  const CAT_OF = { necklace: "necklace", earrings: "earring", bracelet: "bracelet" };

  /* ---------------- silhouettes (simple shapes, our own drawing) ---------------- */
  const SIL = {
    dress: "M38 10h24l4 14-6 6 14 58H26l14-58-6-6z", top: "M30 14l12-4h16l12 4 14 16-10 10-6-6v50H32V34l-6 6-10-10z",
    "shirt / blouse": "M30 14l12-4 8 10 8-10 12 4 14 16-10 10-6-6v50H32V34l-6 6-10-10z", "sweater / knit": "M28 16l14-6h16l14 6 12 50-10 2-6-34v52H32V34l-6 34-10-2z",
    "jacket / coat": "M28 14l12-4 10 16 10-16 12 4 12 52-10 2-4-30v54H30V38l-4 30-10-2z", "pants / skirt": "M32 12h36l6 76H56l-6-50-6 50H26z",
    jumpsuit: "M34 10h32l4 20-4 4 8 54H56l-6-40-6 40H26l8-54-4-4z", bag: "M22 38h56l-6 46H28z M38 38c0-16 24-16 24 0", scarf: "M30 12h40l-8 26 10 50H56L50 44 44 88H28l10-50z",
    hat: "M14 64c0-8 72-8 72 0s-72 8-72 0z M30 60c0-28 40-28 40 0", belt: "M10 44h80v12H10z M44 40h14v20H44z", shoes: "M14 60c16 0 22-18 34-18 10 0 12 10 22 14l16 6v10H14z",
    "hair accessory": "M20 50c10-20 50-20 60 0-10 8-50 8-60 0z", sunglasses: "M12 42h32v12c0 8-32 8-32 0z M56 42h32v12c0 8-32 8-32 0z M44 46h12",
    necklace: "M22 18c0 40 56 40 56 0 M50 58m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0", earrings: "M34 20v12 M66 20v12 M34 44m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M66 44m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0",
    bracelet: "M50 50m-26 0a26 20 0 1 0 52 0a26 20 0 1 0-52 0", ring: "M50 58m-18 0a18 18 0 1 0 36 0a18 18 0 1 0-36 0 M42 32l8-12 8 12z", watch: "M40 12h20v20H40z M40 68h20v20H40z M50 50m-18 0a18 18 0 1 0 36 0a18 18 0 1 0-36 0",
  };
  const DETAIL = {   // light lines drawn over the shape (waist, openings, leg split) so each type reads at a glance
    dress: "M38 30h24", jumpsuit: "M33 38h34 M50 50v38", "pants / skirt": "M50 22v66", "jacket / coat": "M50 26v70 M40 10l10 16 10-16",
    top: "M42 12c4 6 12 6 16 0", "shirt / blouse": "M50 20v74", "sweater / knit": "M36 86h28 M42 12c4 6 12 6 16 0", scarf: "M32 30h36", bag: "M28 50h44",
  };
  const STROKE_ONLY = new Set(["necklace", "earrings", "bracelet", "ring"]);
  function silhouette(x) {
    const cs = (x.colors || []).length ? x.colors : ["grey"];
    if (x.kind === "palette") return `<svg viewBox="0 0 100 100" class="sil">${cs.map((c, i) => `<rect x="${10 + (i * 80) / cs.length}" y="22" width="${80 / cs.length}" height="56" fill="${SW[c] || "#ccc"}" stroke="#0002"/>`).join("")}</svg>`;
    const d = SIL[x.type] || SIL.top, c1 = SW[cs[0]] || "#ccc", c2 = SW[cs[1]] || c1;
    const pat = x.pattern && x.pattern !== "solid" ? `<defs><pattern id="p${x.id}" width="10" height="10" patternUnits="userSpaceOnUse">${x.pattern === "stripe" ? `<rect width="10" height="5" fill="${c2}"/>` : x.pattern === "plaid" ? `<path d="M0 5h10M5 0v10" stroke="${c2}" stroke-width="2"/>` : `<circle cx="5" cy="5" r="2.4" fill="${c2}"/>`}</pattern></defs>` : "";
    if (STROKE_ONLY.has(x.type)) return `<svg viewBox="0 0 100 100" class="sil"><path d="${d}" fill="none" stroke="${c1}" stroke-width="6" stroke-linecap="round"/></svg>`;
    const light = /^#(f|e|d)/i.test(c1) ? "#0005" : "#fff9";
    return `<svg viewBox="0 0 100 100" class="sil">${pat}<path d="${d}" fill="${c1}" stroke="#0003" stroke-width="1.5"/>${pat ? `<path d="${d}" fill="url(#p${x.id})" opacity=".7"/>` : ""}${DETAIL[x.type] ? `<path d="${DETAIL[x.type]}" fill="none" stroke="${light}" stroke-width="2.5" stroke-linecap="round"/>` : ""}</svg>`;
  }
  window.CB_SILHOUETTE = silhouette;

  /* ---------------- color from a photo ---------------- */
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  // map a color to our families (kind: jewelry reads warm metallics as gold and light greys as silver)
  function family(r, g, b, kind) {
    const [h, s, l] = rgb2hsl(r, g, b);
    if (l > 0.93) return "white";
    if (l < 0.13) return "black";
    if (s < 0.12) { if (kind === "jewelry" && l > 0.55) return "silver"; return l > 0.85 ? "white" : l < 0.25 ? "black" : "grey"; }
    if (h < 15 || h >= 345) return l > 0.75 ? "blush pink" : l < 0.3 && s < 0.5 ? "neutral" : "coral/red";
    if (h < 40) return (l < 0.4 || s < 0.45) ? "neutral" : l > 0.8 ? "ivory/pearl" : "orange";
    if (h < 65) { if (kind === "jewelry" && s > 0.35 && l > 0.3 && l < 0.7) return "gold"; return l > 0.82 || s < 0.35 ? (l > 0.7 ? "ivory/pearl" : "neutral") : "yellow"; }
    if (h < 160) return l > 0.72 ? "seafoam/mint" : "emerald/green";
    if (h < 185) return l > 0.65 ? "aqua" : "turquoise";
    if (h < 215) return l > 0.62 ? "aqua" : "blue";
    if (h < 250) return l < 0.38 ? "cobalt/navy" : "blue";
    if (h < 290) return "lavender/purple";
    return l > 0.72 ? "blush pink" : "hot pink";
  }
  // center-weighted sample, background (the border color) dropped, k-means into a few colors, mapped to families
  function paletteOf(img, kind) {
    const N = 72, cv = document.createElement("canvas"); cv.width = cv.height = N;
    const g = cv.getContext("2d", { willReadFrequently: true });
    const r = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const sx = ((img.naturalWidth || img.width) - r) / 2, sy = ((img.naturalHeight || img.height) - r) / 2;
    g.drawImage(img, sx, sy, r, r, 0, 0, N, N);
    const d = g.getImageData(0, 0, N, N).data;   // throws if the image is from another site without permission
    const px = (x, y) => { const i = (y * N + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    // background = the most common color around the edge (a product on a plain backdrop), not the average
    const buckets = new Map();
    for (let i = 0; i < N; i++) for (const p of [px(i, 0), px(i, N - 1), px(0, i), px(N - 1, i)]) {
      const k = p.map((v) => v >> 4).join(","), b = buckets.get(k) || [0, 0, 0, 0];
      b[0] += p[0]; b[1] += p[1]; b[2] += p[2]; b[3]++; buckets.set(k, b);
    }
    const top = [...buckets.values()].sort((a, b) => b[3] - a[3])[0];
    const br = [top[0] / top[3], top[1] / top[3], top[2] / top[3]];
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    let pts = [];
    for (let y = 6; y < N - 6; y++) for (let x = 6; x < N - 6; x++) {
      const p = px(x, y), w = 1 - Math.hypot(x - N / 2, y - N / 2) / (N * 0.75);
      if (dist(p, br) > 38) pts.push([p, Math.max(0.2, w)]);
    }
    if (pts.length < 40) { pts = []; for (let y = 8; y < N - 8; y++) for (let x = 8; x < N - 8; x++) pts.push([px(x, y), 1]); }
    const K = 5;
    let cs = Array.from({ length: K }, (_, k) => pts[Math.floor(((k + 0.5) * pts.length) / K)][0].slice());
    for (let it = 0; it < 8; it++) {
      const acc = cs.map(() => [0, 0, 0, 0]);
      for (const [p, w] of pts) { let bi = 0, bd = 1e9; cs.forEach((c, k) => { const dd = dist(p, c); if (dd < bd) { bd = dd; bi = k; } }); const a = acc[bi]; a[0] += p[0] * w; a[1] += p[1] * w; a[2] += p[2] * w; a[3] += w; }
      cs = acc.map((a, k) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3], a[3]] : cs[k].concat(0)));
    }
    const tot = cs.reduce((a, c) => a + (c[3] || 0), 0) || 1;
    const fams = {};
    const sw = [];
    cs.filter((c) => c[3] / tot > 0.06).sort((a, b) => b[3] - a[3]).forEach((c) => {
      const f = family(c[0], c[1], c[2], kind);
      fams[f] = (fams[f] || 0) + c[3] / tot;
      sw.push("#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""));
    });
    const list = Object.entries(fams).filter(([, v]) => v >= 0.12).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => f);
    return { families: list.length ? list : Object.keys(fams).slice(0, 1), swatches: sw.slice(0, 4) };
  }
  function thumbOf(img, px) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, px / Math.max(w, h));
    const cv = document.createElement("canvas"); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", 0.72);
  }
  const loadImg = (src, cors) => new Promise((ok, no) => { const im = new Image(); if (cors) im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = () => no(new Error("image")); im.src = src; });

  /* ---------------- model ---------------- */
  const ctx = () => state.context;
  const newId = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  // the card's name follows what it is: color, fabric (one clothing fabric), and a plain noun for the type (v1.7.2)
  const NOUN = { "shirt / blouse": "blouse", "sweater / knit": "sweater", "jacket / coat": "jacket", "pants / skirt": "pants", "hair accessory": "hair clip" };
  function autoName(x) {
    if (x.kind === "palette") return `${x.label || "store"} palette`;
    const fab = x.kind === "apparel" && (x.materials || []).length === 1 ? (x.materials[0].split(" / ")[0] + " ") : "";
    const other = x.kind === "jewelry" && x.source === "stand-in" ? " (other brand)" : "";
    return `${(x.colors || [])[0] ? cword(x.colors[0]) + " " : ""}${fab}${NOUN[x.type] || x.type || "piece"}${other}`;
  }
  function addItem(x) {
    const L = ctx().items;
    if (L.length >= MAX_ITEMS) { A.toast(`The store holds up to ${MAX_ITEMS} items. Remove one to add more.`); return null; }
    x = Object.assign({ id: newId(), kind: "apparel", type: "top", colors: [], materials: [], styles: [], pattern: "solid", neckline: "", metal: "", scale: "" }, x);
    if (!x.name) { x.name = autoName(x); x.autoName = true; }
    L.push(x); changed(true); return x;
  }
  let pending = null;
  function changed(rebuild) {
    A.applyContext(); A.persist();
    draw();
    clearTimeout(pending);
    if (rebuild && state.capsule && state.context.on) pending = setTimeout(() => { A.build(); }, 350);
    else if (state.capsule) A.renderBoard();
  }

  async function addPhotoFile(file, source) {
    if (!/^image\//.test(file.type)) return;
    const url = URL.createObjectURL(file);
    try {
      const im = await loadImg(url);
      const x = addItem({ source: source || "photo", thumb: thumbOf(im, 220), kind: "apparel", type: "top" });
      if (!x) return;
      const p = paletteOf(im, x.kind); x.colors = p.families; x.swatches = p.swatches; x.needsType = true;
      if (x.autoName) x.name = autoName(x);
      changed(true);
    } catch (e) { A.toast("That picture couldn't be read."); } finally { URL.revokeObjectURL(url); }
  }
  async function addPhotoLink(u) {
    u = String(u || "").trim(); if (!/^https?:\/\//i.test(u)) { A.toast("Paste a full image link that starts with https://"); return; }
    let x = null;
    try {
      const im = await loadImg(u, true);
      x = addItem({ source: "link", kind: "apparel", type: "top", image: u });
      try { const p = paletteOf(im, x.kind); x.colors = p.families; x.swatches = p.swatches; x.thumb = thumbOf(im, 220); } catch (e) { x.noColor = true; }
    } catch (e) { x = addItem({ source: "link", kind: "apparel", type: "top", image: u, noColor: true }); }
    if (x) { x.needsType = true; if (x.autoName) x.name = autoName(x); changed(true); if (x.noColor) A.toast("That site doesn't let us read the picture's colors. Tap the store's colors on the card."); }
  }

  /* ---------------- file import (CSV, Excel) ---------------- */
  const SYN = {
    brand: ["brand", "vendor", "manufacturer", "designer", "line", "collection brand"],
    name: ["item", "item name", "itemname", "name", "product", "product name", "title", "style name", "description"],
    sku: ["item number", "itemnumber", "itemid", "item id", "style number", "style", "sku"],
    category: ["category", "type", "product type", "department", "class", "subcategory"],
    color: ["color", "colour", "color name", "colors"],
    material: ["material", "materials", "fabric", "content", "metal"],
    image: ["image url", "imageurl", "image", "image file", "photo", "picture", "image link"],
    note: ["note", "notes", "comment"],
  };
  const COLOR_WORDS = [
    [/navy|cobalt|indigo|midnight/, "cobalt/navy"], [/denim|chambray|sky|periwinkle|\bblue/, "blue"], [/teal|turquoise/, "turquoise"], [/aqua|cyan/, "aqua"],
    [/mint|seafoam|sage/, "seafoam/mint"], [/green|olive|emerald|forest|kelly|jade|khaki green/, "emerald/green"], [/lavender|lilac|purple|plum|violet|mauve/, "lavender/purple"],
    [/fuchsia|magenta|hot pink/, "hot pink"], [/blush|pink|rose/, "blush pink"], [/burgundy|wine|maroon|red|coral|scarlet|cherry/, "coral/red"],
    [/rust|terracotta|orange|tangerine|copper/, "orange"], [/mustard|yellow|lemon/, "yellow"], [/cream|ivory|pearl|ecru|oat/, "ivory/pearl"],
    [/camel|tan|beige|brown|khaki|taupe|mocha|chocolate|tortoise|cognac|sand|nude|natural|leopard/, "neutral"],
    [/charcoal|grey|gray|heather|slate/, "grey"], [/black|onyx|jet/, "black"], [/white|snow/, "white"], [/gold|brass/, "gold"], [/silver|rhodium|pewter|chrome/, "silver"], [/clear|crystal/, "crystal/clear"],
  ];
  function colorsFrom(t) {
    t = String(t || "").toLowerCase(); const out = [];
    for (const part of t.split(/[\/,&+|;]| and /)) for (const [re, f] of COLOR_WORDS) if (re.test(part)) { if (!out.includes(f)) out.push(f); break; }
    return out.slice(0, 3);
  }
  function kindFrom(t) {
    t = String(t || "").toLowerCase();
    const J = [["necklace", /necklace|choker|pendant|lariat/], ["earrings", /earring|hoop|stud|huggie/], ["bracelet", /bracelet|bangle|cuff/], ["ring", /\bring/], ["watch", /watch/]];
    for (const [ty, re] of J) if (re.test(t)) return ["jewelry", ty];
    const Acc = [["bag", /bag|tote|clutch|crossbody|purse|wallet/], ["scarf", /scarf|wrap|shawl/], ["hat", /hat|cap|beanie/], ["belt", /belt/], ["shoes", /shoe|sandal|boot|sneaker|heel|flat/], ["sunglasses", /sunglass/], ["hair accessory", /hair|clip|claw|headband|scrunchie/]];
    for (const [ty, re] of Acc) if (re.test(t)) return ["accessory", ty];
    const Ap = [["dress", /dress|gown/], ["jumpsuit", /jumpsuit|romper/], ["jacket / coat", /jacket|coat|blazer|vest|shacket/], ["sweater / knit", /sweater|cardigan|knit|pullover/], ["shirt / blouse", /shirt|blouse|button/], ["pants / skirt", /pant|skirt|jean|short|trouser|legging/], ["top", /top|tee|tank|cami|tunic/]];
    for (const [ty, re] of Ap) if (re.test(t)) return ["apparel", ty];
    return ["apparel", "top"];
  }
  let XLSXp = null;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (XLSXp) return XLSXp;
    const base = (document.querySelector('script[src*="ui.js"]') || {}).src.replace(/ui\.js.*$/, "");   // v1.8.0: web scripts carry ?h=
    XLSXp = new Promise((ok, no) => { const s = document.createElement("script"); s.src = base + "xlsx.core.min.js?h=e4d0d141"; s.onload = () => ok(window.XLSX); s.onerror = () => no(new Error("xlsx")); document.head.appendChild(s); });
    return XLSXp;
  }
  async function importFile(file) {
    let rows = [];
    try {
      if (/\.csv$/i.test(file.name) || file.type === "text/csv") rows = A.parseCSV(await file.text());
      else { const X = await loadXLSX(); const wb = X.read(await file.arrayBuffer(), { type: "array" }); const ws = wb.Sheets[wb.SheetNames[0]]; rows = X.utils.sheet_to_json(ws, { defval: "" }); }
    } catch (e) { A.flash("ctxNote", `<span class="warn">Couldn't read ${esc(file.name)}. Save it as CSV or .xlsx and try again.</span>`); return; }
    if (!rows.length) { A.flash("ctxNote", `<span class="warn">${esc(file.name)} has no rows.</span>`); return; }
    const heads = Object.keys(rows[0]);
    const col = (k) => heads.find((h) => SYN[k].includes(String(h).trim().toLowerCase()));
    const C = Object.fromEntries(Object.keys(SYN).map((k) => [k, col(k)]));
    if (!C.name && !C.category && !C.color) { A.flash("ctxNote", `<span class="warn">No Item, Category or Color column found in ${esc(file.name)}. Download the template to see the columns.</span>`); return; }
    let n = 0, skipped = 0;
    for (const r of rows) {
      if (ctx().items.length >= MAX_ITEMS) { skipped++; continue; }
      const nm = String(r[C.name] || "").trim(), cat = String(r[C.category] || "") + " " + nm;
      const [kind, type] = kindFrom(cat);
      const colors = colorsFrom(r[C.color] || nm);
      const mt = String(r[C.material] || "").toLowerCase();
      const materials = (FABRICS[kind] || []).filter((f) => mt.includes(f.split(" ")[0].split("/")[0]));
      const metal = /gold|brass/.test(mt + " " + String(r[C.color] || "").toLowerCase()) ? "gold" : /silver|rhodium/.test(mt + " " + String(r[C.color] || "").toLowerCase()) ? "silver" : "";
      if (!nm && !colors.length) { skipped++; continue; }
      const img = String(r[C.image] || "").trim();
      const low = (nm + " " + String(r[C.color] || "")).toLowerCase();
      const pattern = /floral|flower|botanical/.test(low) ? "floral" : /stripe/.test(low) ? "stripe" : /leopard|cheetah|zebra|snake|animal/.test(low) ? "animal" : /plaid|check|gingham|tartan/.test(low) ? "plaid" : /geometric|geo /.test(low) ? "geometric" : /print|paisley|dot/.test(low) ? "print" : "solid";
      addItem({ source: "file", kind, type, colors, materials, metal, pattern, brand: String(r[C.brand] || "").trim(), name: nm || undefined, image: /^https?:\/\//i.test(img) ? img : "", note: String(r[C.note] || "").trim() });
      n++;
    }
    A.flash("ctxNote", `Added ${n} item${n === 1 ? "" : "s"} from ${esc(file.name)}${skipped ? ` · ${skipped} skipped (empty rows, or over ${MAX_ITEMS} items)` : ""}. Check each card's colors.`);
    changed(true);
  }
  function template() {
    const rows = [["Brand", "Item", "Category", "Color", "Material", "Image URL", "Note"],
      ["Example Brand", "Navy knit dress", "Dress", "Navy", "Knit", "", "Best seller"], ["Example Brand", "Gold hoop earrings", "Earrings", "Gold", "Metal", "", ""]];
    A.download("her_store_template.csv", "﻿" + rows.map((r) => r.map(A.csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  }

  /* ---------------- drawing ---------------- */
  const opt = (list, v) => list.map(([k, t]) => `<option value="${esc(k)}" ${k === v ? "selected" : ""}>${esc(t)}</option>`).join("");
  function typeSelect(x) {
    return `<select data-f="kindtype">${Object.entries(KINDS).filter(([k]) => k !== "palette" || x.kind === "palette").map(([k, v]) => `<optgroup label="${esc(v.label)}">${v.types.map((t) => `<option value="${k}|${esc(t)}" ${x.kind === k && x.type === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</optgroup>`).join("")}</select>`;
  }
  function itemCard(x) {
    const vis = x.thumb ? `<img src="${esc(x.thumb)}" alt="">` : x.image ? `<img src="${esc(x.image)}" alt="" referrerpolicy="no-referrer">` : silhouette(x);
    const fab = FABRICS[x.kind] || [];
    return `<div class="cx ${x.needsType ? "ask" : ""}" data-id="${esc(x.id)}">
      <div class="cx-v">${vis}${x.swatches ? `<div class="cx-sw" title="Colors read from the photo">${x.swatches.map((c) => `<i style="background:${c}"></i>`).join("")}</div>` : ""}</div>
      <div class="cx-b">
        <div class="cx-top"><input type="text" data-f="name" value="${esc(x.name || "")}" placeholder="What is it?" aria-label="Name"><button class="x" data-f="del" title="Remove">✕</button></div>
        ${x.brand ? `<div class="note">${esc(x.brand)}</div>` : ""}
        ${x.needsType ? `<div class="cx-ask">What is it? Pick below, then check the colors.</div>` : ""}
        <div class="cx-row">${x.kind === "palette" ? `<span class="pill">Store palette</span>` : typeSelect(x)}
          ${x.kind === "apparel" || x.kind === "accessory" ? `<select data-f="pattern">${opt(PATTERNS, x.pattern || "solid")}</select>` : ""}
          ${x.kind === "apparel" && NECK_TYPES.includes(x.type) ? `<select data-f="neckline">${opt(NECKLINES, x.neckline || "")}</select>` : ""}
          ${x.kind === "jewelry" || x.kind === "accessory" ? `<select data-f="metal">${opt(METALS, x.metal || "")}</select><select data-f="scale">${opt(SCALES, x.scale || "")}</select>` : ""}</div>
        <div class="cx-cols" title="The store's colors: tap to add or remove">${Object.keys(SW).map((f) => `<button data-c="${esc(f)}" class="${(x.colors || []).includes(f) ? "on" : ""}" style="--c:${SW[f]}" title="${esc(CNAME[f])}"></button>`).join("")}</div>
        <div class="cx-picked">${(x.colors || []).map((f) => esc(cword(f))).join(" · ") || '<span class="warn">No color yet</span>'}</div>
        ${x.kind !== "palette" ? `<details><summary>Fabric, material and look</summary>
          ${fab.length ? `<div class="cx-chips">${fab.map((m) => `<button data-m="${esc(m)}" class="${(x.materials || []).includes(m) ? "on" : ""}">${esc(label(m))}</button>`).join("")}</div>` : ""}
          <div class="cx-chips">${STYLES.map(([k, t]) => `<button data-s="${esc(k)}" class="${(x.styles || []).includes(k) ? "on" : ""}">${esc(t)}</button>`).join("")}</div>
        </details>` : ""}
      </div></div>`;
  }
  function summaryHTML() {
    const P = A.engine().ctxProfile;
    if (!P) return `<p class="note">Add what the store carries to see the store's palette here.</p>`;
    const cols = Object.entries(P.colors).sort((a, b) => b[1] - a[1]);
    const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    return `<div class="cx-bar">${cols.map(([f, w]) => `<i style="flex:${w};background:${SW[f] || "#ccc"}" title="${esc(CNAME[f] || f)} ${Math.round(w * 100)}%"></i>`).join("")}</div>
      <div class="note">${cols.slice(0, 4).map(([f, w]) => `${esc(cword(f))} ${Math.round(w * 100)}%`).join(" · ")}</div>
      ${Object.keys(P.metals).length ? `<div class="note">Metal: ${top(P.metals).map(esc).join(", ")}</div>` : ""}
      ${Object.keys(P.styles).length ? `<div class="note">Look: ${top(P.styles).map((k) => esc((STYLES.find((s) => s[0] === k) || [k, k])[1])).join(", ")}</div>` : ""}
      ${P.apparel ? `<div class="note">${P.busy ? `${P.busy} of ${P.apparel} clothing pieces are prints, so quieter jewelry leads.` : "The store's clothing is mostly solid, so statement pieces can lead."}</div>` : ""}`;
  }
  const STRENGTH_NOTE = {
    light: "<b>Light:</b> the buyer's pick decides; the store only breaks ties between close matches, so often little or nothing changes.",
    medium: "<b>Medium:</b> the store and the buyer's pick share the say; a few pieces usually change.",
    strong: "<b>Strong:</b> the store leads; the most pieces change toward the store's palette, metal and look (fewer when the buyer's pick already suits the store).",
  };
  const STRENGTH_ALWAYS = "At every level the buyer's pick stays in, and stock, minimums, the category mix and variety rules still hold. The list below is ranked on the store alone, so it doesn't change with the level.";
  function drawImpact() {
    const el = $("ctxImpact"); if (!el) return;
    const c = ctx(), im = state.ctxImpact;
    el.innerHTML = !c.items.length ? "" : !c.on ? "Switched off: the capsule is built on the buyer's pick alone." : !state.capsule ? "Build a capsule (or tap “Build from this” below) to see what the store changes." : im ? `On the board now: the store changed <b>${im.changed} of ${im.total}</b> pieces from the capsule built on the buyer's pick alone.${im.changed ? " Those pieces are marked “Chosen for the store.”" : " Try a stronger setting to let it lead."}` : "";
  }
  let compCat = "";
  function compHTML() {
    const e = A.engine();
    if (!e.ctxProfile) return "";
    const list = e.complements({ n: 9, cat: compCat || undefined, minQty: state.minQty });
    const cats = [["", "All"], ["necklace", "Necklaces"], ["earring", "Earrings"], ["bracelet", "Bracelets"]];
    return `<h4>Best from our line for the store</h4><p class="note">${STRENGTH_ALWAYS}</p><div class="chips cx-cat">${cats.map(([k, t]) => `<button data-cat="${k}" class="${compCat === k ? "on" : ""}">${t}</button>`).join("")}</div>
      <div class="cx-comp">${list.map((r) => `<div class="cc" data-sku="${esc(r.item.sku)}"><img src="${esc(r.item.img)}" alt="" loading="lazy"><b>${esc(r.item.name)}</b><small>${esc(r.item.sku)}${r.ctx.why ? ` · goes with the store’s ${esc(r.ctx.why.item)}` : ""}</small>
        <div class="cc-a"><button class="btn" data-use="0">Build from this</button>${state.anchors[0] && state.anchors[0] !== r.item.sku ? `<button class="btn" data-use="1">Add as pick 2</button>` : ""}</div></div>`).join("") || '<p class="note">Nothing in stock fits yet.</p>'}</div>`;
  }
  function draw() {
    const pane = $("paneStore"); if (!pane) return;
    const c = ctx();
    $("ctxItems").innerHTML = c.items.length ? c.items.map(itemCard).join("") : `<div class="cx-empty"><b>Nothing here yet.</b>Add photos of what the store carries, tap a quick stand-in, pick the store's palette or import the store's vendor list.</div>`;
    $("ctxOn").checked = c.on; $("ctxStrength").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.s === c.strength));
    // v1.7.2: what the strength does, and what it did to the capsule on the board
    $("ctxStrengthNote").innerHTML = STRENGTH_NOTE[c.strength] || "";
    drawImpact();
    $("ctxSummary").innerHTML = summaryHTML();
    $("ctxComp").innerHTML = compHTML();
    $("ctxCount").textContent = c.items.length ? `${c.items.length} item${c.items.length === 1 ? "" : "s"}` : "";
    $("ctxRebuild").disabled = !state.anchors[0];
    const tab = document.querySelector('.mtabs button[data-pane="store"] small'); if (tab) tab.textContent = c.items.length ? c.items.length : "";
    wireItems();
  }
  function wireItems() {
    const find = (el) => ctx().items.find((x) => x.id === el.closest(".cx").dataset.id);
    $("ctxItems").querySelectorAll(".cx").forEach((card) => {
      const x = find(card);
      card.querySelector('[data-f="del"]').onclick = () => { ctx().items = ctx().items.filter((y) => y !== x); changed(true); };
      const nm = card.querySelector('[data-f="name"]'); nm.oninput = () => { x.name = nm.value; x.autoName = false; A.persist(); }; nm.onchange = () => changed(false);
      const kt = card.querySelector('[data-f="kindtype"]'); if (kt) kt.onchange = () => { const [k, t] = kt.value.split("|"); if (k !== x.kind) { x.materials = (x.materials || []).filter((m) => (FABRICS[k] || []).includes(m)); if (k === "jewelry") x.pattern = "solid"; } x.kind = k; x.type = t; x.needsType = false; if (k !== "apparel" || !NECK_TYPES.includes(t)) x.neckline = ""; if (x.autoName) x.name = autoName(x); changed(true); };
      ["pattern", "neckline", "metal", "scale"].forEach((f) => { const el = card.querySelector(`[data-f="${f}"]`); if (el) el.onchange = () => { x[f] = el.value; x.needsType = false; changed(true); }; });
      card.querySelectorAll(".cx-cols button").forEach((b) => (b.onclick = () => { const f = b.dataset.c, L = x.colors || (x.colors = []); const i = L.indexOf(f); if (i >= 0) L.splice(i, 1); else if (L.length < 4) L.push(f); else A.toast("Up to 4 colors per piece."); if (x.autoName) x.name = autoName(x); changed(true); }));
      card.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => { const L = x.materials || (x.materials = []); const i = L.indexOf(b.dataset.m); i >= 0 ? L.splice(i, 1) : L.push(b.dataset.m); if (x.autoName) x.name = autoName(x); changed(true); keepOpen(x.id); }));
      card.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => { const L = x.styles || (x.styles = []); const i = L.indexOf(b.dataset.s); i >= 0 ? L.splice(i, 1) : L.push(b.dataset.s); changed(true); keepOpen(x.id); }));
    });
    $("ctxComp").querySelectorAll(".cx-cat button").forEach((b) => (b.onclick = () => { compCat = b.dataset.cat; $("ctxComp").innerHTML = compHTML(); wireComp(); }));
    wireComp();
  }
  function keepOpen(id) { const d = $("ctxItems").querySelector(`.cx[data-id="${id}"] details`); if (d) d.open = true; }
  function wireComp() {
    $("ctxComp").querySelectorAll(".cc [data-use]").forEach((b) => (b.onclick = () => {
      const sku = b.closest(".cc").dataset.sku;
      if (b.dataset.use === "0") { A.state.anchors = [null, null]; A.setAnchor(0, sku); } else A.setAnchor(1, sku);
      window.CB_PANE && window.CB_PANE("capsule");
    }));
  }

  /* ---------------- pane ---------------- */
  function mount() {
    const pane = $("paneStore");
    pane.innerHTML = `
      <div class="sp-head"><div><h1>The store</h1><p class="note">Show what the store already carries: the store's clothing and bags, and other jewelry lines on the store's floor. The builder finds the pieces from our line that go with them. <b>Context only:</b> never on the order, the QR code, the Excel or any total. Photos stay on this device.</p></div><div class="sp-hd-r"><span class="pill" id="ctxCount"></span><button class="btn soft" id="ctxTour">▶ Store training</button></div></div>
      <div class="sp-grid">
        <div class="sp-main">
          <div class="sp-add">
        <div class="drop" id="ctxDrop"><b>Add photos</b><span>Drop pictures here, paste a screenshot (Ctrl+V / ⌘V), or</span>
          <div class="row"><button class="btn primary" id="ctxPick">Choose photos…</button><button class="btn" id="ctxCam">Take a photo</button><button class="btn" id="ctxLinkBtn">Image link…</button></div>
          <input type="file" id="ctxFiles" accept="image/*" multiple hidden><input type="file" id="ctxCamIn" accept="image/*" capture="environment" hidden>
          <div class="row hide" id="ctxLinkRow"><input type="url" id="ctxLink" placeholder="https://… (a picture of the item)"><button class="btn" id="ctxLinkAdd">Add</button></div></div>
        <div class="sp-q"><h4>Quick add</h4><div class="standins">${STANDINS.map((s, i) => `<button data-i="${i}" title="Add ${esc(s.name)}">${silhouette(Object.assign({ id: "s" + i }, s))}<small>${esc(s.name)}</small></button>`).join("")}</div></div>
          </div>
          <div class="note" id="ctxNote"></div>
          <div class="sp-items" id="ctxItems"></div>
        </div>
        <div class="sp-side">
          <h4>The store's palette</h4><div class="chips pals">${PALETTES.map(([n, cs], i) => `<button data-p="${i}"><span class="pal">${cs.map((c) => `<i style="background:${SW[c]}"></i>`).join("")}</span>${esc(n)}</button>`).join("")}</div>
          <h4>From a file</h4><div class="row"><button class="btn" id="ctxImport">Import CSV or Excel…</button><button class="btn" id="ctxTemplate">Template</button></div>
          <input type="file" id="ctxFile" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" hidden>
          <p class="note">A vendor list or a rep platform export works: columns are found by name (Brand, Item, Category, Color, Material, Image URL; also Item Number, ItemName, Style Number).</p>
          <div class="sp-glance">
          <h4>The store at a glance</h4><div id="ctxSummary"></div>
          <label class="tog"><input type="checkbox" id="ctxOn"> Use the store when building the capsule</label>
          <div class="seg" id="ctxStrength"><button data-s="light">Light</button><button data-s="medium">Medium</button><button data-s="strong">Strong</button></div>
          <div class="note" id="ctxStrengthNote"></div><div class="ctx-impact" id="ctxImpact"></div>
          <div class="row"><button class="btn primary" id="ctxRebuild">Rebuild the capsule with it</button><button class="btn" id="ctxClear">Clear the store</button></div>
          <div id="ctxComp"></div>
          </div>
        </div>
      </div>`;
    $("ctxTour").onclick = () => window.CB_STORETOUR && window.CB_STORETOUR.start();
    $("ctxPick").onclick = () => $("ctxFiles").click();
    $("ctxCam").onclick = () => $("ctxCamIn").click();
    $("ctxFiles").onchange = (e) => { [...e.target.files].forEach((f) => addPhotoFile(f, "photo")); e.target.value = ""; };
    $("ctxCamIn").onchange = (e) => { [...e.target.files].forEach((f) => addPhotoFile(f, "camera")); e.target.value = ""; };
    $("ctxLinkBtn").onclick = () => { $("ctxLinkRow").classList.toggle("hide"); $("ctxLink").focus(); };
    $("ctxLinkAdd").onclick = () => { addPhotoLink($("ctxLink").value); $("ctxLink").value = ""; };
    $("ctxLink").onkeydown = (e) => { if (e.key === "Enter") $("ctxLinkAdd").click(); };
    const drop = $("ctxDrop");
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => {
      const fs = [...(e.dataTransfer.files || [])];
      fs.filter((f) => /^image\//.test(f.type)).forEach((f) => addPhotoFile(f, "photo"));
      fs.filter((f) => /\.(csv|xlsx|xls)$/i.test(f.name)).forEach(importFile);
      if (!fs.length) { const u = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain"); if (u) addPhotoLink(u); }
    });
    document.addEventListener("paste", (e) => {
      if ($("paneStore").classList.contains("hide") || document.body.classList.contains("sim-on")) return;   // v1.7.4: Find similar takes its own photos
      if (/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || "") && document.activeElement.id !== "ctxLink") return;
      const fs = [...(e.clipboardData ? e.clipboardData.files : [])].filter((f) => /^image\//.test(f.type));
      if (fs.length) { e.preventDefault(); fs.forEach((f) => addPhotoFile(f, "paste")); }
    });
    pane.querySelectorAll(".standins button").forEach((b) => (b.onclick = () => { const s = JSON.parse(JSON.stringify(STANDINS[+b.dataset.i])); addItem(Object.assign(s, { source: "stand-in", autoName: true })); }));
    pane.querySelectorAll(".pals button").forEach((b) => (b.onclick = () => { const [n, cs] = PALETTES[+b.dataset.p]; addItem({ kind: "palette", type: "palette", label: n, colors: cs.slice(), source: "palette", name: `${n} palette` }); }));
    $("ctxImport").onclick = () => $("ctxFile").click();
    $("ctxFile").onchange = (e) => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ""; };
    $("ctxTemplate").onclick = template;
    $("ctxOn").onchange = () => { ctx().on = $("ctxOn").checked; changed(true); };
    $("ctxStrength").querySelectorAll("button").forEach((b) => (b.onclick = () => { ctx().strength = b.dataset.s; changed(true); }));
    $("ctxRebuild").onclick = () => { if (state.anchors[0]) { A.build(); window.CB_PANE && window.CB_PANE("capsule"); } };
    $("ctxClear").onclick = () => { const b = $("ctxClear"); if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = "Click again to clear"; setTimeout(() => { b.dataset.arm = ""; b.textContent = "Clear the store"; }, 3500); return; } ctx().items = []; b.dataset.arm = ""; b.textContent = "Clear the store"; changed(true); };
    draw();
  }
  A.hooks.context.push(draw);
  A.hooks.line.push(() => draw());
  A.hooks.board.push(() => { const a = document.querySelector("#board .ctxstrip [data-pane]"); if (a) a.onclick = () => window.CB_PANE && window.CB_PANE("store"); drawImpact(); });
  window.CB_CONTEXT = { mount, draw, addItem, STANDINS, PALETTES, SW, CNAME, cword, silhouette, family, colorsFrom, kindFrom, paletteOf };
})();
