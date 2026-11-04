/* ===========================================================================
   grocery.js — what the kitchen needs this week.

   The list is not a wishlist: it is the next seven days of both people's
   actual meal plans, totalled per food, converted into packages using the
   real package size, minus what is already in the kitchen.

   The pantry is one kitchen with two writers. Each person writes only their
   own document; `STORE.pantry()` merges both and the newest edit of an item
   wins, so either of you can update any item and neither can clobber the
   other.
   =========================================================================== */
window.FIT = window.FIT || {};
FIT.GROCERY = (() => {
  'use strict';
  const S = FIT.STORE, N = FIT.NUTRITION, FOODS = FIT.FOODS;

  /* Monday-start week containing `dateStr`. */
  function weekStart(dateStr) {
    const dow = new Date(dateStr + 'T12:00:00').getDay();   /* 0 = Sunday */
    return N.addDays(dateStr, -((dow + 6) % 7));
  }
  const weekKey = (dateStr) => weekStart(dateStr);

  /** Average extras per day over the last 14 days, so drinks land on the list. */
  function extrasRate(personKey, dateStr) {
    const d = S.person(personKey);
    const rate = {};
    let days = 0;
    for (let i = 1; i <= 14; i++) {
      const dt = N.addDays(dateStr, -i);
      if (dt < d.profile.startDate) continue;
      days++;
      const ex = (d.days[dt] || {}).extras || {};
      for (const id of Object.keys(ex)) rate[id] = (rate[id] || 0) + ex[id];
    }
    if (!days) return {};
    for (const id of Object.keys(rate)) rate[id] = rate[id] / days;
    return rate;
  }

  /**
   * Everything both of them are planned to eat between `from` and `from + days`.
   * Returns { foodId: { units, byPerson: {danil, towne} } } in each food's own unit.
   */
  function need(from, days) {
    const out = {};
    const add = (id, q, who) => {
      if (!(q > 0)) return;
      if (!out[id]) out[id] = { units: 0, byPerson: { danil: 0, towne: 0 } };
      out[id].units += q;
      out[id].byPerson[who] += q;
    };

    for (const who of S.PEOPLE) {
      const d = S.person(who);
      if (!d.profile.setupDone) continue;
      const rate = extrasRate(who, from);

      for (let i = 0; i < days; i++) {
        const dt = N.addDays(from, i);
        let v;
        try { v = S.view(dt, who); } catch (e) { continue; }
        if (!v.meals) continue;

        /* a meal already eaten has already come out of stock */
        const eaten = (v.rec.meals) || {};
        for (const m of ['b', 'l', 'd']) {
          if (eaten[m]) continue;
          const meal = v.meals.meals[m];
          if (!meal) continue;
          meal.items.forEach(it => add(it.id, it.q, who));
        }
        /* drinks and snacks, from the recent habit */
        for (const id of Object.keys(rate)) {
          if (v.data.allowedFoods.indexOf(id) < 0) continue;
          add(id, rate[id], who);
        }
      }
    }
    return out;
  }

  /**
   * The shopping list. Each row says what is needed, what is in the kitchen,
   * and how many packages that comes to.
   */
  function list(from, days) {
    days = days || 7;
    const needed = need(from, days);
    const pan = S.pantry();
    const rows = [];

    const ids = new Set(Object.keys(needed));
    /* anything flagged low, or at zero stock, belongs on the list even if this
       week's plan does not call for it */
    for (const id of Object.keys(pan)) {
      if (pan[id] && (pan[id].low || pan[id].stock === 0)) ids.add(id);
    }

    for (const id of ids) {
      const f = FOODS.items[id];
      if (!f) continue;
      const nd = needed[id] || { units: 0, byPerson: { danil: 0, towne: 0 } };
      const p = pan[id] || {};
      const stock = typeof p.stock === 'number' ? p.stock : null;
      const short = stock == null ? nd.units : Math.max(0, nd.units - stock);
      const pkg = f.pkg || null;
      const packages = pkg && short > 0 ? Math.ceil(short / pkg.units) : 0;

      rows.push({
        id, name: f.name, unit: f.unit, pkg,
        needUnits: Math.round(nd.units * 100) / 100,
        byPerson: nd.byPerson,
        stock, tracked: stock != null,
        short: Math.round(short * 100) / 100,
        packages,
        low: !!p.low,
        buy: packages > 0 || (!!p.low) || (stock === 0 && nd.units > 0),
        needLabel: FOODS.qtyLabel(id, Math.max(0, Math.round(nd.units * 10) / 10)),
        shortLabel: FOODS.qtyLabel(id, Math.max(0, Math.round(short * 10) / 10)),
        tags: f.tags || []
      });
    }

    rows.sort((a, b) => (b.buy - a.buy) || (b.packages - a.packages) || a.name.localeCompare(b.name));
    return {
      from, days, rows,
      toBuy: rows.filter(r => r.buy),
      haveEnough: rows.filter(r => !r.buy),
      generatedAt: Date.now()
    };
  }

  /** Grouped the way a shop is actually laid out, so it is usable in the aisle. */
  const AISLES = [
    { key: 'produce', label: 'Produce' },
    { key: 'meat', label: 'Meat & seafood' },
    { key: 'dairy', label: 'Dairy & eggs' },
    { key: 'frozen', label: 'Frozen' },
    { key: 'bakery', label: 'Bread' },
    { key: 'pantry', label: 'Pantry & canned' },
    { key: 'drink', label: 'Drinks' },
    { key: 'other', label: 'Everything else' }
  ];

  /* Tags describe nutrition, not where a thing sits in the shop — chickpea
     pasta is tagged protein but lives with the pasta. So the aisle is named
     per food, with the tags only as a fallback. */
  const AISLE_OF = {
    nuggets_frozen: 'frozen', fries_oven: 'frozen', broccoli: 'frozen', green_beans: 'frozen',
    corn: 'frozen', mixed_veg: 'frozen', pizza_slice: 'frozen',

    chicken_breast: 'meat', chicken_thigh: 'meat', chicken_strips_baked: 'meat',
    steak_sirloin: 'meat', steak_ribeye: 'meat', beef_ground_93: 'meat', salmon: 'meat',

    egg: 'dairy', egg_white: 'dairy', milk_1pct: 'dairy', milk_whole: 'dairy',
    cheddar: 'dairy', mozzarella: 'dairy', yogurt_greek: 'dairy', cottage_cheese: 'dairy',
    butter: 'dairy', heb_vanilla_yog: 'dairy', chobani_flip_cd: 'dairy',

    bread_ww: 'bakery', tortilla: 'bakery',

    rice_white: 'pantry', rice_brown: 'pantry', banza_rice: 'pantry', banza_penne: 'pantry',
    pasta_cooked: 'pantry', oats_dry: 'pantry', heb_granola: 'pantry',
    beans_black: 'pantry', beans_pinto: 'pantry', beans_refried: 'pantry', tuna_water: 'pantry',
    ketchup: 'pantry', bbq_sauce: 'pantry', ranch: 'pantry', salsa: 'pantry', hot_sauce: 'pantry',
    olive_oil: 'pantry', peanut_butter: 'pantry', almonds: 'pantry', mac_cheese: 'pantry',
    protein_shake: 'pantry',

    banana: 'produce', apple: 'produce', strawberries: 'produce', grapes: 'produce',
    avocado_half: 'produce', potato_baked: 'produce', sweet_potato: 'produce',
    salad_greens: 'produce', fries_airfry: 'produce',

    alani: 'drink'
  };

  function aisleFor(row) {
    if (AISLE_OF[row.id]) return AISLE_OF[row.id];
    const t = row.tags || [];
    if (t.indexOf('drink') >= 0) return 'drink';
    if (t.indexOf('veg') >= 0 || t.indexOf('fruit') >= 0) return 'produce';
    if (t.indexOf('dairy') >= 0) return 'dairy';
    if (t.indexOf('protein') >= 0) return 'meat';
    if (t.indexOf('carb') >= 0) return 'pantry';
    return 'other';
  }

  function byAisle(rows) {
    const out = AISLES.map(a => ({ ...a, rows: [] }));
    for (const r of rows) {
      const key = aisleFor(r);
      (out.find(a => a.key === key) || out[out.length - 1]).rows.push(r);
    }
    return out.filter(a => a.rows.length);
  }

  /** Plain text, for copying or dropping into an email. */
  function text(l) {
    const end = N.addDays(l.from, l.days - 1);
    const lines = [
      'Grocery list — ' + pretty(l.from) + ' to ' + pretty(end),
      ''
    ];
    if (!l.toBuy.length) {
      lines.push('Nothing to buy. The kitchen covers the whole week.');
    } else {
      for (const a of byAisle(l.toBuy)) {
        lines.push(a.label.toUpperCase());
        for (const r of a.rows) {
          const qty = r.pkg && r.packages
            ? r.packages + ' × ' + r.pkg.label
            : r.shortLabel;
          lines.push('  [ ] ' + r.name + ' — ' + qty + (r.low ? '  (marked low)' : ''));
        }
        lines.push('');
      }
    }
    const have = l.haveEnough.filter(r => r.tracked);
    if (have.length) {
      lines.push('ALREADY IN THE KITCHEN');
      have.forEach(r => lines.push('  ' + r.name + ' — ' + FOODS.qtyLabel(r.id, r.stock) + ' left'));
      lines.push('');
    }
    lines.push('Built from your meal plans for those seven days.');
    return lines.join('\n');
  }

  function pretty(d) {
    const a = d.split('-').map(Number);
    return new Date(a[0], a[1] - 1, a[2]).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  /** mailto: with the list already in the body. */
  function mailto(l, to) {
    const end = N.addDays(l.from, l.days - 1);
    const subject = 'Grocery list — ' + pretty(l.from) + ' to ' + pretty(end);
    return 'mailto:' + encodeURIComponent(to || '') +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(text(l));
  }

  /** Has this week's list been shown yet? */
  function dueThisWeek(dateStr) {
    const d = S.me();
    const seen = (d.seen && d.seen.groceryWeek) || '';
    return seen !== weekKey(dateStr);
  }
  function markShown(dateStr) { S.markSeen('groceryWeek', weekKey(dateStr)); }

  /** Foods worth offering a stock box for: everything either of them can eat. */
  function trackable() {
    const ids = new Set();
    for (const p of S.PEOPLE) (S.person(p).allowedFoods || []).forEach(id => ids.add(id));
    return [...ids].filter(id => FOODS.items[id]);
  }

  return { weekStart, weekKey, need, list, byAisle, aisleFor, text, mailto, dueThisWeek, markShown, trackable, extrasRate, pretty, AISLES };
})();
