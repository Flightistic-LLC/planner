/* ===========================================================================
   nutrition.js — calorie and protein targets, and the day's meals.

   Two rules this file will not break:
     1. The deficit never exceeds CDC's 1,000 kcal/day, and intake never drops
        below the clinical floor. If the goal date needs more than that, the
        date moves — not the floor.
     2. If the chosen food list cannot physically carry the protein target,
        the app says so with the arithmetic, instead of printing a target
        nobody can hit.
   =========================================================================== */
window.FIT = window.FIT || {};
FIT.NUTRITION = (() => {
  'use strict';
  const CDC = FIT.CDC, FOODS = FIT.FOODS;

  const MEAL_SPLIT = { b: 0.25, l: 0.35, d: 0.40 };
  const MEAL_LABEL = { b: 'Breakfast', l: 'Lunch', d: 'Dinner' };

  /* deterministic per person+date+meal, so both phones show the same plan */
  function seed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  const dayNumber = (dateStr) => Math.floor(Date.parse(dateStr + 'T12:00:00') / 86400000);

  /* =======================================================================
     Targets
     ======================================================================= */
  function targets(profile, exerciseKcal, opts) {
    opts = opts || {};
    const adjust = opts.adjust || { kcal: 0 };
    const weight = opts.weight || profile.startWeight;
    const sex = profile.sex || 'female';

    const bmr = CDC.bmr({ lb: weight, inches: profile.heightIn, age: profile.age, sex });
    const out = {
      ok: !!bmr, bmr,
      exercise: Math.round(exerciseKcal || 0),
      weight, sex
    };
    if (!bmr) {
      out.note = 'Add your height and age in Settings and every number below turns on.';
      return out;
    }

    out.nonExercise = Math.round(bmr * (CDC.NON_EXERCISE_FACTOR - 1));
    out.maintenance = Math.round(bmr * CDC.NON_EXERCISE_FACTOR + out.exercise);

    /* How fast would we have to go to land the goal on the goal date? */
    const weeksLeft = Math.max(0, weeksBetween(opts.today || todayStr(), profile.goalDate));
    const toLose = weight - profile.goalWeight;
    out.weeksLeft = weeksLeft;
    out.toLose = toLose;

    let neededRate = weeksLeft > 0.3 ? toLose / weeksLeft : 0;
    if (toLose <= 0.2) neededRate = 0;             /* at or past goal: hold */
    out.neededRate = neededRate;
    out.rateVerdict = CDC.judgeRate(neededRate);

    /* CDC's own ceiling on the daily deficit. */
    let deficit = CDC.dailyDeficitForRate(Math.max(0, neededRate));
    out.deficitWanted = Math.round(deficit);
    out.deficitCappedByCdc = deficit > CDC.WEIGHT.maxDailyDeficit;
    deficit = Math.min(deficit, CDC.WEIGHT.maxDailyDeficit);

    /* Recomp (losing fat while building muscle) does better on a smaller
       deficit, so we cap it tighter and say why. */
    if (profile.goalType === 'recomp') {
      out.deficitCappedByRecomp = deficit > 600;
      deficit = Math.min(deficit, 600);
    }

    let intake = Math.round(out.maintenance - deficit) + (adjust.kcal || 0);
    const floor = CDC.WEIGHT.floorKcal[sex] || 1200;
    out.floor = floor;
    out.floored = intake < floor;
    if (out.floored) intake = floor;

    out.intake = intake;
    out.actualDeficit = Math.max(0, out.maintenance - intake);
    out.actualRate = CDC.rateForDailyDeficit(out.actualDeficit);
    out.adjustKcal = adjust.kcal || 0;

    /* If the honest pace is slower than the goal date wants, say when it
       actually lands. */
    if (toLose > 0.2 && out.actualRate > 0.05) {
      const weeks = toLose / out.actualRate;
      out.projectedWeeks = weeks;
      out.projectedDate = addDays(opts.today || todayStr(), Math.round(weeks * 7));
      out.behindGoalDate = out.projectedDate > profile.goalDate;
    }

    /* Protein: the DRI floor and the training band, kept clearly apart. */
    const kg = weight / 2.20462;
    out.protein = {
      dri: Math.round(kg * CDC.PROTEIN.driPerKg),
      target: Math.round(kg * (profile.goalType === 'recomp' ? 1.8 : 1.6)),
      high: Math.round(kg * CDC.PROTEIN.trainingHigh),
      perKg: profile.goalType === 'recomp' ? 1.8 : 1.6
    };
    out.fiber = CDC.FIBER_DRI[sex] || 25;
    out.sodiumLimit = CDC.SODIUM_LIMIT;
    out.addedSugarKcal = Math.round(intake * CDC.ADDED_SUGAR_PCT / 100);
    return out;
  }

  /* =======================================================================
     Scaling one template to a calorie target
     ======================================================================= */
  function scaleTemplate(tpl, kcalTarget) {
    const parts = tpl.items.map(it => ({ ...it }));
    const kcalAt = (s) => parts.reduce((sum, it) => {
      const q = it.fixed ? it.q : clamp(it.q * s, it.min, it.max);
      return sum + FOODS.items[it.id].kcal * q;
    }, 0);

    let lo = 0.25, hi = 4, s = 1;
    for (let i = 0; i < 40; i++) {
      s = (lo + hi) / 2;
      if (kcalAt(s) < kcalTarget) lo = s; else hi = s;
    }

    const items = parts.map(it => {
      const raw = it.fixed ? it.q : clamp(it.q * s, it.min, it.max);
      const q = FOODS.roundQty(it.id, raw);
      return { id: it.id, q, label: FOODS.qtyLabel(it.id, q), name: FOODS.name(it.id), m: FOODS.macros(it.id, q) };
    });
    return { tpl, items, totals: sumMacros(items.map(i => i.m)) };
  }

  function sumMacros(list) {
    const t = { kcal: 0, p: 0, c: 0, fat: 0, na: 0, fib: 0 };
    for (const m of list) { t.kcal += m.kcal; t.p += m.p; t.c += m.c; t.fat += m.fat; t.na += m.na; t.fib += m.fib; }
    for (const k in t) t[k] = Math.round(t[k] * 10) / 10;
    t.kcal = Math.round(t.kcal); t.na = Math.round(t.na);
    return t;
  }

  /* =======================================================================
     One day of meals
     ======================================================================= */
  function planMeal(person, dateStr, meal, kcalTarget, pTarget, allowed) {
    const allow = new Set(allowed);
    const cands = FOODS.templates.filter(t =>
      t.who === person && t.meal === meal && t.items.every(it => allow.has(it.id)));
    if (!cands.length) return null;

    const scored = cands.map(t => {
      const built = scaleTemplate(t, kcalTarget);
      const kcalErr = Math.abs(built.totals.kcal - kcalTarget) / Math.max(1, kcalTarget);
      const pShort = Math.max(0, pTarget - built.totals.p) / Math.max(1, pTarget);
      built.score = kcalErr + pShort * 1.6;
      return built;
    }).sort((a, b) => a.score - b.score);

    /* Everything within a quarter-point of the best is "good enough"; rotate
       through that set by date so meals vary without ever going off-plan. */
    const good = scored.filter(b => b.score <= scored[0].score + 0.25);
    const idx = (dayNumber(dateStr) + seed(person + meal) % 7) % good.length;
    const pick = good[idx];
    pick.meal = meal;
    pick.label = MEAL_LABEL[meal];
    pick.kcalTarget = Math.round(kcalTarget);
    pick.alternatives = scored.filter(b => b !== pick).slice(0, 4)
      .map(b => ({ id: b.tpl.id, name: b.tpl.name, kcal: b.totals.kcal, p: Math.round(b.totals.p) }));
    return pick;
  }

  function planDay(person, dateStr, tgt, allowed, overrides) {
    overrides = overrides || {};
    const meals = {};
    for (const meal of ['b', 'l', 'd']) {
      const kcalT = tgt.intake * MEAL_SPLIT[meal];
      const pT = tgt.protein.target * MEAL_SPLIT[meal];
      let built = null;
      if (overrides[meal]) {
        const t = FOODS.templates.find(x => x.id === overrides[meal]);
        if (t) { built = scaleTemplate(t, kcalT); built.meal = meal; built.label = MEAL_LABEL[meal]; built.kcalTarget = Math.round(kcalT); built.alternatives = []; built.chosen = true; }
      }
      meals[meal] = built || planMeal(person, dateStr, meal, kcalT, pT, allowed);
    }
    const present = ['b', 'l', 'd'].filter(m => meals[m]);
    const totals = sumMacros(present.flatMap(m => meals[m].items.map(i => i.m)));
    return {
      meals, totals,
      kcalTarget: tgt.intake,
      proteinTarget: tgt.protein.target,
      kcalDelta: totals.kcal - tgt.intake,
      proteinDelta: Math.round(totals.p - tgt.protein.target),
      gap: cdcGapCheck(meals, totals, tgt),
      topUp: topUpSuggestion(totals, tgt, allowed)
    };
  }

  /* =======================================================================
     Can this food list even carry the protein target?
     ======================================================================= */
  function proteinCeiling(allowed, kcalBudget) {
    let best = null, bestD = 0;
    for (const id of allowed) {
      const d = FOODS.proteinDensity(id);
      if (d > bestD) { bestD = d; best = id; }
    }
    if (!best) return null;
    return { food: best, name: FOODS.name(best), density: bestD, maxProtein: Math.round(kcalBudget * bestD / 4) };
  }

  /** Ranked by how little it asks her to change, not by macros. */
  const UNLOCK_ORDER = [
    ['chicken_strips_baked', 'Baked breaded chicken strips instead of frozen nuggets — same breading, same ketchup, nearly double the protein and a third less fat.'],
    ['protein_shake', 'One chocolate protein shake a day — 24 g of protein for 120 calories, and it does not taste like health food.'],
    ['chicken_breast', 'Plain grilled chicken as an option — 31 g of protein per 100 g.'],
    ['egg', 'Eggs — 6 g of protein each, and they go with the rice you already eat.'],
    ['yogurt_greek', 'Greek yogurt — 10 g of protein per 100 g, works as breakfast.'],
    ['cottage_cheese', 'Cottage cheese — 11 g of protein per 100 g.'],
    ['milk_1pct', '1% milk — 8 g of protein a cup, easiest thing on this list.']
  ];

  function proteinFeasibility(allowed, tgt) {
    if (!tgt.ok) return null;
    const ceiling = proteinCeiling(allowed, tgt.intake);
    if (!ceiling) return null;
    const target = tgt.protein.target;
    /* Realistically nobody eats one food all day; 80% of the single-food
       ceiling is the honest practical limit for a mixed plan. */
    const practical = Math.round(ceiling.maxProtein * 0.8);
    const feasible = practical >= target;
    const res = {
      feasible, practical, target, dri: tgt.protein.dri,
      meetsDri: practical >= tgt.protein.dri,
      ceiling, unlocks: []
    };
    if (feasible) return res;
    for (const [id, why] of UNLOCK_ORDER) {
      if (allowed.includes(id)) continue;
      const withIt = proteinCeiling(allowed.concat([id]), tgt.intake);
      const p2 = Math.round(withIt.maxProtein * 0.8);
      if (p2 >= target) res.unlocks.push({ id, name: FOODS.name(id), why, practical: p2 });
      if (res.unlocks.length >= 2) break;
    }
    return res;
  }

  function topUpSuggestion(totals, tgt, allowed) {
    const short = Math.round(tgt.protein.target - totals.p);
    if (short <= 5) return null;
    const opts = [];
    if (allowed.includes('protein_shake')) opts.push({ id: 'protein_shake', q: Math.max(1, Math.round(short / 24)), per: 24 });
    if (allowed.includes('yogurt_greek')) opts.push({ id: 'yogurt_greek', q: Math.round(short / 0.1 / 10) * 10, per: short });
    if (allowed.includes('chicken_breast')) opts.push({ id: 'chicken_breast', q: Math.round(short / 0.31 / 10) * 10, per: short });
    if (!opts.length) return { short, none: true };
    const o = opts[0];
    const m = FOODS.macros(o.id, o.q);
    return { short, id: o.id, name: FOODS.name(o.id), label: FOODS.qtyLabel(o.id, o.q), kcal: Math.round(m.kcal), p: Math.round(m.p) };
  }

  /* =======================================================================
     How today's food lines up with CDC's description of a healthy plan
     ======================================================================= */
  function cdcGapCheck(meals, totals, tgt) {
    const tags = new Set();
    for (const m of ['b', 'l', 'd']) {
      if (!meals[m]) continue;
      for (const it of meals[m].items) (FOODS.items[it.id].tags || []).forEach(t => tags.add(t));
    }
    const gaps = [];
    if (!tags.has('veg')) gaps.push({ key: 'veg', text: 'No vegetables today. CDC’s healthy eating plan leans on vegetables, and this plan has none.' });
    if (!tags.has('fruit')) gaps.push({ key: 'fruit', text: 'No fruit today.' });
    if (!tags.has('wholegrain')) gaps.push({ key: 'wholegrain', text: 'No whole grains — white rice is a refined grain.' });
    if (!tags.has('dairy')) gaps.push({ key: 'dairy', text: 'No dairy, so calcium is likely short.' });
    if (totals.na > CDC.SODIUM_LIMIT) gaps.push({ key: 'sodium', text: `About ${Math.round(totals.na).toLocaleString()} mg of sodium — over the ${CDC.SODIUM_LIMIT.toLocaleString()} mg daily limit. Frozen nuggets and fries are where almost all of it comes from.` });
    if (tgt.ok && totals.fib < tgt.fiber) gaps.push({ key: 'fiber', text: `About ${Math.round(totals.fib)} g of fiber against a ${tgt.fiber} g target. Beans are the easiest fix — 7 g per 100 g.` });
    return { tags: [...tags], gaps };
  }

  /* ---- small date helpers (local time, no timezone surprises) ---- */
  function todayStr(d) {
    const x = d ? new Date(d) : new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }
  function addDays(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const x = new Date(y, m - 1, d + n);
    return todayStr(x);
  }
  function daysBetween(a, b) {
    const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
    return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
  }
  const weeksBetween = (a, b) => daysBetween(a, b) / 7;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo == null ? -Infinity : lo), hi == null ? Infinity : hi);

  return {
    MEAL_SPLIT, MEAL_LABEL, targets, planDay, planMeal, scaleTemplate, sumMacros,
    proteinFeasibility, proteinCeiling, cdcGapCheck,
    todayStr, addDays, daysBetween, weeksBetween, clamp, dayNumber
  };
})();
