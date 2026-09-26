/* Budget guide shown in the app ("what do buyers spend?"). Research compiled Sep 2026.
   Edit freely; the presets themselves live in config.js (lines.RF.budgetPresets / lines.OIYK.budgetPresets). */
window.BUDGET_GUIDE = {
  summary: [
    "Faire tells brands to set first-order minimums at $100–150 and keep them low. Reorders on Faire run about 37% larger than first orders.",
    "Jewelry brands' own published opening minimums cluster at $250–$500, with premium handmade lines at $1,000. Reorder minimums sit lower ($150–$500).",
    "Boutiques put roughly 5–15% of an opening budget into jewelry and buy 1–2 packs per style. Keystone to 2.5x markup is the norm.",
    "Not found in public sources: an average opening-order size for jewelry at trade shows (MAGIC, Atlanta, NY NOW), and Faire's average order value. Treat the presets as a starting ladder and replace them with your own order history as it builds.",
  ],
  rows: [
    ["$100–$150", "Faire's recommended first-order minimum for brands", "Faire blog, Mar 2024", "https://www.faire.com/blog/selling/how-to-launch-a-successful-faire-shop/"],
    ["+37%", "Faire reorders vs. first orders (average size)", "Faire blog, Mar 2024", "https://www.faire.com/blog/selling/how-to-launch-a-successful-faire-shop/"],
    ["$150–$250 / $300", "Faire Insider free-shipping thresholds per brand order", "Faire Help Center", "https://www.faire.com/support/articles/4406840862747"],
    ["$100 ok, $250 'too high'", "Retailer view of brand minimums on Faire", "Craft Industry Alliance, Jul 2024", "https://craftindustryalliance.org/what-craft-businesses-need-to-know-about-faire/"],
    ["$250 open / $150 reorder", "Jewelry brand terms (SRP = 2.5x wholesale)", "Beth Jewelry", "https://beth-jewelry.com/pages/wholesale-policies"],
    ["$300 open / $200 reorder", "Jewelry brand terms", "Zil Jewelry", "https://ziljewelry.com/pages/wholesale-terms-conditions"],
    ["$500 open", "Jewelry brand terms", "Alexa Martha Designs", "https://alexamarthadesigns.com/pages/wholesale-terms-and-conditions"],
    ["$1,000 open / $500 reorder", "Premium handmade jewelry terms", "Abacus Row", "https://abacusrow.com/pages/terms-and-conditions-wholesale"],
    ["Jewelry ~15% of opening budget; 1–2 packs per style", "Boutique opening-inventory guide", "The Boutique Hub, Mar 2025", "https://theboutiquehub.com/blog/how-much-inventory-do-you-need-to-start-a-boutique/"],
    ["Accessories 5–10%; $500–$2,000 total opening orders", "Boutique opening-inventory guide (all categories)", "Wholesale Fashion Trends, Jun 2026", "https://wholesalefashiontrends.com/blogs/news/beginner-boutique-inventory-list-what-to-buy-first-for-a-profitable-launch"],
    ["2x–2.5x", "Retail markup on wholesale", "Faire, Aug 2024", "https://www.faire.com/blog/for-retailers/how-to-start-a-boutique"],
    ["2.2x–2.5x", "Markup for fashion / stone-set jewelry", "Eightx, Jun 2026", "https://eightx.co/blog/jewelry-brand-pricing-strategy"],
  ],
  ladders: {
    RF: "Retro Forever at ~$5.70 wholesale, by the dozen (up to 3 styles at a half dozen on a first order): $100 ≈ 3 styles, mostly half dozens · $200 ≈ 3–4 · $300 ≈ 5 · $500 ≈ 8 · $1,000 ≈ 15 styles.",
    OIYK: "OIYK is priced by quantity per style: the dozen price at 12+, and higher set prices at 6 and at 3 (the manufacturer prices it that way). At first-order units (a dozen per style; 3 or 6 on the baroque pearl and scarf-wrapped set styles): $500 ≈ 3–4 styles · $1,500 ≈ 7–9 · $3,000 ≈ 10–13. A higher-priced anchor can use most of a small budget on its own (a dozen of the Beaded Heart Locket is $519), so start those at $1,500.",
  },
};
