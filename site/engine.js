/* Capsule matching engine — rules-first, explainable.
   Works in the browser (window.CapsuleEngine) and in Node (module.exports). */
(function (root) {
  "use strict";

  const CATS = ["necklace", "bracelet", "earring"];
  const LABEL = {
    "coral/red": "coral", "cobalt/navy": "cobalt", "ivory/pearl": "ivory", "seafoam/mint": "seafoam",
    "emerald/green": "emerald", "lavender/purple": "lavender", "crystal/clear": "crystal", "blush pink": "blush",
    "hot pink": "hot pink", "seed bead": "seed-bead", "glass bead": "glass-bead", "crystal/CZ": "crystal",
    "resin/epoxy": "resin", "ceramic/clay": "clay-bead", "cord/thread": "cord", "ocean/shell": "ocean",
    "floral/botanical": "floral", "coin/medallion": "coin", "cross/faith": "faith", "animal print": "animal-print",
    "retro/vintage": "retro", "choker/collar": "choker",
  };
  const lab = (x) => LABEL[x] || x;
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  function pairMap(list) {
    const m = new Map();
    for (const [a, b, v] of list) { m.set(a + "|" + b, v); m.set(b + "|" + a, v); }
    return m;
  }

  function Engine(catalog, cfg) {
    this.cfg = cfg;
    this.items = catalog.items;
    this.bySku = new Map(this.items.map((i) => [i.sku, i]));
    this.colorP = pairMap(cfg.colorPairs);
    this.styleP = pairMap(cfg.stylePairs);
    this.motifP = pairMap(cfg.motifPairs);
    this.metals = new Set(["gold", "silver"]);
  }

  /* ------------------------------------------------ filters */
  Engine.prototype.inStock = function (it, minQty) {
    if (it.avail === "no") return false;
    if (it.avail === "yes" || it.mto) return true;   // made-to-order lines have no stock rule
    const q = minQty == null ? this.cfg.minQty : minQty;
    return q <= 0 ? it.qty > 0 : it.qty >= q;
  };

  /* ------------------------------------------------ components */
  Engine.prototype.colorList = function (it) {
    const w = it.multi ? this.cfg.multicolorRankWeights : this.cfg.colorRankWeights;
    let fams = it.fams.slice(0, 3);
    if (!this.metals.has(it.dom)) { const f = fams.filter((x) => !this.metals.has(x)); if (f.length) fams = f; }   // metal is not a color unless it leads
    return fams.map((f, i) => [f, w[i] || w[w.length - 1]]);
  };
  Engine.prototype.colorPair = function (a, b) {
    if (a === b) return 1;
    const v = this.colorP.get(a + "|" + b);
    if (v != null) return v;
    if (this.metals.has(a) !== this.metals.has(b)) return this.cfg.metalAsColorScore;
    // ivory, tan, white, black and grey go with most colors: a moderate default instead of zero
    const nb = this.cfg.neutralBaseColors || [];
    if (nb.includes(a) || nb.includes(b)) return this.cfg.neutralPairDefault || 0;
    return 0;
  };
  Engine.prototype.color = function (A, C) {
    let best = { s: 0 };
    for (const [a, wa] of this.colorList(A))
      for (const [c, wc] of this.colorList(C)) {
        const p = this.colorPair(a, c);
        const s = wa * wc * p;
        if (s > best.s) best = { s, a, c, p };
      }
    const shared = C.fams.filter((f) => A.fams.includes(f) && !this.metals.has(f));
    if (shared.length >= 2) best.s = Math.min(1, best.s + this.cfg.secondSharedColorBonus);
    best.shared = shared;
    return best;
  };
  Engine.prototype.style = function (A, C) {
    if (A.style === C.style) return { s: 1, kind: "same" };
    let v = this.styleP.get(A.style + "|" + C.style) || 0;
    if (A.style === "minimal" || C.style === "minimal") v = Math.max(v, this.cfg.styleMinimalDefault);
    return { s: v, kind: v ? "near" : "none" };
  };
  Engine.prototype.motif = function (A, C) {
    if (!A.motifs.length) return { s: this.cfg.motifAnchorNoneScore, kind: "anchor-none" };
    if (!C.motifs.length) return { s: this.cfg.motifCandidateNoneScore, kind: "cand-none" };
    let best = { s: 0, kind: "none" };
    for (const a of A.motifs) for (const c of C.motifs) {
      const v = a === c ? 1 : this.motifP.get(a + "|" + c) || 0;
      if (v > best.s) best = { s: v, a, c, kind: a === c ? "same" : "related" };
    }
    return best;
  };
  Engine.prototype.materials = function (A, C) {
    const strip = (m) => (m.length > 1 ? m.filter((x) => x !== "metal") : m);
    const am = strip(A.mats), cm = strip(C.mats);
    if (cm.length === 1 && cm[0] === "metal" && !(am.length === 1 && am[0] === "metal"))
      return { s: this.cfg.metalOnlyMaterialScore, kind: "metal" };
    let tot = 0, best = { v: 0 };
    for (const a of am) {
      let m = 0, hit = null;
      for (const c of cm) {
        let v = a === c ? 1 : 0;
        if (!v) for (const g of this.cfg.materialGroups) if (g.includes(a) && g.includes(c)) v = this.cfg.materialGroupScore;
        if (v > m) { m = v; hit = c; }
      }
      tot += m;
      if (m > best.v) best = { v: m, a, c: hit };
    }
    return { s: am.length ? tot / am.length : 0, a: best.a, c: best.c, kind: best.v === 1 ? "same" : best.v ? "group" : "none" };
  };
  Engine.prototype.scale = function (A, C) {
    return { s: (this.cfg.scaleBalance[A.scale] || {})[C.scale] ?? 0.7 };
  };
  Engine.prototype.metal = function (A, C) {
    const m = this.cfg.metalMatch;
    if (A.metal === C.metal) return { s: m.same, kind: "same" };
    if (A.metal === "mixed" || C.metal === "mixed") return { s: m.mixed, kind: "mixed" };
    if (A.metal === "none" || C.metal === "none") return { s: m.none, kind: "none" };
    return { s: m.clash, kind: "clash" };
  };
  Engine.prototype.penalty = function (A, C) {
    const g = this.cfg.goldLedColors, n = this.cfg.neutralLedColors;
    const aGold = g.includes(A.dom), aNeu = n.includes(A.dom);
    if (g.includes(C.dom) && !aGold) return { p: this.cfg.goldLedPenalty, kind: "gold-led" };
    if (n.includes(C.dom) && !aGold && !aNeu) return { p: this.cfg.neutralLedPenalty, kind: "neutral-led" };
    return { p: 0 };
  };

  /** Score one candidate against one anchor. */
  Engine.prototype.scorePair = function (A, C) {
    const W = this.cfg.weights;
    const comps = {
      color: this.color(A, C), style: this.style(A, C), motif: this.motif(A, C),
      materials: this.materials(A, C), scale: this.scale(A, C), metal: this.metal(A, C),
    };
    let total = 0;
    for (const k in comps) { comps[k].pts = W[k] * comps[k].s; total += comps[k].pts; }
    const pen = this.penalty(A, C);
    total -= pen.p;
    let bonus = { p: 0 };
    if ((A.sisters || []).includes(C.sku) || (C.sisters || []).includes(A.sku)) bonus = { p: this.cfg.sisterBonus || 0, kind: "sister" };
    else if (A.collection && A.collection === C.collection) bonus = { p: this.cfg.sameCollectionBonus || 0, kind: "collection", name: A.collection };
    total += bonus.p;
    return { total, comps, pen, bonus };
  };

  /** Score a candidate against 1 or 2 anchors. */
  Engine.prototype.score = function (anchors, C) {
    const per = anchors.map((A) => this.scorePair(A, C));
    let total = per[0].total;
    if (per.length > 1) {
      const lo = Math.min(per[0].total, per[1].total), hi = Math.max(per[0].total, per[1].total);
      total = this.cfg.twoAnchorBlend.low * lo + this.cfg.twoAnchorBlend.high * hi;
    }
    return { total, per };
  };

  /* ------------------------------------------------ reasons */
  const pick = (arr, key) => { let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return arr[h % arr.length]; };
  Engine.prototype.phrases = function (A, C, r, ref) {
    ref = ref || "the anchor";
    const refs = ref + "'s";
    const out = [];
    const c = r.comps;
    const k = C.sku + A.sku;
    if (r.bonus && r.bonus.kind === "sister") out.push({ pts: 99, t: `the lookbook's sister piece to ${ref}` });
    else if (r.bonus && r.bonus.kind === "collection") out.push({ pts: 24, t: `same ${r.bonus.name} collection` });
    // color
    const col = c.color;
    if (col.s >= 0.45) {
      let t;
      const shared = col.shared.filter((f) => f !== "gold" && f !== "silver");
      if (shared.length >= 2) t = `same ${lab(shared[0])} and ${lab(shared[1])} palette`;
      else if (col.p === 1 && C.multi && !A.multi) t = pick([`picks up ${refs} ${lab(col.a)}`, `carries ${refs} ${lab(col.a)} into a mix of colors`], k);
      else if (col.p === 1 && A.multi) t = pick([`pulls the ${lab(col.a)} out of ${ref}`, `picks up the ${lab(col.a)} in ${ref}`, `echoes the ${lab(col.a)} in ${ref}`], k);
      else if (col.p === 1) t = pick([`same ${lab(col.a)} palette`, `matches ${refs} ${lab(col.a)}`], k);
      else if (this.metals.has(col.c)) t = `${col.c}-led piece that lets ${refs} color lead`;
      else t = pick([`${lab(col.c)} plays off ${refs} ${lab(col.a)}`, `${lab(col.c)} and ${lab(col.a)} work together`], k);
      out.push({ pts: c.color.pts + 5, t });
    } else if (this.metals.has(C.dom) && this.metals.has(A.dom)) {
      out.push({ pts: c.color.pts, t: `same ${C.dom} story as ${ref}` });
    }
    if (c.style.kind === "same") out.push({ pts: c.style.pts, t: pick([`same ${lab(C.style)} feel`, `same ${lab(C.style)} mood`, `stays in the ${lab(C.style)} story`], k) });
    else if (c.style.s >= 0.5) out.push({ pts: c.style.pts, t: `${lab(C.style)} look that sits well next to ${lab(A.style)}` });
    if (c.motif.kind === "same") out.push({ pts: c.motif.pts + 2, t: `repeats the ${lab(c.motif.a)} motif` });
    else if (c.motif.kind === "related") out.push({ pts: c.motif.pts, t: `${lab(c.motif.c)} motif ties to ${refs} ${lab(c.motif.a)}` });
    if (c.materials.kind === "same" && c.materials.s >= 0.5) out.push({ pts: c.materials.pts, t: `same ${lab(c.materials.a)} texture` });
    else if (c.materials.kind === "group" && c.materials.s >= 0.5) out.push({ pts: c.materials.pts * 0.9, t: `${lab(c.materials.c)} echoes ${refs} ${lab(c.materials.a)}` });
    if (A.scale === "statement" && C.scale !== "statement") out.push({ pts: c.scale.pts * 0.8, t: `${C.scale} scale lets ${ref} lead` });
    else if (A.scale === "delicate" && C.scale === "delicate") out.push({ pts: c.scale.pts * 0.6, t: `same delicate scale for easy layering` });
    else if (C.scale === "statement" && A.scale !== "statement") out.push({ pts: c.scale.pts * 0.5, t: `adds a statement moment` });
    if (c.metal.kind === "same" && C.metal !== "gold") out.push({ pts: c.metal.pts * 0.5, t: `same ${C.metal} tone` });
    return out.sort((x, y) => y.pts - x.pts);
  };
  Engine.prototype.role = function (A, C) {
    const a = A.cat, c = C.cat;
    if (a === c) return a === "necklace" ? "layers with the anchor necklace" : a === "bracelet" ? "stacks with the anchor bracelet" : "a second earring option next to the anchor pair";
    const noun = a === "earring" ? "earrings" : a;
    return `works as the ${c} to the anchor ${noun}`;
  };
  Engine.prototype.reason = function (anchors, C, sc) {
    if (anchors.length === 1) {
      const ph = this.phrases(anchors[0], C, sc.per[0]).slice(0, 2).map((p) => p.t);
      if (!ph.length) ph.push("rounds out the capsule");
      return cap(ph.join(", ")) + ", " + this.role(anchors[0], C) + ".";
    }
    const p1 = this.phrases(anchors[0], C, sc.per[0], "pick 1")[0];
    const p2 = this.phrases(anchors[1], C, sc.per[1], "pick 2").find((p) => !p1 || p.t.replace("2", "1") !== p1.t);
    const parts = [];
    const tag = (t, ref) => (t.includes(ref) ? t : t + (t.startsWith("same") ? ` as ${ref}` : ` with ${ref}`));
    if (p1) parts.push(tag(p1.t, "pick 1"));
    if (p2) parts.push(tag(p2.t, "pick 2"));
    if (!parts.length) parts.push("rounds out the capsule");
    return cap(parts.join(", ")) + ", goes with both picks.";
  };

  /* ------------------------------------------------ capsule assembly */
  Engine.prototype.mixCounts = function (size, mix, anchors) {
    const t = mix.necklace + mix.bracelet + mix.earring || 1;
    const n = { necklace: Math.floor((size * mix.necklace) / t), bracelet: Math.floor((size * mix.bracelet) / t), earring: Math.floor((size * mix.earring) / t) };
    n.necklace += size - (n.necklace + n.bracelet + n.earring);   // leftovers -> necklaces
    for (const c of CATS) {                                         // anchors count toward their own category
      const need = anchors.filter((x) => x.cat === c).length;
      while (n[c] < need) {
        const donor = CATS.filter((d) => d !== c).sort((x, y) => n[y] - n[x])[0];
        if (n[donor] <= anchors.filter((x) => x.cat === donor).length) break;
        n[donor]--; n[c]++;
      }
    }
    return n;
  };

  // on lines with a wholesale order page, only styles listed on that page are picked (the buyer's own picks are exempt)
  Engine.prototype.orderable = function (it) {
    const op = this.cfg.orderPage;
    if (!op || !op.onlyListed || !op.skus) return true;
    if (!this._opSet) this._opSet = new Set(op.skus);
    return this._opSet.has(String(it.sku).toUpperCase());
  };
  Engine.prototype.eligible = function (anchors, opts) {
    const line = anchors[0].line;
    const anchorSkus = new Set(anchors.map((a) => a.sku));
    const excl = new Set(opts.exclude || []);
    return this.items.filter((it) =>
      !anchorSkus.has(it.sku) && !excl.has(it.sku) && it.img && this.inStock(it, opts.minQty) && this.orderable(it) &&
      (!line || !it.line || it.line === line));
  };

  // main material family of a piece (first material that isn't plain metal or crystal accents); pearl, mother-of-pearl
  // and shell count as one family so a capsule doesn't fill up with pearl strands
  Engine.prototype.materialKey = function (it) {
    const fam = this.cfg.materialFamilies || {};
    const m = (it.mats || []).find((x) => x !== "metal" && x !== "crystal/CZ");
    return m ? fam[m] || m : null;
  };
  // How much a candidate repeats what's already in the capsule: shared lead color, main material, style family and
  // (same category) subtype. Picks count fully, the buyer's own picks at half weight (matching them is already rewarded).
  // Subtracted from the match score when choosing, so the capsule stays close to the anchor without piling up look-alikes.
  Engine.prototype.redundancy = function (C, picked, anchors) {
    const w = this.cfg.diversityWeights;
    if (!w) return 0;
    const mk = this.materialKey(C);
    let pen = 0;
    const one = (X, f) => {
      let p = 0;
      if (X.dom === C.dom) p += w.color || 0;
      if (mk && this.materialKey(X) === mk) p += w.material || 0;
      if (X.style === C.style) p += w.style || 0;
      if (X.cat === C.cat && X.sub === C.sub) p += w.subtype || 0;
      pen += p * f;
    };
    for (const X of picked) one(X, 1);
    for (const X of anchors || []) one(X, w.anchorFactor != null ? w.anchorFactor : 0.5);
    return pen;
  };
  // Colorway story: the buyer's pick shown in other colorways of the same style (e.g. three scarf colors), chosen for
  // color variety — best match first, then a different color family each time.
  Engine.prototype.storyColorways = function (anchors, pool, excludeSkus) {
    const k = this.cfg.colorwayStoryExtra != null ? this.cfg.colorwayStoryExtra : 2;
    const out = [];
    for (const A of anchors) {
      const seen = new Set([A.dom]);
      const sibs = pool.filter((e) => e.item.base === A.base && e.item.cat === A.cat && !excludeSkus.has(e.item.sku));
      for (const e of sibs) {                                  // pool is sorted best-first
        if (out.filter((x) => x.item.base === A.base).length >= k) break;
        if (seen.has(e.item.dom)) continue;
        seen.add(e.item.dom); out.push(e);
      }
    }
    return out;
  };
  Engine.prototype.canAdd = function (C, chosen, counts, opts, level) {
    const cfg = this.cfg;
    const story = !!opts.colorwayStory;
    const maxBase = story ? cfg.colorwayStoryMaxPerBaseStyle : cfg.maxPerBaseStyle;
    const anchorBases = new Set((opts.anchors || []).map((a) => a.base));
    if (anchorBases.has(C.base) && !story && !cfg.allowAnchorColorways) return false;
    if (chosen.filter((x) => x.base === C.base).length >= maxBase) return false;
    if (level < 2) {
      const ss = chosen.filter((x) => x.style === C.style && x.sub === C.sub).length;
      if (ss >= cfg.maxPerStyleSubtype) return false;
    }
    if (level < 2 && cfg.maxSameMaterialShare) {
      // variety of materials: within a category, at most this share of the slots (anchors included) share a main material
      const key = this.materialKey(C);
      if (key) {
        const lim = Math.max(1, Math.ceil(counts[C.cat] * cfg.maxSameMaterialShare));
        const same = chosen.filter((x) => x.cat === C.cat && this.materialKey(x) === key).length;
        if (same >= lim) return false;
      }
    }
    if (level < 2 && cfg.maxSameLookShare) {
      // same "look" = same lead color AND same main material (e.g. ivory pearl strands). Among the recommendations in a
      // category (the buyer's picks don't count: matching them is the point), only a few may share one look.
      const key = this.materialKey(C);
      if (key) {
        const anchorSkus = new Set((opts.anchors || []).map((a) => a.sku));
        const lim = Math.max(1, Math.round(counts[C.cat] * cfg.maxSameLookShare));
        const same = chosen.filter((x) => !anchorSkus.has(x.sku) && x.cat === C.cat && x.dom === C.dom && this.materialKey(x) === key).length;
        if (same >= lim) return false;
      }
    }
    if (level < 1) {
      const slots = counts[C.cat];
      const lim = Math.max(1, Math.ceil(slots * cfg.maxSameSubtypeShare));
      const sub = chosen.filter((x) => x.cat === C.cat && x.sub === C.sub).length;
      if (sub >= lim) return false;
    }
    return true;
  };

  /**
   * Build a capsule.
   * opts: {size, mix:{necklace,bracelet,earring} (shares or counts), colorwayStory, minQty, locked:[sku], exclude:[sku]}
   */
  Engine.prototype.build = function (anchorSkus, opts) {
    opts = Object.assign({ size: this.cfg.defaultSize, mix: this.cfg.mix }, opts || {});
    const anchors = anchorSkus.map((s) => this.bySku.get(s)).filter(Boolean);
    if (!anchors.length) throw new Error("anchor SKU not found");
    opts.anchors = anchors;
    const counts = opts.counts || this.mixCounts(opts.size, opts.mix, anchors);
    const pool = this.eligible(anchors, opts).map((C) => {
      const sc = this.score(anchors, C);
      return { item: C, score: sc.total, sc };
    }).sort((a, b) => b.score - a.score);
    const chosen = anchors.slice();
    const picks = [];
    const need = {};
    for (const c of CATS) need[c] = counts[c] - anchors.filter((a) => a.cat === c).length;
    // locked pieces first
    for (const sku of opts.locked || []) {
      const e = pool.find((p) => p.item.sku === sku);
      if (e && need[e.item.cat] > 0) { chosen.push(e.item); picks.push(e); need[e.item.cat]--; e.locked = true; }
    }
    // Colorway story: add the buyer's pick in other colorways first
    if (opts.colorwayStory)
      for (const e of this.storyColorways(anchors, pool, new Set(picks.map((p) => p.item.sku)))) {
        if (need[e.item.cat] <= 0 || picks.includes(e)) continue;
        chosen.push(e.item); picks.push(e); need[e.item.cat]--; e.story = true;
      }
    // greedy by match score minus redundancy with what's already chosen (similar AND complementary)
    for (let level = 0; level < 3; level++) {
      for (;;) {
        let best = null, bestV = -Infinity;
        const pickedItems = picks.map((p) => p.item);
        for (const e of pool) {
          const C = e.item;
          if (need[C.cat] <= 0 || picks.includes(e)) continue;
          if (e.score - (bestV + 0) < -60) break;   // pool is sorted: nothing further down can win
          const v = e.score - this.redundancy(C, pickedItems, anchors);
          if (v <= bestV) continue;
          if (!this.canAdd(C, chosen, counts, opts, level)) continue;
          best = e; bestV = v;
        }
        if (!best) break;
        chosen.push(best.item); picks.push(best); need[best.item.cat]--;
      }
      if (CATS.every((c) => need[c] <= 0)) break;
    }
    for (const e of picks) e.reason = e.story ? `Colorway story: the buyer's pick in ${lab(e.item.dom)}, so the style shows in more than one color.` : this.reason(anchors, e.item, e.sc);
    const short = {};
    for (const c of CATS) if (need[c] > 0) short[c] = need[c];
    return { anchors, counts, picks, short, pool, opts };
  };

  /** Next-best alternatives for one slot (same category, respects diversity vs the rest). */
  Engine.prototype.alternatives = function (capsule, sku, n) {
    n = n || 3;
    const out = capsule.picks.find((p) => p.item.sku === sku);
    if (!out) return [];
    const rest = capsule.anchors.concat(capsule.picks.filter((p) => p !== out).map((p) => p.item));
    const used = new Set(rest.map((x) => x.sku).concat([sku]));
    // ranked like the build: match score minus redundancy with the rest of the capsule, strictest rules first
    const others = capsule.picks.filter((p) => p !== out).map((p) => p.item);
    const alts = [];
    for (let level = 0; level < 3 && alts.length < n; level++) {
      const tier = [];
      for (const e of capsule.pool) {
        if (e.item.cat !== out.item.cat || used.has(e.item.sku) || alts.includes(e)) continue;
        if (!this.canAdd(e.item, rest, capsule.counts, capsule.opts, level)) continue;
        tier.push([e, e.score - this.redundancy(e.item, others, capsule.anchors)]);
      }
      tier.sort((a, b) => b[1] - a[1]);
      for (const [e] of tier) { if (alts.length >= n) break; alts.push(e); }
    }
    if (isFinite(n)) alts.forEach((e) => (e.reason = this.reason(capsule.anchors, e.item, e.sc)));   // long lists get reasons as they're shown
    return alts;
  };

  Engine.prototype.swap = function (capsule, outSku, inSku) {
    const i = capsule.picks.findIndex((p) => p.item.sku === outSku);
    const e = capsule.pool.find((p) => p.item.sku === inSku);
    if (i < 0 || !e) return capsule;
    e.reason = this.reason(capsule.anchors, e.item, e.sc);
    capsule.picks[i] = e;
    return capsule;
  };

  /* ------------------------------------------------ economics */
  // price per piece for a given units-per-style; tiered = use the line's 3 / 6 / 12-piece price columns
  Engine.prototype.priceEach = function (it, units) {
    const t = this.cfg.terms || {};
    if (t.tiered && it.tiers) {
      const k = units >= 12 ? "12" : units >= 6 ? "6" : "3";
      if (it.tiers[k] != null) return it.tiers[k];
    }
    return it.ws || 0;
  };
  // the price breaks that apply to a piece: [{units, each}] from smallest order up (one entry on flat lines)
  Engine.prototype.priceBreaks = function (it) {
    const t = this.cfg.terms || {};
    if (!(t.tiered && it.tiers)) return [{ units: this.firstUnits(it), each: it.ws || 0 }];
    const lo = this.firstUnits(it);
    return [3, 6, 12].filter((u) => u >= lo && it.tiers[String(u)] != null).map((u) => ({ units: u, each: it.tiers[String(u)] }));
  };
  Engine.prototype.firstUnits = function (it) {
    const t = this.cfg.terms || {};
    return Math.min(t.firstOrderUnits || 6, it.minUnits || t.firstOrderUnits || 6);
  };
  // units: a number (units per style) or "first" (each style at its first-order minimum)
  Engine.prototype.lineCost = function (it, units) {
    const u = units === "first" ? this.firstUnits(it) : units;
    return { units: u, each: this.priceEach(it, u), total: this.priceEach(it, u) * u, retail: (it.msrp || 0) * u };
  };
  Engine.prototype.economics = function (items, units) {
    const sum = (u) => items.reduce((a, it) => { const c = this.lineCost(it, u); a.total += c.total; a.units += c.units; a.retail += c.retail; return a; }, { total: 0, units: 0, retail: 0 });
    // per-piece price at the units in play (tiered lines cost more per piece below a dozen)
    const ws = items.map((i) => this.lineCost(i, units != null ? units : "first").each);
    return {
      styles: items.length,
      avgEach: ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : 0,
      minEach: Math.min(...ws), maxEach: Math.max(...ws),
      first: sum("first"), at6: sum(6), at12: sum(12), chosen: units != null ? sum(units) : null,
      orderMinimum: (this.cfg.terms || {}).orderMinimum || 0,
      tiered: !!(this.cfg.terms || {}).tiered,
    };
  };

  /**
   * Budget-down build: keep adding the best-matching piece that still fits the budget,
   * keeping the category mix close to target, until nothing else fits (or maxSize).
   * opts: {budget, units ("first" | 6 | 12 | n), mix, colorwayStory, minQty, locked, exclude, maxSize}
   */
  Engine.prototype.buildBudget = function (anchorSkus, opts) {
    const anchors = anchorSkus.map((s) => this.bySku.get(s)).filter(Boolean);
    if (!anchors.length) throw new Error("anchor SKU not found");
    opts = Object.assign({ mix: this.cfg.mix, units: "first", maxSize: this.cfg.maxSize }, opts || {});
    opts.anchors = anchors;
    const mix = opts.mix, tot = mix.necklace + mix.bracelet + mix.earring || 1;
    const share = { necklace: mix.necklace / tot, bracelet: mix.bracelet / tot, earring: mix.earring / tot };
    const cost = (it) => this.lineCost(it, opts.units).total;
    let spent = anchors.reduce((a, it) => a + cost(it), 0);
    const pool = this.eligible(anchors, opts).map((C) => { const sc = this.score(anchors, C); return { item: C, score: sc.total, sc }; })
      .sort((a, b) => b.score - a.score);
    // provisional counts for the subtype-share rule, sized from the budget
    const avg = pool.length ? pool.slice(0, 40).reduce((a, e) => a + cost(e.item), 0) / Math.min(40, pool.length) : 1;
    const estN = Math.max(anchors.length, Math.min(opts.maxSize, Math.round(opts.budget / Math.max(avg, 1))));
    const counts = this.mixCounts(Math.max(estN, 3), mix, anchors);
    const chosen = anchors.slice(), picks = [];
    const n = { necklace: 0, bracelet: 0, earring: 0 };
    anchors.forEach((a) => n[a.cat]++);
    for (const sku of opts.locked || []) {
      const e = pool.find((p) => p.item.sku === sku);
      if (e && spent + cost(e.item) <= opts.budget) { chosen.push(e.item); picks.push(e); n[e.item.cat]++; spent += cost(e.item); e.locked = true; }
    }
    if (opts.colorwayStory)
      for (const e of this.storyColorways(anchors, pool, new Set(picks.map((p) => p.item.sku)))) {
        if (picks.includes(e) || spent + cost(e.item) > opts.budget) continue;
        chosen.push(e.item); picks.push(e); n[e.item.cat]++; spent += cost(e.item); e.story = true;
      }
    const done = new Set(CATS.filter((c) => share[c] === 0));
    while (chosen.length < opts.maxSize && done.size < CATS.length) {
      const open = CATS.filter((c) => !done.has(c));
      // a category with nothing in it yet always goes first, so even a small budget gets a mix
      // (ties: bigger share first, then earrings before bracelets — the usual cheap add-on)
      const tieRank = { necklace: 0, earring: 1, bracelet: 2 };
      open.sort((a, b) => (n[a] > 0) - (n[b] > 0) || n[a] / share[a] - n[b] / share[b] || share[b] - share[a] || tieRank[a] - tieRank[b]);
      const c = open[0];
      // while categories are still empty, leave room for the cheapest decent piece of each of the others
      const coverFloor0 = this.cfg.budgetCoverageMinScore != null ? this.cfg.budgetCoverageMinScore : this.cfg.budgetMinScore || 0;
      let reserve = 0;
      if (n[c] === 0) for (const x of open) {
        if (x === c || n[x] > 0) continue;
        const cheapest = pool.filter((e) => e.item.cat === x && !picks.includes(e) && e.score >= coverFloor0).reduce((m, e) => Math.min(m, cost(e.item)), Infinity);
        if (isFinite(cheapest)) reserve += cheapest;
      }
      let got = null;
      const pickedItems = picks.map((p) => p.item);
      for (const room of reserve ? [reserve, 0] : [0])
        for (let level = 0; level < 3 && !got; level++) {
          let bestV = -Infinity;
          for (const e of pool) {
            if (e.item.cat !== c || picks.includes(e)) continue;
            if (spent + cost(e.item) + room > opts.budget + 1e-9) continue;
            const v = e.score - this.redundancy(e.item, pickedItems, anchors);   // similar and complementary
            if (v <= bestV) continue;
            if (!this.canAdd(e.item, chosen, counts, opts, level)) continue;
            got = e; bestV = v;
          }
        }
      // don't spend budget on weak matches — but a category that is still empty takes a slightly lower bar
      const floor = n[c] === 0 ? (this.cfg.budgetCoverageMinScore != null ? this.cfg.budgetCoverageMinScore : this.cfg.budgetMinScore || 0) : this.cfg.budgetMinScore || 0;
      if (!got || got.score < floor) { done.add(c); continue; }
      chosen.push(got.item); picks.push(got); n[c]++; spent += cost(got.item);
    }
    // Mix repair: if a category the mix asks for is still empty (the budget ran out on the others),
    // trade the weakest unlocked pick from the fullest category for the best piece of the missing one that fits.
    const lockedSet = new Set(opts.locked || []);
    const coverFloor = this.cfg.budgetCoverageMinScore != null ? this.cfg.budgetCoverageMinScore : this.cfg.budgetMinScore || 0;
    const missingNote = [];
    const order = CATS.filter((c) => share[c] > 0).sort((a, b) => share[b] - share[a] || { necklace: 0, earring: 1, bracelet: 2 }[a] - { necklace: 0, earring: 1, bracelet: 2 }[b]);
    for (const c of order) {
      if (n[c] > 0) continue;
      let best = null;
      const victims = picks.filter((p) => !lockedSet.has(p.item.sku) && n[p.item.cat] >= 2).sort((a, b) => a.score - b.score);
      for (const v of victims) {
        const rest = chosen.filter((x) => x !== v.item);
        for (const e of pool) {
          if (e.item.cat !== c || picks.includes(e) || e.score < coverFloor) continue;
          if (spent - cost(v.item) + cost(e.item) > opts.budget + 1e-9) continue;
          if (!this.canAdd(e.item, rest, counts, opts, 2)) continue;
          if (!best || e.score - v.score > best.gain) best = { v, e, gain: e.score - v.score };
          break;
        }
      }
      if (best) {
        const i = picks.indexOf(best.v);
        chosen[chosen.indexOf(best.v.item)] = best.e.item; picks[i] = best.e;
        n[best.v.item.cat]--; n[c]++; spent += cost(best.e.item) - cost(best.v.item);
      } else {
        missingNote.push(c);
      }
    }
    // Reach the order minimum: first try upgrading a pick to a pricier good match within budget,
    // then (only if needed) add the best piece that clears the minimum and say so.
    const minimum = (this.cfg.terms || {}).orderMinimum || 0;
    let note = "";
    if (spent < minimum) {
      let best = null;
      picks.forEach((p, idx) => {
        const rest = chosen.filter((x) => x !== p.item);
        for (const e of pool) {
          if (e.item.cat !== p.item.cat || picks.includes(e)) continue;
          const ns = spent - cost(p.item) + cost(e.item);
          if (ns < minimum || ns > Math.max(opts.budget, minimum) * (1 + (this.cfg.budgetTolerance || 0)) + 1e-9) continue;
          if (!this.canAdd(e.item, rest, counts, opts, 2)) continue;
          if (!best || e.score > best.e.score) best = { idx, e, ns };
          break;
        }
      });
      if (best) {
        const old = picks[best.idx];
        chosen[chosen.indexOf(old.item)] = best.e.item; picks[best.idx] = best.e; spent = best.ns;
        if (spent > opts.budget) note = `Traded up one piece to reach the $${minimum} order minimum.`;
      } else {
        for (const e of pool) {
          if (picks.includes(e) || chosen.length >= opts.maxSize) continue;
          if (spent + cost(e.item) < minimum) continue;
          if (!this.canAdd(e.item, chosen, counts, opts, 2)) continue;
          chosen.push(e.item); picks.push(e); spent += cost(e.item);
          note = `Added one piece over budget to reach the $${minimum} order minimum.`;
          break;
        }
      }
    }
    for (const e of picks) e.reason = e.story ? `Colorway story: the buyer's pick in ${lab(e.item.dom)}, so the style shows in more than one color.` : this.reason(anchors, e.item, e.sc);
    const n2 = { necklace: 0, bracelet: 0, earring: 0 };
    chosen.forEach((it) => n2[it.cat]++);
    Object.assign(n, n2);
    const finalCounts = { necklace: n.necklace, bracelet: n.bracelet, earring: n.earring };
    if (missingNote.length) {
      const names = missingNote.map((c) => ({ necklace: "necklaces", bracelet: "bracelets", earring: "earrings" }[c])).join(" and ");
      const anchorCost = anchors.reduce((a, it) => a + cost(it), 0);
      const why = anchorCost >= opts.budget ? `the buyer's pick${anchors.length > 1 ? "s" : ""} alone come${anchors.length > 1 ? "" : "s"} to $${anchorCost.toFixed(2)} at these units — raise the budget`
        : (opts.locked || []).length ? "the locked pieces use most of the budget — unlock one to make room"
        : "nothing that matches well fits what's left of the budget";
      note = (note ? note + " " : "") + `No ${names}: ${why}.`;
    }
    if (!note && chosen.length >= opts.maxSize && spent < opts.budget) note = `Capped at ${opts.maxSize} styles; raise units per style to use the rest of the budget.`;
    return { anchors, counts: finalCounts, picks, short: {}, pool, opts, budget: { budget: opts.budget, spent, remaining: opts.budget - spent, units: opts.units, note } };
  };

  /** Rebuild a saved capsule exactly (same pieces, same order), with fresh scores and reasons. */
  Engine.prototype.restore = function (anchorSkus, pickSkus, opts) {
    opts = Object.assign({}, opts || {});
    const anchors = anchorSkus.map((s) => this.bySku.get(s)).filter(Boolean);
    opts.anchors = anchors;
    const pool = this.eligible(anchors, opts).map((C) => { const sc = this.score(anchors, C); return { item: C, score: sc.total, sc }; })
      .sort((a, b) => b.score - a.score);
    const missing = [];
    const picks = [];
    for (const sku of pickSkus) {
      let e = pool.find((p) => p.item.sku === sku);
      const it = this.bySku.get(sku);
      if (!e && it) { const sc = this.score(anchors, it); e = { item: it, score: sc.total, sc, stale: true }; }
      if (!e) { missing.push(sku); continue; }
      e.reason = this.reason(anchors, e.item, e.sc);
      picks.push(e);
    }
    const counts = { necklace: 0, bracelet: 0, earring: 0 };
    anchors.concat(picks.map((p) => p.item)).forEach((it) => counts[it.cat]++);
    return { anchors, counts, picks, short: {}, pool, opts, missing };
  };

  const api = { Engine, CATS, label: lab };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CapsuleEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
