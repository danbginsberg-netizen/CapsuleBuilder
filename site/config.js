/* =====================================================================
   CAPSULE BUILDER — TUNING FILE
   Edit numbers and tables here; no other code needs to change.
   Save the file, then reload the app in the browser.
   ===================================================================== */
window.CAPSULE_CONFIG = {

  /* ---------- capsule shape ---------- */
  defaultSize: 12,          // pieces including the anchor(s)
  minSize: 6,
  maxSize: 24,
  mix: { necklace: 0.50, bracelet: 0.25, earring: 0.25 },   // leftovers round toward necklaces

  /* ---------- hard filters ---------- */
  minQty: 6,                // in stock = at least this many units (one case pack). 0 = any stock.
                            // Per-SKU override: "available" column in the reviewed tag CSV (yes / no)

  /* ---------- component weights (points, total 100) ---------- */
  weights: {
    color: 35,
    style: 20,
    motif: 15,
    materials: 12,
    scale: 10,
    metal: 8,
  },

  /* ---------- house rule: lead with color, not gold ---------- */
  goldLedColors: ["gold", "silver"],                                 // dominant color that makes a piece "gold-led"
  neutralLedColors: ["neutral", "ivory/pearl", "white", "grey", "crystal/clear"],
  goldLedPenalty: 8,        // points taken off a gold-led candidate (waived if the anchor is gold-led)
  neutralLedPenalty: 5,     // points off a neutral-led candidate (waived if the anchor is gold- or neutral-led)

  /* ---------- diversity ---------- */
  maxPerBaseStyle: 1,               // same style number in another colorway = near-duplicate
  colorwayStoryExtra: 2,            // "Colorway story" on: add the buyer's pick in this many other colorways (different color families)
  colorwayStoryMaxPerBaseStyle: 2,  // ...and every other style may then appear in up to 2 colorways
  allowAnchorColorways: false,      // default: the anchor's own other colorways are excluded
  maxPerStyleSubtype: 2,            // "no more than 2 from the same style family variant"
  maxSameSubtypeShare: 0.5,         // e.g. at most 3 of 6 necklaces can be pendants
  maxSameMaterialShare: 0.5,        // e.g. at most 3 of 6 necklaces (anchors included) can be pearl-led
  maxSameLookShare: 0.3,            // same lead color AND main material (e.g. ivory pearl): at most ~30% of a category's
                                    // recommendations — 2 of 7 necklaces, 1 of 3 earrings (buyer's picks not counted)
  // Similar AND complementary: when picking, each piece already in the capsule that shares the candidate's lead color,
  // main material, style family or (same category) subtype takes these points off the candidate's match score.
  // Higher = more variety; 0 = pure best-match. The buyer's picks count at anchorFactor.
  diversityWeights: { color: 2, material: 4, style: 2, subtype: 2, anchorFactor: 0.5 },
  materialFamilies: { "mother-of-pearl": "pearl", shell: "pearl", "seed bead": "bead", "glass bead": "bead" },

  /* ---------- two anchors ---------- */
  twoAnchorBlend: { low: 0.6, high: 0.4 },   // score = 0.6 x weaker match + 0.4 x stronger match

  /* ---------- color harmony ---------- */
  // weight of the 1st / 2nd / 3rd color family of a piece
  colorRankWeights: [1.0, 0.8, 0.65],
  multicolorRankWeights: [0.9, 0.85, 0.8],
  metalAsColorScore: 0.35,          // how well a gold/silver-led piece "matches" a colored anchor
  neutralBaseColors: ["ivory/pearl", "neutral", "white", "black", "grey"],
  neutralPairDefault: 0.5,          // a neutral with any color not listed below (e.g. ivory with orange)
  secondSharedColorBonus: 0.10,     // extra when two or more families are shared
  // pairs that work together (symmetric, 0-1). Same color = 1.0 automatically.
  colorPairs: [
    ["turquoise", "coral/red", 0.80], ["turquoise", "ivory/pearl", 0.75], ["turquoise", "neutral", 0.70],
    ["turquoise", "seafoam/mint", 0.75], ["turquoise", "aqua", 0.80], ["turquoise", "cobalt/navy", 0.70],
    ["turquoise", "white", 0.70], ["turquoise", "orange", 0.65], ["turquoise", "yellow", 0.60],
    ["turquoise", "hot pink", 0.60], ["turquoise", "blue", 0.70],
    ["cobalt/navy", "ivory/pearl", 0.75], ["cobalt/navy", "white", 0.80], ["cobalt/navy", "blue", 0.80],
    ["cobalt/navy", "aqua", 0.70], ["cobalt/navy", "coral/red", 0.60], ["cobalt/navy", "yellow", 0.60],
    ["blue", "white", 0.75], ["blue", "aqua", 0.80], ["blue", "ivory/pearl", 0.70], ["blue", "grey", 0.65],
    ["blue", "seafoam/mint", 0.65],
    ["blush pink", "ivory/pearl", 0.80], ["blush pink", "white", 0.75], ["blush pink", "hot pink", 0.70],
    ["blush pink", "lavender/purple", 0.70], ["blush pink", "seafoam/mint", 0.65], ["blush pink", "grey", 0.60],
    ["blush pink", "coral/red", 0.65], ["blush pink", "neutral", 0.60],
    ["hot pink", "orange", 0.70], ["hot pink", "coral/red", 0.60], ["hot pink", "yellow", 0.60],
    ["hot pink", "white", 0.60], ["hot pink", "lavender/purple", 0.55],
    ["lavender/purple", "seafoam/mint", 0.75], ["lavender/purple", "grey", 0.65], ["lavender/purple", "white", 0.65],
    ["lavender/purple", "ivory/pearl", 0.65], ["lavender/purple", "aqua", 0.60],
    ["emerald/green", "ivory/pearl", 0.70], ["emerald/green", "seafoam/mint", 0.75], ["emerald/green", "neutral", 0.65],
    ["emerald/green", "white", 0.65], ["emerald/green", "black", 0.60], ["emerald/green", "coral/red", 0.55],
    ["black", "white", 0.80], ["black", "ivory/pearl", 0.75], ["black", "grey", 0.65], ["black", "neutral", 0.60],
    ["black", "coral/red", 0.55], ["black", "crystal/clear", 0.60],
    ["neutral", "ivory/pearl", 0.75], ["neutral", "orange", 0.70], ["neutral", "white", 0.65], ["neutral", "grey", 0.60],
    ["neutral", "coral/red", 0.55],
    ["grey", "white", 0.70], ["grey", "crystal/clear", 0.65], ["grey", "ivory/pearl", 0.60],
    ["orange", "yellow", 0.70], ["orange", "coral/red", 0.70],
    ["coral/red", "white", 0.60], ["coral/red", "ivory/pearl", 0.65],
    ["aqua", "white", 0.75], ["aqua", "seafoam/mint", 0.75], ["aqua", "ivory/pearl", 0.70],
    ["seafoam/mint", "white", 0.70], ["seafoam/mint", "ivory/pearl", 0.70],
    ["yellow", "white", 0.60], ["yellow", "emerald/green", 0.55],
    ["crystal/clear", "ivory/pearl", 0.70], ["crystal/clear", "white", 0.70],
    ["gold", "silver", 0.50],
  ],

  /* ---------- style family neighbors (symmetric, 0-1); same family = 1.0 ---------- */
  stylePairs: [
    ["boho", "coastal", 0.60], ["boho", "playful", 0.40], ["boho", "retro/vintage", 0.40],
    ["classic pearl", "glam", 0.50], ["classic pearl", "coastal", 0.50], ["classic pearl", "minimal", 0.50],
    ["playful", "retro/vintage", 0.50], ["glam", "minimal", 0.40], ["glam", "statement", 0.50],
    ["statement", "retro/vintage", 0.40], ["coastal", "playful", 0.40],
  ],
  styleMinimalDefault: 0.30,   // minimal pieces support any style a little

  /* ---------- motif relations (symmetric, 0-1); same motif = 1.0 ---------- */
  motifPairs: [
    ["heart", "bow", 0.5], ["floral/botanical", "butterfly", 0.5], ["ocean/shell", "celestial", 0.5],
    ["coin/medallion", "celestial", 0.5], ["cross/faith", "heart", 0.4], ["evil eye", "celestial", 0.3],
    ["coin/medallion", "cross/faith", 0.3], ["letter", "heart", 0.3],
  ],
  motifAnchorNoneScore: 0.5,     // anchor has no motif: every candidate gets this (neutral)
  motifCandidateNoneScore: 0.25, // anchor has a motif, candidate is plain

  /* ---------- material compatibility groups ---------- */
  materialGroups: [
    ["pearl", "mother-of-pearl", "shell"],
    ["seed bead", "glass bead", "ceramic/clay"],
    ["gemstone", "glass bead"],
    ["crystal/CZ", "metal"],
    ["enamel", "resin/epoxy", "acrylic"],
    ["cord/thread", "seed bead"],
  ],
  materialGroupScore: 0.6,
  metalOnlyMaterialScore: 0.3,

  /* ---------- scale balance: anchor scale -> candidate scale ---------- */
  scaleBalance: {
    statement: { delicate: 1.0, medium: 0.9, statement: 0.3 },
    medium:    { delicate: 0.8, medium: 1.0, statement: 0.6 },
    delicate:  { delicate: 1.0, medium: 0.8, statement: 0.4 },
  },

  /* ---------- metal tone ---------- */
  metalMatch: { same: 1.0, mixed: 0.8, none: 0.6, clash: 0.1 },

  /* ---------- line sheet ---------- */
  lineSheet: {
    contactLine: "For inquiries 917-830-7220",
    accent: "#B8A9D9",            // light lavender, accent only
    markBuyerPick: true,          // small "Your pick" tag on the anchor(s)
    // Defaults for the line sheet composer (each can be changed in the Line sheet dialog)
    defaults: {
      layout: "auto",             // "auto" = one page, photos as large as fit; or "2x2", "3x2", "3x3", "4x3", "4x4" per page
      paper: "letter",            // "letter" | "a4"
      orientation: "portrait",    // "portrait" | "landscape"
      cover: false,               // cover page: logo, capsule name, prepared for <buyer>, note, contact
      sections: false,            // group by category with a header; each category starts a new page (paged layouts)
      fields: { sku: true, name: true, wholesale: false, tiers: true, msrp: false, units: false },
      terms: false,               // terms block: order minimum, units per style, price breaks (+ payment / ship text below)
      orderForm: false,           // order-form page: SKU, name, price, suggested units, blank qty / total columns
      pageNumbers: true,          // "Page x of y" on multi-page sheets
    },
  },

  /* ---------- budget mode ---------- */
  budgetTolerance: 0.10,     // budget mode may go up to 10% over only when needed to reach the order minimum
  budgetMinScore: 45,        // budget mode stops adding to a category when the best affordable piece scores below this
  budgetCoverageMinScore: 38, // lower bar for the first piece in an empty category, so small budgets still get a mix

  /* ---------- lookbook pairing (used when a line has collection / sister-piece tags, i.e. OIYK) ---------- */
  sisterBonus: 12,           // points added when a piece is the anchor's lookbook "sister piece"
  sameCollectionBonus: 5,    // points added for the same lookbook feature collection

  /* ---------- per-line settings (override anything above for that line) ---------- */
  lines: {
    RF: {
      name: "Retro Forever",
      logo: "logo_rf.png",
      sheetTagline: "Curated capsule",           // small line under the logo on the line sheet
      minQty: 6,
      terms: {
        firstOrderUnits: 6,      // 6 pieces per style on an account's first order
        reorderUnits: 12,        // one dozen per style on reorder
        orderMinimum: 100,       // $100 order minimum
        tiered: false,           // same price per piece at 6 or 12 (adopted terms, 23 Sep 2026)
        // Commercial terms as published on the RF line sheet (FW26) and the RF wholesale order page
        // (danbginsberg-netizen.github.io/RetroForeverWSorder). Printed in the line sheet terms block
        // and at the top of the Excel order form. Leave any of them "" to hide that line.
        paymentTerms: "Credit card, ACH, check or wire transfer (credit cards add 3%; wires add $20).",
        shipping: "In stock at our U.S. warehouse. Ships via UPS / FedEx, prepaid & add or on your carrier account. Fast reorders from inventory on hand.",
        returns: "",
        retailNote: "Suggested retail 3.2–3.5x wholesale.",
        unitsNote: "6 pieces per style on a first order, a dozen on reorder — same price per piece either way.",
      },
      // Wholesale order page: capsules only use styles listed there (app/orderpage_rf.js, from
      // tools/sync_order_page.py), and "Order page (pre-filled)" / the line sheet's QR code open it
      // with the capsule's styles and quantities filled in.
      orderPage: { url: "https://danbginsberg-netizen.github.io/RetroForeverWSorder/", onlyListed: true, qtyIn: "dozens" },
      // Budget presets for the budget-down builder (see README "Budget guide" for sources)
      budgetPresets: [
        { amount: 100, label: "$100", note: "Order minimum / test order" },
        { amount: 200, label: "$200", note: "Starter" },
        { amount: 300, label: "$300", note: "Standard opening order" },
        { amount: 500, label: "$500", note: "Display / wall" },
        { amount: 1000, label: "$1,000", note: "Large / multi-door" },
      ],
    },
    OIYK: {
      name: "Only If You Know",
      logo: "logo_oiyk.png",
      sheetTagline: "Color, memory, light",
      minQty: 0,                 // made to order: no stock rule
      mix: { necklace: 0.50, bracelet: 0.17, earring: 0.33 },   // OIYK has 5 bracelets today
      terms: {
        firstOrderUnits: 6,      // 6 per style on a first order ...
        reorderUnits: 12,
        orderMinimum: 100,
        tiered: true,            // OIYK prices by units per style, from the Product Master's columns:
                                 //   12+ = WS Dozen Price / 12 (same as WS 1-pcs Price), 6-11 = 6-pcs Price / 6,
                                 //   3-5 = 3-pcs Price / 3. Breaking a dozen costs more because the
                                 //   manufacturer prices it that way (higher-priced materials).
        // ... except baroque pearl and scarf-wrapped styles: 3 pieces (set per SKU as "Min units" in the catalog)
        // Commercial terms as published on the OIYK wholesale order page (onlyifyouknow.com/pages/order-page).
        // The page's dated "Shipping end of September 2026" line is left out so sheets don't go stale.
        // OIYK is made to order; reorders ship from U.S. warehouse stock (Dan, 25 Sep 2026).
        paymentTerms: "Net 30 from date of shipping. Early pay: 3% in 10 days, 2% in 15, 1% in 20. Credit card, ACH, check or wire transfer (credit cards add 3%; wires add $20).",
        shipping: "First orders are made to order; reorders ship from our U.S. warehouse. Ships via UPS / FedEx, prepaid & add or on your carrier account. First orders prepay shipping or use your carrier account.",
        returns: "RA required within 14 days. Damage claims: notify us within 7 days of receipt.",
        retailNote: "",
        unitsNote: "6 pieces per style on a first order (3 on baroque pearl and scarf-wrapped styles); reorders by the dozen.",
        tierNote: "Wholesale is priced per piece by quantity per style: dozen pricing at 12+, set prices at 6 and at 3.",
      },
      // OIYK wholesale order page: same idea as RF. The link carries pieces per style (?cart=SKU:6,...); the page's
      // prefill.js fills its Dz / 6-pk / 3-pk / Pc boxes from that (app/orderpage_oiyk.js, from tools/sync_order_page.py oiyk).
      orderPage: { url: "https://danbginsberg-netizen.github.io/OIYKwsorder/", onlyListed: true, qtyIn: "pieces" },
      budgetPresets: [
        { amount: 250, label: "$250", note: "Test order" },
        { amount: 500, label: "$500", note: "Starter" },
        { amount: 1000, label: "$1,000", note: "Standard opening order" },
        { amount: 2000, label: "$2,000", note: "Collection / window" },
      ],
    },
  },
};
