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

  /* ---------- v1.7.0: store size pre-fills the budget ---------- */
  // Opening order ~ 38% of one month's jewelry sales (markup 2.5x, 2.5 turns a year, our share of the jewelry wall 20%).
  // Budgets sit inside the research ranges ($250-$380, $380-$960, $960-$1,900, $1,900+) and never go below the line's
  // first-order minimum. The customers-a-day column is an assumption to tune after 20-30 orders.
  storeSizes: {
    pctOfMonthly: 0.38,
    sizes: [
      { id: "S", label: "Small", sales: "under $1,000 a month in jewelry", traffic: "under 30 customers a day", budget: 300 },
      { id: "M", label: "Medium", sales: "$1,000-$2,500 a month", traffic: "30-80 a day", budget: 650 },
      { id: "L", label: "Large", sales: "$2,500-$5,000 a month", traffic: "80-150 a day", budget: 1400 },
      { id: "XL", label: "Very large", sales: "over $5,000 a month", traffic: "over 150 a day", budget: 2000, note: "split it across deliveries" },
    ],
  },

  /* ---------- v1.7.0: her store (context) ---------- */
  // Other brands' pieces and her own apparel never enter a capsule or an order; they only nudge our picks.
  // A piece that suits her store perfectly gains up to max/2 x strength points, a poor fit loses up to max/2 x strength.
  // Strength (v1.7.2): Light 0.5 (her store breaks ties: about 1 in 6 picks change), Medium 1.5 (about 1 in 3),
  // Strong 4 (her store leads: about half change). The buyer's pick, stock, minimums and variety rules always hold.
  contextPull: { max: 12 },

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

  /* ---------- sending a capsule (v1.6.0) ---------- */
  // "View your capsule" page: an unlisted, noindexed Shopify page that shows the web copy's view.html full-screen and
  // passes the link through. The capsule travels inside the link (line, SKUs, pieces, store, rep code, capsule ID);
  // nothing is stored anywhere. Visits show in Shopify analytics with the full link, so opens can be counted by capsule ID.
  capsulePage: { url: "https://onlyifyouknow.com/pages/capsule" },
  builderPage: { url: "https://onlyifyouknow.com/pages/capsule-builder" },   // v1.7.0: guided-mode links
  programPage: { url: "https://onlyifyouknow.com/pages/wholesale" },        // v1.7.0: "Rep this line" in the recruiting demo
  // Rep codes (letters, numbers, dashes; up to 20). Any code a rep types is carried on the order link, QR code, capsule
  // page, Excel and exports, and the order pages add it to the submitted order. List the codes you've issued here to get a
  // warning when a rep mistypes theirs (leave empty to accept any code).
  repCodes: [],

  /* ---------- line sheet ---------- */
  lineSheet: {
    contactLine: "For inquiries 917-830-7220",
    // Accent per line (v1.6.2, Dan 26 Sep 2026): Retro Forever = the logo red, Only If You Know = light lavender.
    accent: { RF: "#D0402E", OIYK: "#B8A9D9" },
    accentSoft: { RF: "#FCEFEC", OIYK: "#EFEAF8" },   // Excel header fill
    markBuyerPick: true,          // small "Your pick" tag on the anchor(s), shown above the photo (v1.7.8)
    // v1.7.8 (Dan, 28 Sep 2026): Auto layout goes to more pages rather than shrinking photos. Up to this many styles
    // per page (split evenly: 22 styles = 2 pages of 11); 15 keeps photos about 1.3 in. wide. Try 20 for denser pages.
    autoPerPage: 15,
    // Defaults for the line sheet composer (each can be changed in the Line sheet dialog)
    defaults: {
      layout: "auto",             // "auto" = photos as large as fit, up to autoPerPage styles a page (one page for most capsules); or "2x2", "3x2", "3x3", "4x3", "4x4" per page
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
      logo: "logo_rf.png?h=88500682",
      sheetTagline: "Curated capsule",           // small line under the logo on the line sheet
      minQty: 6,
      terms: {
        firstOrderUnits: 12,     // sold by the dozen (Dan, 26 Sep 2026): dozens move better and keep packs closed
        // A first order may include a few styles at a half dozen: styles with under stockBelow pieces in stock (they can't
        // be sold by the dozen) and styles the rep switches on the card; at most maxStyles per first order (Dan, 26 Sep 2026).
        // Budget builds spend in dozens and only use a half dozen when a category would otherwise be empty.
        halfDozen: { units: 6, maxStyles: 3, stockBelow: 12 },
        reorderUnits: 12,        // one dozen per style on reorder (the "Reorder" order type)
        orderMinimum: 100,       // $100 order minimum
        tiered: false,           // same price per piece at 6 or 12 (adopted terms, 23 Sep 2026)
        // Commercial terms as published on the RF line sheet (FW26) and the RF wholesale order page
        // (danbginsberg-netizen.github.io/RetroForeverWSorder). Printed in the line sheet terms block
        // and at the top of the Excel order form. Leave any of them "" to hide that line.
        paymentTerms: "Credit card, ACH, check or wire transfer (credit cards add 3%; wires add $20).",
        shipping: "In stock at our U.S. warehouse. Ships via UPS / FedEx, prepaid & add or on your carrier account. Fast reorders from inventory on hand.",
        returns: "",
        retailNote: "Suggested retail 3.2–3.5x wholesale.",
        unitsNote: "Sold by the dozen. First orders may include a limited number of ½-dozen styles. Same price per piece either way.",
      },
      // Wholesale order page (on onlyifyouknow.com; the Shopify page shows the GitHub Pages form full-screen and passes
      // ?cart= through to it): capsules only use styles listed there (app/orderpage_rf.js, from
      // tools/sync_order_page.py), and "Order page (pre-filled)" / the line sheet's QR code open it
      // with the capsule's styles and quantities filled in.
      orderPage: { url: "https://onlyifyouknow.com/pages/retro-forever-wholesale-orders", onlyListed: true, qtyIn: "dozens" },
      contactEmail: "dan@retroforeverllc.com",   // v1.7.0: kiosk "Request this capsule" and the buyer packet (as published on the RF order page)
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
      logo: "logo_oiyk.png?h=64cbd40d",
      sheetTagline: "Color, memory, light",
      minQty: 0,                 // made to order: no stock rule
      mix: { necklace: 0.50, bracelet: 0.17, earring: 0.33 },   // OIYK has 5 bracelets today
      budgetMaxStyleShare: 0.4,  // budget mode: no single added style over 40% of the budget (dozen minimums)
      terms: {
        firstOrderUnits: 12,     // a dozen per style on a first order: the factory won't make fewer to order ...
        // ... except these styles, which the factory makes in smaller sets (the 3-pk / 6-pk styles on the OIYK
        // wholesale order page; Dan, 26 Sep 2026). Minimum pieces per style on a first order:
        firstOrderExceptions: {
          OYN0010GDPRL: 3, OYN0011GDPRL: 3, OYN0012GDPRL: 3, OYN0026GDPRL: 3,          // baroque pearl necklaces
          OYN0015GDSGPRL: 3, OYN0015GDMSTPRL: 3, OYN0015GDBLKPRL: 3, OYN0015GDBLPRL: 3, OYN0015GDBEGPRL: 3,
          OYN0015GDGRNPRL: 3, OYN0015GDLORPRL: 3, OYN0015GDORPRL: 3, OYN0015GDREDPRL: 3, OYN0015GDTLPRL: 3,  // scarf-wrapped pearl
          OYE0002GDPRL: 6, OYE0006GDPRL: 6, OYE0012GDPRL: 6,                               // baroque pearl drop earrings
        },
        reorderUnits: 12,        // every style, once the buyer has ordered before
        orderMinimum: 500,       // $500 minimum on a first order (Dan, 26 Sep 2026); Retro Forever stays $100
        tiered: true,            // OIYK prices by units per style, from the Product Master's columns:
                                 //   12+ = WS Dozen Price / 12 (same as WS 1-pcs Price), 6-11 = 6-pcs Price / 6,
                                 //   3-5 = 3-pcs Price / 3. Breaking a dozen costs more because the
                                 //   manufacturer prices it that way (higher-priced materials).
        // Commercial terms as published on the OIYK wholesale order page (onlyifyouknow.com/pages/order-page).
        // The page's dated "Shipping end of September 2026" line is left out so sheets don't go stale.
        // OIYK is made to order; reorders ship from U.S. warehouse stock (Dan, 25 Sep 2026).
        paymentTerms: "Net 30 from date of shipping. Early pay: 3% in 10 days, 2% in 15, 1% in 20. Credit card, ACH, check or wire transfer (credit cards add 3%; wires add $20).",
        shipping: "Made to order: 45- to 60-day lead times on most styles, depending on the season. Reorders ship from our U.S. warehouse in about 10 business days. Ships via UPS / FedEx, prepaid & add or on your carrier account. First orders prepay shipping or use your carrier account.",
        returns: "RA required within 14 days. Damage claims: notify us within 7 days of receipt.",
        retailNote: "",
        unitsNote: "A dozen per style. First orders: 3 on baroque pearl and scarf-wrapped necklaces, 6 on baroque pearl drop earrings. Reorders: a dozen per style.",
        tierNote: "Dozen pricing per piece; the 3- and 6-piece set prices apply to the baroque pearl and scarf-wrapped styles.",
      },
      // OIYK wholesale order page: same idea as RF. The link carries pieces per style (?cart=SKU:6,...); the page's
      // prefill.js fills its Dz / 6-pk / 3-pk / Pc boxes from that (app/orderpage_oiyk.js, from tools/sync_order_page.py oiyk).
      orderPage: { url: "https://onlyifyouknow.com/pages/oiyk-wholesale-orders", onlyListed: true, qtyIn: "pieces" },
      contactEmail: "dan@onlyifyouknow.com",
      budgetPresets: [
        // $500 is the minimum opening order (Dan, 26 Sep 2026). At a dozen per style it buys about 4 styles, with a
        // necklace, earrings and a bracelet for 77 of 114 picks; for 21 high-priced picks it covers the pick alone.
        { amount: 500, label: "$500", note: "Minimum opening order" },
        { amount: 1500, label: "$1,500", note: "Standard opening order" },
        { amount: 3000, label: "$3,000", note: "Collection / window" },
      ],
    },
  },
};
