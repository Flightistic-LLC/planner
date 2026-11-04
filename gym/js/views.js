/* ===========================================================================
   views.js — the five tabs, the sheets, and the chart data.
   =========================================================================== */
(function (U) {
  'use strict';
  const S = FIT.STORE, A = FIT.AUTH, C = FIT.COACH, N = FIT.NUTRITION,
        P = FIT.PROGRAM, CDC = FIT.CDC, FOODS = FIT.FOODS, EX = FIT.EX, CH = FIT.CHARTS;
  const h = U.h, esc = h.esc, ICON = h.ICON, ui = h.ui, lb = h.lb, sgn = h.sgn,
        mins = h.mins, kk = h.kk, toast = h.toast, render = h.render;

  const TONE_ICON = { good: ICON.check, warning: ICON.alert, serious: ICON.alert, critical: ICON.alert, neutral: ICON.info };

  /* =======================================================================
     Titles
     ======================================================================= */
  U.tabTitle = function (tab, v) {
    if (tab === 'today') return h.greet() + ', ' + v.name.split(' ')[0];
    if (tab === 'plan') return 'The plan';
    if (tab === 'food') return 'Food';
    if (tab === 'grocery') return 'Grocery';
    if (tab === 'progress') return 'Progress';
    return 'Us';
  };
  U.tabSub = function (tab, v) {
    if (tab === 'today') return h.prettyDate(ui.date) + ' · ' + v.session.focusLabel + ' · ' + mins(v.session.totalMinutes);
    if (tab === 'plan') return 'Seven days, built around your time';
    if (tab === 'food') return v.tgt.ok ? kk(v.tgt.intake) + ' kcal · ' + v.tgt.protein.target + ' g protein today' : 'Add your height and age';
    if (tab === 'grocery') {
      const l = FIT.GROCERY.list(FIT.GROCERY.weekStart(ui.date), 7);
      return l.toBuy.length ? l.toBuy.length + ' things to buy this week' : 'The kitchen covers this week';
    }
    if (tab === 'progress') return 'Both of you, honestly';
    return 'Accountability, both directions';
  };

  U.tabView = function (tab, v) {
    if (tab === 'today') return todayTab(v);
    if (tab === 'plan') return planTab(v);
    if (tab === 'food') return foodTab(v);
    if (tab === 'grocery') return groceryTab(v);
    if (tab === 'progress') return progressTab(v);
    return usTab(v);
  };

  /* =======================================================================
     TODAY
     ======================================================================= */
  function todayTab(v) {
    const d = v.data, date = ui.date;
    const sessions = S.sessionsByDate(v.key, N.addDays(date, -13), 14);
    const sum = C.dailySummary({
      days: d.days, dateStr: date, profile: v.profile, tgt: v.tgt,
      sessionsByDate: sessions, since: v.profile.startDate,
      lastAdjust: d.adjust && d.adjust.at ? d.adjust : null,
      plannedSodium: yesterdaySodium(v)
    });
    maybeAutoAdjust(v, sum);

    let out = syncBanner();
    if (v.key === 'towne') out += loveCard(date);
    out += checkInCard(v, sum);
    out += sum.locked ? lockedSummary() : summaryCard(v, sum);
    out += workoutCard(v);
    out += mealsCard(v);
    out += partnerStrip(v);
    return out;
  }

  /* If the database is refusing, say so where it will actually be seen. */
  function syncBanner() {
    const st = S.state.sync.status;
    if (st === 'live' || st === 'connecting') return '';
    const offline = st === 'offline';
    return '<div class="banner ' + (offline ? 'neutral' : 'critical') + '" style="margin-top:14px">' +
      '<span class="ic">' + (offline ? ICON.info : ICON.alert) + '</span><div>' +
      (offline
        ? '<b>Offline.</b> Everything is saved here and will sync when you are back on.'
        : '<b>Not syncing.</b> This phone is keeping its own copy, and ' + esc(S.DISPLAY[S.partnerKey()]) +
          ' cannot see any of it. <button class="linkbtn" data-act="sheet" data-v="sync">How to fix it</button>') +
      '</div></div>';
  }

  function loveCard(date) {
    return '<div class="banner love" style="margin-top:14px"><span class="ic">' + ICON.heart + '</span>' +
      '<div><b>' + esc(C.loveNote(date)) + '</b></div></div>';
  }

  function checkInCard(v, sum) {
    const rec = v.rec;
    const logged = rec.w > 0;
    const tr = sum.trend;
    return '<section class="card">' +
      '<header><div><div class="eyebrow">Today’s check-in</div>' +
      '<h2>' + (logged ? 'Weight logged' : 'Step on the scale') + '</h2></div>' +
      (logged ? '<span class="pill good">' + ICON.check + 'Done</span>' : '<span class="pill warning">' + ICON.alert + 'Required</span>') +
      '</header>' +
      (logged
        ? '<div class="hero"><span class="big num">' + lb(rec.w) + '</span><span class="unit">lb</span>' +
            (tr.dayChange != null ? '<span class="delta ' + (tr.dayChange < -0.05 ? 'down' : tr.dayChange > 0.05 ? 'up' : 'flat') + '">' +
              sgn(tr.dayChange) + ' on yesterday</span>' : '') +
          '</div>' +
          '<div class="row wrap" style="margin-top:12px">' +
            '<button class="btn sm" data-act="sheet" data-v="weight">Edit</button>' +
            '<button class="btn sm" data-act="sheet" data-v="waist">' + (rec.waist ? 'Waist ' + lb(rec.waist) + '"' : 'Add waist') + '</button>' +
          '</div>'
        : '<p class="small muted">Today’s summary, chart and any plan changes unlock once this is in. Morning, after the bathroom, before food — same way every day.</p>' +
          '<form data-form="weigh" class="weighin" style="margin-top:4px">' +
            '<input name="w" type="number" step="0.1" min="50" max="600" inputmode="decimal" placeholder="' + lb(v.latest, 1) + '" required aria-label="Weight in pounds">' +
            '<button class="btn primary" type="submit">Log</button>' +
          '</form>' +
          '<p class="xs dim" style="margin-top:8px">Whatever it says, log it. A number you hid from is the only one that can actually hurt the plan.</p>'
      ) +
      '</section>';
  }

  const lockedSummary = () => '<div class="banner neutral"><span class="ic">' + ICON.info + '</span>' +
    '<div><b>Summary locked.</b> Log today’s weight above and the full read-out appears — trend, why, and any change to your food or cardio.</div></div>';

  function summaryCard(v, sum) {
    const ver = sum.verdict, tr = sum.trend, proj = sum.projection, adj = sum.adjustment;
    const gap = ver.delta;
    let out = '<section class="card">' +
      '<header><div><div class="eyebrow">Daily summary</div><h2>' + esc(ver.label) + '</h2></div>' +
      '<span class="pill ' + ver.tone + '">' + (TONE_ICON[ver.tone] || ICON.info) + esc(ver.label) + '</span></header>';

    out += '<div class="grid3">' +
      stat('7-day average', tr.avg7 != null ? lb(tr.avg7) + ' lb' : '—', 'the real number') +
      stat('Plan says today', lb(ver.expected) + ' lb', gap == null ? '' : (Math.abs(gap) < 0.1 ? 'spot on' : sgn(gap) + ' lb off')) +
      stat('This week', tr.rate7 != null ? sgn(tr.rate7) + ' lb/wk' : '—', 'CDC: 1–2 lb is the range') +
      '</div>';

    if (tr.first && tr.last) {
      const lost = tr.first.w - tr.last.w;
      const total = v.profile.startWeight - v.profile.goalWeight;
      out += '<p class="small" style="margin-top:12px"><b>' + (lost >= 0 ? lb(lost) + ' lb down' : lb(-lost) + ' lb up') + '</b> since you started' +
        (total > 0 ? ' — that is ' + Math.max(0, Math.round(lost / total * 100)) + '% of the way to ' + Math.round(v.profile.goalWeight) + ' lb.' : '.') + '</p>';
    }

    out += '<div class="hr"></div><div class="eyebrow">Why</div><ul class="feed" style="margin-top:4px">' +
      (ver.reasons.length ? ver.reasons.map(function (r) {
        return '<li><span style="flex:none;color:var(--ink-3)">•</span><span>' + esc(r) + '</span></li>';
      }).join('') : '<li><span>Nothing unusual in the data. The plan is doing what it should.</span></li>') +
      '</ul>';

    if (ver.wins.length) {
      out += '<div class="banner good"><span class="ic">' + ICON.check + '</span><div>' +
        ver.wins.map(function (w) { return esc(w); }).join('<br>') + '</div></div>';
    }

    out += '<div class="hr"></div><div class="eyebrow">What changes</div>';
    if (adj.change) {
      out += '<div class="banner ' + (adj.kcal > 0 ? 'warning' : 'serious') + '"><span class="ic">' + ICON.alert + '</span>' +
        '<div><b>Plan adjusted.</b> ' + esc(adj.why) + '</div></div>';
    } else {
      out += '<div class="banner ' + (adj.adherence ? 'warning' : 'neutral') + '"><span class="ic">' +
        (adj.adherence ? ICON.alert : ICON.info) + '</span><div>' + esc(adj.why || 'No change needed.') + '</div></div>';
    }

    if (proj && proj.date) {
      out += '<p class="small"><b>At your current 14-day pace</b> you reach ' + Math.round(v.profile.goalWeight) + ' lb around <b>' +
        h.shortDate(proj.date) + '</b> (' + proj.weeks.toFixed(1) + ' weeks). ' +
        (proj.late ? 'That is after your ' + h.shortDate(v.profile.goalDate) + ' target — not a failure, just the honest arithmetic at this pace.'
                   : 'That is on or ahead of your ' + h.shortDate(v.profile.goalDate) + ' target.') + '</p>';
    } else if (proj && proj.stalled) {
      out += '<p class="small"><b>No date yet.</b> The 14-day trend is flat or rising, so there is nothing honest to project from. One clean week fixes that.</p>';
    } else if (proj && proj.done) {
      out += '<div class="banner good"><span class="ic">' + ICON.check + '</span><div><b>You are at your goal weight.</b> ' +
        'From here it is maintenance and shape, not the scale.</div></div>';
    }

    out += '<div class="banner ' + (ver.tone === 'good' ? 'good' : 'neutral') + '" style="margin-bottom:0"><span class="ic">' + ICON.info + '</span>' +
      '<div>' + esc(sum.kindness) + '</div></div>';

    if (sum.streak > 1) {
      out += '<p class="xs dim" style="margin-top:10px">' + sum.streak + ' days logged in a row. CDC’s own line is that gradual, ' +
        'steady, tracked loss is the kind people keep off — the streak is doing more work than any single number here.</p>';
    }
    return out + '</section>';
  }

  function stat(k, val, note) {
    return '<div class="stat"><div class="k">' + esc(k) + '</div><div class="v num">' + esc(val) + '</div>' +
      (note ? '<div class="n">' + esc(note) + '</div>' : '') + '</div>';
  }

  /* ---------------- workout ---------------- */
  function workoutCard(v) {
    const s = v.session, rec = v.rec, done = !!(rec.workout && rec.workout.done);
    const completed = (rec.workout && rec.workout.completed) || [];
    const budget = rec.budget || v.profile.defaultBudget || 60;

    let out = '<section class="card">' +
      '<header><div><div class="eyebrow">' + (s.kind === 'rest' ? 'Rest day' : 'Gym · ' + mins(s.totalMinutes)) + '</div>' +
      '<h2>' + esc(s.focusLabel) + '</h2></div>' +
      (done ? '<span class="pill good">' + ICON.check + 'Done</span>' : '') + '</header>';

    if (s.reason) out += '<div class="banner neutral"><span class="ic">' + ICON.info + '</span><div>' + esc(s.reason) + '</div></div>';

    out += '<div class="eyebrow">How long have you got?</div><div class="row wrap" style="margin:6px 0 2px">' +
      P.BUDGET_CHOICES.map(function (b) {
        return '<button class="chip sm" data-act="set-budget" data-v="' + b + '" aria-pressed="' + (budget === b) + '">' + mins(b) + '</button>';
      }).join('') + '</div>' +
      '<p class="xs dim">Change it and the whole session is rebuilt — more cardio, more lifts, a mobility block, the lot. Not just stretched numbers.</p>';

    out += '<div class="row wrap" style="margin-top:8px">' +
      '<button class="chip sm" data-act="set-mode" data-v="auto" aria-pressed="' + (!rec.mode || rec.mode === 'auto') + '">Full session</button>' +
      '<button class="chip sm" data-act="set-mode" data-v="cardio" aria-pressed="' + (rec.mode === 'cardio') + '">Cardio only</button>' +
      '<button class="chip sm" data-act="set-mode" data-v="rest" aria-pressed="' + (rec.mode === 'rest') + '">Rest today</button>' +
      '</div>';

    if (s.kind !== 'rest') {
      out += '<div class="grid3" style="margin-top:12px">' +
        stat('Cardio', s.cardioMinutes + ' min', 'minimum 30, always') +
        stat('Lifting', s.strengthMinutes + ' min', s.itemCount + ' exercises') +
        stat('Burn', '~' + kk(s.estKcal), 'CDC estimate') +
        '</div>';
    }

    out += s.blocks.map(function (b) { return blockHtml(b, completed); }).join('');

    if (s.kind !== 'rest') {
      out += '<button class="btn ' + (done ? '' : 'primary') + ' full" data-act="finish-workout" style="margin-top:12px">' +
        (done ? 'Undo — did not finish' : 'I did it — mark the hour done') + '</button>';
    }
    return out + '</section>';
  }

  function blockHtml(b, completed) {
    const tag = { warmup: 'warm-up', cardio: 'cardio', strength: 'lift', core: 'abs', cooldown: 'stretch', mobility: 'mobility', finisher: 'finisher', rest: 'rest' }[b.kind] || b.kind;
    let out = '<div class="block"><div class="bh"><span class="kindtag">' + tag + '</span>' +
      '<span class="bt">' + esc(b.title) + (b.activityLabel ? ' · ' + esc(b.activityLabel) : '') + '</span>' +
      (b.minutes ? '<span class="bm">' + b.minutes + ' min</span>' : '') + '</div>';
    if (b.adjusted) out += '<div class="note">Includes +' + b.adjusted + ' min added by the coach after a stalled week.</div>';
    if (b.items && b.items.length) {
      out += b.items.map(function (it) {
        const on = completed.indexOf(it.exId) >= 0;
        return '<div class="ex' + (on ? ' done' : '') + '">' +
          '<button class="check" data-act="toggle-ex" data-id="' + it.exId + '" aria-pressed="' + on + '" aria-label="Done">' + ICON.check + '</button>' +
          '<div class="body"><div class="nm ttl">' + esc(it.name) + '</div>' +
          '<div class="pr">' + it.sets + ' × ' + esc(it.reps) + ' · ' + it.rest + 's rest' + (it.alt ? ' · or ' + esc(it.alt) : '') + '</div>' +
          (it.cue ? '<div class="cue">' + esc(it.cue) + '</div>' : '') +
          (it.suggest ? '<div class="sug">' + esc(it.suggest) + '</div>' : '') +
          '<form data-form="lift" class="logw"><input type="hidden" name="ex" value="' + it.exId + '">' +
            '<input name="w" type="number" step="2.5" min="0" inputmode="decimal" placeholder="lb"' + (it.last ? ' value="' + it.last.w + '"' : '') + ' aria-label="Weight">' +
            '<span class="xs dim">×</span>' +
            '<input name="reps" type="number" min="1" max="100" inputmode="numeric" placeholder="reps" aria-label="Reps">' +
            '<button class="btn sm" type="submit">Save set</button></form>' +
          '</div></div>';
      }).join('');
    }
    if (b.recovery) {
      out += b.recovery.map(function (r) {
        return '<div class="ex"><div class="body"><div class="nm">' + esc(r.name) + ' · ' + r.minutes + ' min</div>' +
          '<div class="cue">' + esc(r.cue) + '</div></div></div>';
      }).join('');
    }
    if (b.note) out += '<div class="note">' + esc(b.note) + '</div>';
    if (b.optional) out += '<div class="note">' + esc(b.optional) + '</div>';
    return out + '</div>';
  }

  /* ---------------- meals ---------------- */
  function mealsCard(v) {
    if (!v.tgt.ok) {
      return '<section class="card"><h2>Food</h2><div class="banner warning"><span class="ic">' + ICON.alert + '</span>' +
        '<div>' + esc(v.tgt.note) + '</div></div></section>';
    }
    const plan = v.meals, rec = v.rec, eaten = rec.meals || {};
    const done = ['b', 'l', 'd'].filter(function (m) { return eaten[m]; }).length;

    let out = '<section class="card">' +
      '<header><div><div class="eyebrow">Food · ' + done + ' of 3 logged</div>' +
      '<h2>' + kk(plan.totals.kcal) + ' kcal · ' + Math.round(plan.totals.p) + ' g protein</h2></div>' +
      '<span class="pill ' + (done === 3 ? 'good' : done ? 'warning' : 'neutral') + '">' + done + '/3</span></header>' +
      '<p class="small muted">Target ' + kk(v.tgt.intake) + ' kcal and ' + v.tgt.protein.target + ' g protein. ' +
      'Tick each meal when you have actually eaten it — an unticked meal counts as missed for both of you.</p>';

    ['b', 'l', 'd'].forEach(function (m) {
      const meal = plan.meals[m];
      if (!meal) {
        out += '<div class="meal"><div class="mh"><div class="ml"><div class="mn">' + N.MEAL_LABEL[m] + '</div>' +
          '<div class="mt">No meal can be built from your food list for this slot. Tick another food in the Food tab.</div></div></div></div>';
        return;
      }
      const on = !!eaten[m];
      out += '<div class="meal"><div class="mh">' +
        '<button class="check" data-act="toggle-meal" data-m="' + m + '" aria-pressed="' + on + '" aria-label="Ate ' + N.MEAL_LABEL[m] + '">' + ICON.check + '</button>' +
        '<div class="ml"><div class="mn' + (on ? '' : '') + '">' + N.MEAL_LABEL[m] + ' · ' + esc(meal.tpl.name) + '</div>' +
        '<div class="mt">' + kk(meal.totals.kcal) + ' kcal · ' + Math.round(meal.totals.p) + ' g protein</div></div>' +
        (meal.alternatives && meal.alternatives.length
          ? '<button class="btn sm" data-act="sheet" data-v="swap" data-arg="' + m + '">Swap</button>' : '') +
        '</div>' +
        '<ul>' + meal.items.map(function (it) {
          return '<li><span class="q">' + esc(it.label) + '</span><span>' + esc(it.name) + '</span></li>';
        }).join('') + '</ul>' +
        '<div class="macros"><span><b>' + kk(meal.totals.kcal) + '</b> kcal</span><span><b>' + Math.round(meal.totals.p) + '</b> g protein</span>' +
        '<span><b>' + Math.round(meal.totals.c) + '</b> g carbs</span><span><b>' + Math.round(meal.totals.fat) + '</b> g fat</span>' +
        '<span><b>' + kk(meal.totals.na) + '</b> mg sodium</span></div>' +
        (meal.tpl.prep ? '<div class="note" style="border-top:1px solid var(--hair)">' + esc(meal.tpl.prep) + '</div>' : '') +
        '</div>';
    });

    out += extrasRow(v);

    if (plan.topUp && !plan.topUp.none) {
      out += '<div class="banner warning"><span class="ic">' + ICON.alert + '</span><div><b>' + plan.topUp.short +
        ' g of protein short today.</b> Add ' + esc(plan.topUp.label) + ' of ' + esc(plan.topUp.name) +
        ' (' + plan.topUp.kcal + ' kcal, +' + plan.topUp.p + ' g) and it is covered.</div></div>';
    }
    out += '<button class="btn full" data-act="tab" data-v="food" style="margin-top:4px">See the full breakdown and why</button>';
    return out + '</section>';
  }

  /* Drinks and the odd yogurt cup: counted, never planned. */
  function extrasRow(v) {
    const snacks = v.data.allowedFoods.filter(function (id) {
      const f = FOODS.items[id];
      return f && f.snack;
    });
    if (!snacks.length) return '';
    const logged = v.rec.extras || {};
    const ex = v.meals ? v.meals.extras : [];
    const caf = ex.reduce(function (s2, e) { return s2 + (e.m.caf || 0); }, 0);
    const kcal = ex.reduce(function (s2, e) { return s2 + e.m.kcal; }, 0);

    return '<div class="hr"></div><div class="eyebrow">Drinks &amp; extras today</div>' +
      '<p class="xs dim" style="margin:4px 0 8px">These count toward your day but are never planned for you.</p>' +
      snacks.map(function (id) {
        const f = FOODS.items[id];
        const n = logged[id] || 0;
        return '<div class="checkrow" style="padding:8px 0">' +
          '<div class="body"><div class="ttl">' + esc(f.name) + '</div>' +
          '<div class="xs dim">' + Math.round(f.kcal) + ' kcal' + (f.p >= 1 ? ' \u00b7 ' + f.p + ' g protein' : '') +
            (f.caf ? ' \u00b7 ' + f.caf + ' mg caffeine' : '') + ' each</div></div>' +
          '<div class="row" style="gap:6px">' +
            '<button class="iconbtn" data-act="extra" data-id="' + id + '" data-d="-1" aria-label="One fewer"' + (n ? '' : ' disabled') + '>' + ICON.minus + '</button>' +
            '<b class="num" style="min-width:18px;text-align:center">' + n + '</b>' +
            '<button class="iconbtn" data-act="extra" data-id="' + id + '" data-d="1" aria-label="One more">' + ICON.plus + '</button>' +
          '</div></div>';
      }).join('') +
      (kcal ? '<p class="xs dim">Extras today: ' + kk(kcal) + ' kcal' + (caf ? ', ' + kk(caf) + ' mg caffeine' : '') + '.' +
        (caf > 400 ? ' <b style="color:var(--critical)">That is past the 400 mg a day FDA names as the ceiling for healthy adults.</b>' :
         caf >= 200 ? ' One more can would reach the 400 mg daily ceiling.' : '') + '</p>' : '');
  }

  /* ---------------- partner strip ---------------- */
  function partnerStrip(v) {
    const pk = S.partnerKey(), pd = S.person(pk), name = S.DISPLAY[pk];
    const rec = pd.days[ui.date] || {};
    const meals = rec.meals || {};
    const mealsDone = ['b', 'l', 'd'].filter(function (m) { return meals[m]; }).length;
    const gymDone = !!(rec.workout && rec.workout.done);
    const nudges = S.incomingNudges();

    let out = '';
    if (nudges.length) {
      out += '<div class="banner love"><span class="ic">' + ICON.heart + '</span><div><b>' + esc(name) + ' says:</b><br>' +
        nudges.map(function (n) { return esc(n.text); }).join('<br>') +
        '<br><button class="linkbtn" data-act="clear-nudges" style="margin-top:6px">Got it</button></div></div>';
    }
    out += '<section class="card tight"><div class="person" style="padding-top:4px">' +
      '<div class="ring">' + ringSvg(((rec.w > 0 ? 1 : 0) + mealsDone + (gymDone ? 1 : 0)) / 5, pk) +
      '<span class="lbl">' + (((rec.w > 0 ? 1 : 0) + mealsDone + (gymDone ? 1 : 0))) + '/5</span></div>' +
      '<div class="pi"><div class="nm"><span class="swatch" style="background:var(--' + pk + ')"></span>' + esc(name) + ' today</div>' +
      '<div class="small muted">' + (rec.w > 0 ? lb(rec.w) + ' lb logged' : 'no weigh-in yet') + ' · ' +
      mealsDone + '/3 meals · ' + (gymDone ? 'gym done' : 'gym not logged') + '</div></div>' +
      '<button class="btn sm" data-act="sheet" data-v="nudge">Nudge</button>' +
      '</div></section>';
    return out;
  }

  function ringSvg(frac, personKey) {
    const r = 26, cx = 31, circ = 2 * Math.PI * r;
    const f = Math.max(0, Math.min(1, frac || 0));
    return '<svg width="62" height="62" viewBox="0 0 62 62" aria-hidden="true">' +
      '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="var(--grid)" stroke-width="6"/>' +
      '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="var(--' + personKey + ')" stroke-width="6" ' +
      'stroke-linecap="round" stroke-dasharray="' + (circ * f).toFixed(1) + ' ' + circ.toFixed(1) + '"/></svg>';
  }

  function yesterdaySodium(v) {
    const y = N.addDays(ui.date, -1);
    const rec = v.data.days[y];
    if (!rec || !rec.meals || !v.tgt.ok) return 0;
    const ate = ['b', 'l', 'd'].filter(function (m) { return rec.meals[m]; });
    if (!ate.length) return 0;
    const plan = N.planDay(v.key, y, v.tgt, v.data.allowedFoods, rec.mealPick || {});
    if (!plan) return 0;
    return ate.reduce(function (s, m) { return s + (plan.meals[m] ? plan.meals[m].totals.na : 0); }, 0);
  }

  /** The coach is allowed to change the plan by itself, once a week, logged. */
  function maybeAutoAdjust(v, sum) {
    const adj = sum.adjustment;
    if (!adj || !adj.change) return;
    const last = v.data.adjust || {};
    if (last.at === ui.date) return;
    /* applied after this render finishes, so the screen is never built from
       half-old numbers */
    setTimeout(function () {
      const cur = S.me().adjust || {};
      if (cur.at === ui.date) return;
      S.applyAdjustment(adj, ui.date, sum.verdict.key);
    }, 0);
  }

  /* =======================================================================
     PLAN
     ======================================================================= */
  function planTab(v) {
    const start = N.todayStr();
    const sessions = [];
    for (let i = 0; i < 7; i++) {
      const dt = N.addDays(start, i);
      sessions.push(S.view(dt, v.key).session);
    }
    const st = P.weeklyStats(sessions);

    let out = '<section class="card">' +
      '<header><div><div class="eyebrow">Next seven days</div><h2>' + mins(st.totalMinutes) + ' in the gym</h2></div></header>' +
      sessions.map(function (s, i) {
        const dt = s.date;
        const rec = S.day(dt, v.key) || {};
        const isToday = i === 0;
        return '<div class="block"><div class="bh">' +
          '<span class="kindtag">' + (s.kind === 'rest' ? 'rest' : s.kind === 'cardio' ? 'cardio' : 'lift') + '</span>' +
          '<span class="bt">' + esc(h.relDay(dt)) + ' · ' + esc(s.focusShort) + '</span>' +
          '<span class="bm">' + (s.kind === 'rest' ? 'off' : mins(s.totalMinutes)) + '</span></div>' +
          '<div class="note">' + (s.kind === 'rest' ? esc(s.reason) :
            s.cardioMinutes + ' min cardio' + (s.strengthMinutes ? ' · ' + s.strengthMinutes + ' min lifting · ' + s.itemCount + ' exercises' : '') +
            ' · ~' + kk(s.estKcal) + ' kcal') + '</div>' +
          '<div class="note" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
            '<span class="xs dim">Time that day:</span>' +
            P.BUDGET_CHOICES.map(function (b) {
              return '<button class="chip sm" data-act="set-budget" data-d="' + dt + '" data-v="' + b + '" aria-pressed="' +
                ((rec.budget || v.profile.defaultBudget || 60) === b) + '">' + mins(b) + '</button>';
            }).join('') +
            (isToday ? '' : '') +
          '</div></div>';
      }).join('') +
      '</section>';

    out += '<section class="card"><header><div><div class="eyebrow">Against the CDC guideline</div>' +
      '<h2>How this week measures up</h2></div></header>' +
      '<div class="grid2">' +
        stat('Aerobic', st.equiv + ' min', 'CDC asks 150; ' + (st.aerobicBonus ? 'you are past 300 too' : st.aerobicMet ? 'cleared' : 'short')) +
        stat('Strength days', st.strengthDays + ' of 7', 'CDC asks 2+') +
      '</div>' +
      '<p class="small" style="margin-top:12px">CDC counts a vigorous minute as two moderate ones, so your ' + st.moderate +
      ' moderate and ' + st.vigorous + ' vigorous minutes come to <b>' + st.equiv + ' equivalent minutes</b>. ' +
      'The guideline is at least 150 a week, with extra benefit past 300 — and CDC points at the higher end specifically when the goal is weight loss.</p>' +
      '<div class="hr"></div><div class="eyebrow">Every major muscle group, CDC’s list</div>' +
      '<div class="row wrap" style="margin-top:8px">' +
        CDC.ACTIVITY.muscleGroups.map(function (g) {
          const hit = st.covered.indexOf(g) >= 0;
          return '<span class="pill ' + (hit ? 'good' : 'warning') + '">' + (hit ? ICON.check : ICON.alert) +
            CDC.ACTIVITY.groupLabels[g] + '</span>';
        }).join('') +
      '</div>' +
      (st.coverageMet
        ? '<p class="xs dim" style="margin-top:10px">All seven covered. That is the muscle-strengthening half of the guideline met properly, not just technically.</p>'
        : '<p class="xs dim" style="margin-top:10px">Missing: ' + st.missing.join(', ') + '. Give a longer session to the day that covers them.</p>') +
      '</section>';

    out += '<section class="card"><header><h2>How the week is laid out</h2></header>' +
      '<p class="small">Monday chest and triceps, Tuesday back and biceps, Wednesday legs and glutes, Thursday shoulders and arms, ' +
      'Friday core and conditioning, Saturday full body, Sunday active recovery. Abs get a finisher on most days because you both want them, ' +
      'and because they respond to frequency.</p>' +
      '<p class="small"><b>Why a recovery day at all,</b> when the deal was every single day: muscle is repaired between sessions, not during them. ' +
      'Sunday still gets you to the gym for an hour — easy cardio and mobility — so the streak survives and the progress does too. ' +
      'Every fourth Sunday is a true day off. You can override either one on the day.</p>' +
      '<p class="small"><b>Cardio always comes after the lifting</b> on normal days, because doing it first measurably costs you strength on the bar. ' +
      'On a session of two hours or more it gets split: a short easy bout first, the rest at the end.</p>' +
      '</section>';
    return out;
  }

  /* =======================================================================
     FOOD
     ======================================================================= */
  function foodTab(v) {
    if (!v.tgt.ok) {
      return '<section class="card"><h2>Add two numbers first</h2><p class="small">' + esc(v.tgt.note) + '</p>' +
        '<button class="btn primary" data-act="sheet" data-v="profile">Open profile</button></section>';
    }
    const t = v.tgt, plan = v.meals;
    const feas = N.proteinFeasibility(v.data.allowedFoods, t);

    let out = '<section class="card">' +
      '<header><div><div class="eyebrow">Today’s numbers</div><h2>' + kk(t.intake) + ' kcal</h2></div></header>' +
      '<div class="grid3">' +
        stat('Resting', kk(t.bmr), 'Mifflin-St Jeor') +
        stat('Daily living', '+' + kk(t.nonExercise), 'non-exercise') +
        stat('Today’s gym', '+' + kk(t.exercise), 'CDC estimate') +
      '</div>' +
      '<div class="grid2" style="margin-top:10px">' +
        stat('Maintenance', kk(t.maintenance) + ' kcal', 'what holds your weight') +
        stat('Deficit', kk(t.actualDeficit) + ' kcal', CDC.WEIGHT.minDailyDeficit + '–' + CDC.WEIGHT.maxDailyDeficit + ' is CDC’s band') +
      '</div>' +
      '<p class="small" style="margin-top:12px">' +
        'To land ' + Math.round(t.toLose) + ' lb in ' + Math.round(t.weeksLeft) + ' weeks you would lose <b>' + lb(t.neededRate) + ' lb a week</b> — ' +
        esc(t.rateVerdict.label) + '. One pound is about 3,500 calories, so that is a <b>' + kk(t.deficitWanted) + ' kcal a day</b> deficit.' +
      '</p>' +
      (t.deficitCappedByCdc ? '<div class="banner warning"><span class="ic">' + ICON.alert + '</span><div>' +
        'That needs more than CDC’s 1,000 kcal a day ceiling, so it has been capped there. The finish date moves instead — see Progress.</div></div>' : '') +
      (t.deficitCappedByRecomp ? '<div class="banner neutral"><span class="ic">' + ICON.info + '</span><div>' +
        'Capped at 600 kcal because you are trying to build muscle at the same time. A bigger deficit would cost you the muscle you are training for.</div></div>' : '') +
      (t.floored ? '<div class="banner warning"><span class="ic">' + ICON.alert + '</span><div>' +
        '<b>Held at your floor of ' + kk(t.floor) + ' kcal.</b> The maths wanted to go lower; this app will not. The date moves, your food does not.</div></div>' : '') +
      (t.adjustKcal ? '<p class="xs dim">Includes a ' + sgn(t.adjustKcal, 0) + ' kcal adjustment the coach made after reviewing your trend.</p>' : '') +
      '</section>';

    /* ---- the honest protein card ---- */
    out += '<section class="card">' +
      '<header><div><div class="eyebrow">Protein</div><h2>' + t.protein.target + ' g a day</h2></div>' +
      '<span class="pill ' + (feas && feas.feasible ? 'good' : 'serious') + '">' +
      (feas && feas.feasible ? ICON.check : ICON.alert) + (feas && feas.feasible ? 'Reachable' : 'Not reachable yet') + '</span></header>' +
      '<p class="small">The DRI minimum for your bodyweight is <b>' + t.protein.dri + ' g</b> — that is the floor for not being deficient. ' +
      'The <b>' + t.protein.target + ' g</b> target comes from the sports-nutrition range (' + t.protein.perKg +
      ' g per kg), and it is the number that decides whether you lose fat <i>and keep the muscle underneath it</i>. ' +
      'Abs are muscle you already have, uncovered. Lose the muscle and there is nothing to uncover.</p>';

    if (feas && !feas.feasible) {
      out += '<div class="banner serious"><span class="ic">' + ICON.alert + '</span><div>' +
        '<b>Here is the honest arithmetic.</b> On your current food list, eating ' + kk(t.intake) + ' calories, the most protein you can ' +
        'realistically reach is about <b>' + feas.practical + ' g</b> — and that is being generous, since it assumes a lot of your best ' +
        'option (' + esc(feas.ceiling.name) + '). You need ' + t.protein.target + ' g. ' +
        'It is not willpower; the foods simply do not carry it. Frozen nuggets are roughly 40% fat by calories.' +
        (feas.meetsDri ? ' You will clear the ' + t.protein.dri + ' g DRI minimum easily, so this is not about being deficient — it is about the abs.' : '') +
        '</div></div>';
      if (feas.unlocks.length) {
        out += '<div class="eyebrow">The smallest things that fix it</div>' +
          feas.unlocks.map(function (u) {
            return '<div class="checkrow"><button class="check" data-act="food-toggle" data-id="' + u.id + '" aria-pressed="false" aria-label="Add">' + ICON.plus + '</button>' +
              '<div class="body"><div class="ttl">' + esc(u.name) + '</div>' +
              '<div class="xs dim">' + esc(u.why) + ' Ticking this takes your ceiling to about ' + u.practical + ' g.</div></div></div>';
          }).join('') +
          '<p class="xs dim" style="margin-top:8px">Pick either one. You do not have to like vegetables, drink smoothies, or stop eating nuggets and fries — they are still in every day of your plan.</p>';
      }
    } else if (feas) {
      out += '<div class="banner good"><span class="ic">' + ICON.check + '</span><div>Your food list can carry about ' +
        feas.practical + ' g of protein at ' + kk(t.intake) + ' calories, against a ' + t.protein.target + ' g target. That works.</div></div>';
    }
    out += '</section>';

    /* ---- today's plan vs CDC's description of healthy eating ---- */
    out += '<section class="card">' +
      '<header><div><div class="eyebrow">Today’s plan, totalled</div><h2>' + kk(plan.totals.kcal) + ' kcal · ' + Math.round(plan.totals.p) + ' g protein</h2></div></header>' +
      '<div class="grid3">' +
        stat('Calories', kk(plan.totals.kcal), sgn(plan.kcalDelta, 0) + ' vs target') +
        stat('Protein', Math.round(plan.totals.p) + ' g', sgn(plan.proteinDelta, 0) + ' g vs target') +
        stat('Fiber', Math.round(plan.totals.fib) + ' g', 'DRI ' + t.fiber + ' g') +
        stat('Sodium', kk(plan.totals.na) + ' mg', 'limit ' + kk(CDC.SODIUM_LIMIT)) +
        stat('Carbs', Math.round(plan.totals.c) + ' g', '') +
        stat('Fat', Math.round(plan.totals.fat) + ' g', '') +
      '</div>';

    if (plan.gap.gaps.length) {
      out += '<div class="hr"></div><div class="eyebrow">Where this sits against CDC’s healthy eating plan</div>' +
        '<ul class="feed" style="margin-top:6px">' + plan.gap.gaps.map(function (g) {
          return '<li><span style="flex:none;color:var(--warning)">▲</span><span>' + esc(g.text) + '</span></li>';
        }).join('') + '</ul>' +
        '<p class="xs dim">CDC describes a healthy plan as one that leans on fruit, vegetables, whole grains and low-fat dairy, ' +
        'includes lean protein, and stays low in saturated fat, added sugar and sodium. Yours does not, yet. ' +
        'That is said plainly and once — not to nag, but because it is true and you should hear it from the app rather than from a doctor later. ' +
        'Nothing here forces a vegetable on you.</p>';
    } else {
      out += '<div class="banner good"><span class="ic">' + ICON.check + '</span><div>Today’s plan lines up with CDC’s description of a healthy eating pattern.</div></div>';
    }
    out += '</section>';

    out += '<section class="card">' + h.foodSetupBody(false) + '</section>';
    out += sourcesCard();
    return out;
  }


  /* =======================================================================
     GROCERY
     ======================================================================= */
  function groceryTab(v) {
    const G = FIT.GROCERY;
    const from = G.weekStart(ui.date);
    const l = G.list(from, 7);
    const end = N.addDays(from, 6);
    const pan = S.pantry();

    let out = '<section class="card">' +
      '<header><div><div class="eyebrow">' + esc(G.pretty(from)) + ' \u2014 ' + esc(G.pretty(end)) + '</div>' +
      '<h2>' + (l.toBuy.length ? l.toBuy.length + ' to buy' : 'Nothing to buy') + '</h2></div>' +
      '<span class="pill ' + (l.toBuy.length ? 'warning' : 'good') + '">' +
        (l.toBuy.length ? ICON.cart : ICON.check) + (l.toBuy.length || 'all set') + '</span></header>' +
      '<p class="small muted">Worked out from the next seven days of both your meal plans, minus what the kitchen already has. ' +
      'Meals you have already ticked off are not counted again.</p>' +
      '<div class="row wrap" style="margin-top:10px">' +
        '<button class="btn sm" data-act="grocery-copy">' + ICON.copy + ' Copy list</button>' +
        '<button class="btn sm" data-act="grocery-share">' + ICON.share + ' Share</button>' +
        '<button class="btn sm" data-act="grocery-mail">Email it</button>' +
      '</div>';

    if (!l.toBuy.length) {
      out += '<div class="banner good" style="margin-bottom:0"><span class="ic">' + ICON.check + '</span><div>' +
        'Everything this week\u2019s meals need is already counted in the kitchen. Mark something low below and it will appear here.</div></div>';
    } else {
      G.byAisle(l.toBuy).forEach(function (a) {
        out += '<div class="hr"></div><div class="eyebrow">' + esc(a.label) + '</div>' +
          a.rows.map(function (r) { return buyRow(r); }).join('');
      });
    }
    out += '</section>';

    /* what is in the kitchen */
    const tracked = l.rows.filter(function (r) { return r.tracked; });
    out += '<section class="card">' +
      '<header><div><div class="eyebrow">The kitchen</div><h2>What you have</h2></div></header>' +
      '<p class="small muted">Put in what you have after a shop and the list does the subtraction for you. ' +
      'Ticking a meal off takes it back out automatically.</p>' +
      (tracked.length
        ? tracked.map(function (r) { return stockRow(r, pan[r.id]); }).join('')
        : '<p class="small dim" style="margin-top:10px">Nothing counted yet. Add something below.</p>') +
      '<div class="hr"></div>' +
      '<button class="btn full" data-act="sheet" data-v="pantry">Add or change what is in the kitchen</button>' +
      '</section>';

    /* running low, from either of you */
    const low = l.rows.filter(function (r) { return r.low; });
    out += '<section class="card">' +
      '<header><div><div class="eyebrow">Running low</div><h2>' + (low.length || 'Nothing') + ' flagged</h2></div></header>' +
      '<p class="small muted">Either of you can flag something. It shows on both phones and goes straight onto the list.</p>' +
      (low.length ? low.map(function (r) {
        return '<div class="checkrow"><div class="body"><div class="ttl">' + esc(r.name) + '</div>' +
          '<div class="xs dim">flagged by ' + esc(S.DISPLAY[(pan[r.id] || {}).by] || '\u2014') + '</div></div>' +
          '<button class="btn sm" data-act="low" data-id="' + r.id + '" data-v="0">Got it</button></div>';
      }).join('') : '') +
      '<div class="hr"></div>' +
      '<button class="btn full" data-act="sheet" data-v="low">Flag something as low</button>' +
      '</section>';

    out += '<section class="card tight"><div class="eyebrow">Weekly list</div>' +
      '<p class="small" style="margin:6px 0">A fresh list appears here every Monday, and the app opens it for you the first time ' +
      'you use it that week. Reminders also pop it up if you have them switched on.</p>' +
      '<p class="xs dim">Straight answer on the email: with no server behind it, the app cannot post you mail by itself. ' +
      '<b>Email it</b> opens your mail app with the whole list already written, addressed and ready to send.</p>' +
      '<button class="btn sm" data-act="sheet" data-v="weeklist">Show this week\u2019s list now</button>' +
      '</section>';
    return out;
  }

  function buyRow(r) {
    const qty = r.pkg && r.packages ? r.packages + ' \u00d7 ' + r.pkg.label : r.shortLabel;
    const who = [];
    if (r.byPerson.danil > 0.05) who.push('Danil');
    if (r.byPerson.towne > 0.05) who.push('Towne');
    return '<div class="checkrow">' +
      '<div class="body"><div class="ttl">' + esc(r.name) + '</div>' +
      '<div class="xs dim">' +
        (r.pkg && r.packages ? esc(qty) + ' \u00b7 ' : '') +
        'week needs ' + esc(r.needLabel) +
        (r.tracked ? ' \u00b7 have ' + esc(FOODS.qtyLabel(r.id, r.stock)) : ' \u00b7 not counted') +
        (who.length === 1 ? ' \u00b7 ' + who[0] + ' only' : '') +
        (r.low ? ' \u00b7 flagged low' : '') +
      '</div></div>' +
      '<b class="num" style="white-space:nowrap">' + esc(r.pkg && r.packages ? r.packages + '\u00d7' : r.shortLabel) + '</b>' +
      '</div>';
  }

  function stockRow(r, entry) {
    const pct = r.needUnits > 0 ? Math.min(100, Math.round(r.stock / r.needUnits * 100)) : 100;
    const tone = pct >= 100 ? 'good' : pct >= 50 ? 'warning' : 'critical';
    return '<div class="checkrow">' +
      '<div class="body"><div class="ttl">' + esc(r.name) + '</div>' +
      '<div class="xs dim">' + esc(FOODS.qtyLabel(r.id, r.stock)) + ' left \u00b7 this week needs ' + esc(r.needLabel) +
      (entry && entry.by ? ' \u00b7 last updated by ' + esc(S.DISPLAY[entry.by]) : '') + '</div></div>' +
      '<span class="pill ' + tone + '">' + (pct >= 100 ? ICON.check : ICON.alert) + pct + '%</span>' +
      '</div>';
  }


  function backupSheet() {
    const txt = S.exportText();
    const days = Object.keys(S.me().days).length;
    return '<h2>Back up &amp; restore</h2>' +
      '<div class="card tight"><div class="eyebrow">Copy out of this device</div>' +
      '<p class="small" style="margin:6px 0">Everything for ' + esc(S.DISPLAY[S.state.me]) + ' \u2014 ' + days +
      ' logged day' + (days === 1 ? '' : 's') + ', your profile, your food list and the kitchen.</p>' +
      '<textarea id="bkOut" readonly rows="4" class="code" style="width:100%;font-size:.68rem" ' +
      'onclick="this.select()">' + esc(txt) + '</textarea>' +
      '<button class="btn sm" data-act="copy" data-from="#bkOut">' + ICON.copy + ' Copy it all</button></div>' +

      '<div class="card tight"><div class="eyebrow">Paste into this device</div>' +
      '<p class="small" style="margin:6px 0">Paste a backup below. It is <b>merged</b>, never overwritten \u2014 ' +
      'days this device already has are kept, and anything new is added. Running it twice changes nothing.</p>' +
      '<form data-form="restore">' +
      '<textarea name="blob" rows="4" class="code" style="width:100%;font-size:.68rem" ' +
      'placeholder="Paste the backup here"></textarea>' +
      '<button class="btn primary full" type="submit">Merge it in</button></form></div>' +

      '<p class="xs dim">The hosted preview page and your own installed app are separate browsers as far as storage goes, ' +
      'so this is how history crosses between them.</p>';
  }

  function pantrySheet() {
    const G = FIT.GROCERY;
    const pan = S.pantry();
    const ids = G.trackable().sort(function (a, b) { return FOODS.name(a).localeCompare(FOODS.name(b)); });
    return '<h2>What is in the kitchen</h2>' +
      '<p class="small muted">Count in the food\u2019s own unit \u2014 nuggets, grams, cans, boxes. Leave anything blank that you do not want counted.</p>' +
      '<form data-form="pantry">' +
      ids.map(function (id) {
        const f = FOODS.items[id];
        const e = pan[id] || {};
        const val = typeof e.stock === 'number' ? e.stock : '';
        return '<div class="checkrow"><div class="body"><div class="ttl">' + esc(f.name) + '</div>' +
          '<div class="xs dim">counted in ' + esc(f.unit === 'g' ? 'grams' : f.unit + 's') +
          (f.pkg ? ' \u00b7 one ' + esc(f.pkg.label) + ' = ' + f.pkg.units : '') + '</div></div>' +
          '<input name="' + id + '" type="number" step="any" min="0" inputmode="decimal" value="' + val + '" ' +
          'style="width:84px;text-align:center;padding:8px;border-radius:9px;border:1px solid var(--hair);background:var(--page)" ' +
          'aria-label="' + esc(f.name) + ' in stock"></div>';
      }).join('') +
      '<button class="btn primary full" type="submit" style="margin-top:12px">Save</button></form>';
  }

  function lowSheet() {
    const G = FIT.GROCERY;
    const pan = S.pantry();
    const ids = G.trackable().sort(function (a, b) { return FOODS.name(a).localeCompare(FOODS.name(b)); });
    return '<h2>Running low</h2>' +
      '<p class="small muted">Tap anything that is nearly gone. It goes on the list and shows on both phones.</p>' +
      ids.map(function (id) {
        const on = !!(pan[id] || {}).low;
        return '<button class="checkrow" data-act="low" data-id="' + id + '" data-v="' + (on ? '0' : '1') + '" style="width:100%;text-align:left">' +
          '<span class="check" aria-pressed="' + on + '">' + ICON.check + '</span>' +
          '<span class="body"><span class="ttl">' + esc(FOODS.name(id)) + '</span></span></button>';
      }).join('');
  }

  function weekListSheet() {
    const G = FIT.GROCERY;
    const from = G.weekStart(ui.date);
    const l = G.list(from, 7);
    const end = N.addDays(from, 6);
    return '<h2>This week\u2019s list</h2>' +
      '<p class="small muted">' + esc(G.pretty(from)) + ' \u2014 ' + esc(G.pretty(end)) + '</p>' +
      (l.toBuy.length
        ? G.byAisle(l.toBuy).map(function (a) {
            return '<div class="eyebrow" style="margin-top:12px">' + esc(a.label) + '</div>' +
              a.rows.map(function (r) {
                return '<div class="checkrow" style="padding:8px 0"><div class="body"><div class="ttl">' + esc(r.name) + '</div>' +
                  '<div class="xs dim">' + esc(r.pkg && r.packages ? r.packages + ' \u00d7 ' + r.pkg.label : r.shortLabel) + '</div></div></div>';
              }).join('');
          }).join('')
        : '<div class="banner good"><span class="ic">' + ICON.check + '</span><div>Nothing needed. The kitchen covers the week.</div></div>') +
      '<div class="row wrap" style="margin-top:14px">' +
        '<button class="btn sm" data-act="grocery-copy">' + ICON.copy + ' Copy</button>' +
        '<button class="btn sm" data-act="grocery-share">' + ICON.share + ' Share</button>' +
        '<button class="btn sm" data-act="grocery-mail">Email it</button>' +
        '<button class="btn sm primary" data-act="grocery-seen">Done</button>' +
      '</div>';
  }

  /* =======================================================================
     PROGRESS
     ======================================================================= */
  function progressTab(v) {
    let out = '';
    S.PEOPLE.forEach(function (pk) {
      const pv = S.view(ui.date, pk);
      const tr = C.trend(pv.data.days, ui.date);
      const gs = C.goalSafety(pv.profile, pv.latest);
      const bmi = pv.latest && pv.profile.heightIn ? CDC.bmi(pv.latest, pv.profile.heightIn) : null;
      const cat = bmi ? CDC.bmiCategory(bmi) : null;
      const key = 'w-' + pk;

      out += '<section class="card">' +
        '<header><div><div class="eyebrow"><span class="swatch" style="background:var(--' + pk + ');display:inline-block;margin-right:5px"></span>' +
        esc(S.DISPLAY[pk]) + '</div><h2>' + lb(tr.avg7 != null ? tr.avg7 : pv.latest) + ' lb</h2></div>' +
        '<span class="pill neutral">goal ' + Math.round(pv.profile.goalWeight) + '</span></header>' +
        '<div class="grid3">' +
          stat('Now', lb(pv.latest) + ' lb', 'last weigh-in') +
          stat('Since start', tr.sinceStart != null ? sgn(tr.sinceStart) + ' lb' : '—', 'from ' + Math.round(pv.profile.startWeight)) +
          stat('To go', lb(Math.max(0, (tr.avg7 != null ? tr.avg7 : pv.latest) - pv.profile.goalWeight)) + ' lb', 'by ' + h.shortDate(pv.profile.goalDate)) +
        '</div>' +
        '<div class="legend"><span class="it"><span class="ln" style="background:var(--' + pk + ')"></span>7-day average</span>' +
        '<span class="it"><span class="ln" style="background:var(--' + pk + ');opacity:.35"></span>daily weigh-ins</span>' +
        '<span class="it"><span class="dash"></span>plan to goal</span></div>' +
        '<div data-chart=\'{"kind":"weight","person":"' + pk + '"}\'></div>' +
        '<button class="linkbtn" data-act="table-toggle" data-k="' + key + '" style="margin-top:6px">' +
        (ui.tables[key] ? 'Hide' : 'Show') + ' the numbers</button>' +
        (ui.tables[key] ? weightTable(pv, tr) : '') +
        (bmi ? '<div class="hr"></div><div class="eyebrow">CDC body mass index</div>' +
          '<p class="small" style="margin-top:6px"><b>' + bmi.toFixed(1) + '</b> — ' + esc(cat.label) + '. ' +
          'CDC’s healthy range for ' + Math.floor(pv.profile.heightIn / 12) + '′' + (pv.profile.heightIn % 12) + '″ is ' +
          Math.round(gs.healthyRange.lo) + '–' + Math.round(gs.healthyRange.hi) + ' lb. ' +
          'CDC is explicit that BMI is a screening measure and should be read alongside other things — it knows nothing about how much of you is muscle.</p>' +
          (gs.notes.length ? '<div class="banner good"><span class="ic">' + ICON.info + '</span><div>' + esc(gs.notes[0]) + '</div></div>' : '') +
          (gs.warnings.length ? gs.warnings.map(function (w) {
            return '<div class="banner warning"><span class="ic">' + ICON.alert + '</span><div>' + esc(w) + '</div></div>';
          }).join('') : '') : '') +
        waistBlock(pv) +
        '</section>';
    });

    out += '<section class="card">' +
      '<header><div><div class="eyebrow">Both of you, same axis</div><h2>Share of the goal closed</h2></div></header>' +
      '<p class="small muted">You weigh different amounts and want different things, so putting both weights on one axis would be meaningless. ' +
      'This indexes each of you to your own goal instead: 100% is done.</p>' +
      '<div class="legend">' + S.PEOPLE.map(function (pk) {
        return '<span class="it"><span class="ln" style="background:var(--' + pk + ')"></span>' + S.DISPLAY[pk] + '</span>';
      }).join('') + '<span class="it"><span class="dash"></span>goal</span></div>' +
      '<div data-chart=\'{"kind":"progress"}\'></div>' +
      '</section>';

    S.PEOPLE.forEach(function (pk) {
      out += '<section class="card">' +
        '<header><div><div class="eyebrow">' + esc(S.DISPLAY[pk]) + '</div><h2>Last 14 days logged</h2></div></header>' +
        '<p class="small muted">Each bar is how much of that day got done — weigh-in, three meals, the gym. Five out of five is a full bar.</p>' +
        '<div data-chart=\'{"kind":"adherence","person":"' + pk + '"}\'></div>' +
        '<div class="hr"></div>' +
        '<h3>Cardio minutes a week</h3>' +
        '<p class="small muted">Against CDC’s 150-minute line. Vigorous minutes count double, the way CDC counts them.</p>' +
        '<div data-chart=\'{"kind":"cardio","person":"' + pk + '"}\'></div>' +
        '</section>';
    });

    out += sourcesCard();
    return out;
  }

  function weightTable(pv, tr) {
    const pts = tr.points.slice(-21).reverse();
    if (!pts.length) return '<p class="small dim">Nothing logged yet.</p>';
    return '<table class="data"><thead><tr><th>Date</th><th>Weight</th><th>Change</th></tr></thead><tbody>' +
      pts.map(function (p, i) {
        const prev = pts[i + 1];
        return '<tr><td>' + h.shortDate(p.d) + '</td><td>' + lb(p.w) + '</td><td>' + (prev ? sgn(p.w - prev.w) : '—') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function waistBlock(pv) {
    const days = pv.data.days;
    const keys = Object.keys(days).filter(function (k) { return days[k] && days[k].waist > 0; }).sort();
    const limit = CDC.WAIST[pv.profile.sex === 'male' ? 'male' : 'female'];
    if (!keys.length) {
      return '<div class="hr"></div><div class="eyebrow">Waist</div>' +
        '<p class="small">Nothing measured yet. Worth doing weekly: when you are building muscle and losing fat at the same time, ' +
        'the scale can sit still for weeks while the waist keeps moving — and the waist is the one that tells you about the abs. ' +
        'CDC flags above ' + limit + '″ as higher risk for an adult ' + (pv.profile.sex === 'male' ? 'man' : 'woman') + '.</p>' +
        '<button class="btn sm" data-act="sheet" data-v="waist">Add a measurement</button>';
    }
    const first = days[keys[0]].waist, last = days[keys[keys.length - 1]].waist;
    return '<div class="hr"></div><div class="eyebrow">Waist</div>' +
      '<div class="grid3" style="margin-top:6px">' +
        stat('Now', lb(last) + '″', h.shortDate(keys[keys.length - 1])) +
        stat('Change', sgn(last - first) + '″', 'since ' + h.shortDate(keys[0])) +
        stat('CDC flag', 'above ' + limit + '″', 'higher risk') +
      '</div>';
  }

  function sourcesCard() {
    const ids = ['bmi', 'activity', 'losing', 'burn', 'waist', 'eating', 'sleep', 'dri', 'msj', 'compendium', 'usda'];
    return '<section class="card"><header><div><div class="eyebrow">Where the numbers come from</div>' +
      '<h2>Sources</h2></div></header>' +
      '<p class="small muted">Nothing in this app is invented. CDC figures say CDC; the ones that are not CDC say who they are, ' +
      'because mixing them silently would be the easiest way to mislead you.</p>' +
      '<ul class="sources">' + ids.map(function (id) {
        const s = CDC.SOURCES[id];
        if (!s) return '';
        return '<li><span class="org">' + esc(s.org) + '</span> — <a href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
          esc(s.title) + '</a></li>';
      }).join('') + '</ul></section>';
  }

  /* =======================================================================
     US
     ======================================================================= */
  function usTab(v) {
    let out = '<section class="card">' +
      '<header><div><div class="eyebrow">Today</div><h2>Both of you</h2></div></header>' +
      S.PEOPLE.map(function (pk) {
        const pd = S.person(pk);
        const rec = pd.days[ui.date] || {};
        const meals = rec.meals || {};
        const mealsDone = ['b', 'l', 'd'].filter(function (m) { return meals[m]; }).length;
        const gymDone = !!(rec.workout && rec.workout.done);
        const score = (rec.w > 0 ? 1 : 0) + mealsDone + (gymDone ? 1 : 0);
        const streak = C.logStreak(pd.days, ui.date);
        const tr = C.trend(pd.days, ui.date);
        return '<div class="person">' +
          '<div class="ring">' + ringSvg(score / 5, pk) + '<span class="lbl">' + score + '/5</span></div>' +
          '<div class="pi"><div class="nm"><span class="swatch" style="background:var(--' + pk + ')"></span>' + esc(S.DISPLAY[pk]) +
            (pk === S.state.me ? ' <span class="xs dim">(you)</span>' : '') + '</div>' +
            '<div class="small muted">' + (rec.w > 0 ? lb(rec.w) + ' lb' : 'no weigh-in') + ' · ' + mealsDone + '/3 meals · ' +
            (gymDone ? 'gym done' : 'gym open') + '</div>' +
            '<div class="xs dim">' + (streak > 0 ? streak + '-day logging streak' : 'streak broken') +
            (tr.avg7 != null ? ' · 7-day avg ' + lb(tr.avg7) + ' lb' : '') + '</div>' +
          '</div>' +
          (pk !== S.state.me ? '<button class="btn sm" data-act="sheet" data-v="nudge">Nudge</button>' : '') +
          '</div>';
      }).join('') +
      '</section>';

    /* the accountability feed, identical on both phones */
    const events = buildFeed();
    out += '<section class="card">' +
      '<header><div><div class="eyebrow">Last 14 days</div><h2>What got missed</h2></div>' +
      (events.length ? '<span class="pill ' + (events.length > 6 ? 'warning' : 'neutral') + '">' + events.length + '</span>'
                     : '<span class="pill good">' + ICON.check + 'Clean</span>') + '</header>' +
      (events.length
        ? '<ul class="feed">' + events.slice(0, 40).map(function (e) {
            return '<li><span class="when">' + esc(h.relDay(e.date)) + '</span>' +
              '<span><span class="swatch" style="background:var(--' + e.person + ');display:inline-block;margin-right:6px"></span>' +
              '<b>' + esc(S.DISPLAY[e.person]) + '</b> missed ' + esc(C.missLabel(e.items)) + '</span></li>';
          }).join('') + '</ul>'
        : '<p class="small">Nothing missed by either of you in two weeks. That is the whole point of this screen, and it is empty. Good.</p>') +
      '</section>';

    out += '<section class="card"><header><h2>How this works</h2></header>' +
      '<p class="small">You both see both sets of data — every weigh-in, every meal, every gym day. ' +
      'When either of you misses something, it shows up here on <i>both</i> phones. Not to make fun of anyone: ' +
      'so that neither of you can quietly slide for a week without the other noticing.</p>' +
      '<p class="small">A miss is counted after the hour has passed: breakfast after 11am, lunch after 3pm, dinner after 9pm, ' +
      'weigh-in after 11am, the gym after 10pm. Rest days never count as a missed gym day.</p>' +
      '<p class="small"><b>Nudges</b> are the supportive kind on purpose. There is no way in this app to send the other one something mean.</p>' +
      '</section>';

    if (S.state.me === 'danil') {
      out += '<section class="card"><header><div><div class="eyebrow">For Towne</div><h2>The daily note</h2></div></header>' +
        '<p class="small muted">One of these shows at the top of her Today screen every day, picked by the date. Today she sees:</p>' +
        '<div class="banner love"><span class="ic">' + ICON.heart + '</span><div><b>' + esc(C.loveNote(ui.date)) + '</b></div></div>' +
        '<p class="xs dim">' + C.LOVE.length + ' notes in rotation.</p></section>';
    }
    return out;
  }

  function buildFeed() {
    const out = [];
    S.PEOPLE.forEach(function (pk) {
      const pd = S.person(pk);
      const sessions = S.sessionsByDate(pk, N.addDays(ui.date, -13), 14);
      C.missesFor(pd.days, ui.date, 14, sessions, null, pd.profile.startDate).forEach(function (m) {
        out.push({ date: m.date, person: pk, items: m.items });
      });
    });
    return out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }

  U.attentionCount = function () {
    try {
      const f = buildFeed().filter(function (e) { return N.daysBetween(e.date, ui.date) <= 1; });
      return f.length + S.incomingNudges().length;
    } catch (e) { return 0; }
  };

  /* =======================================================================
     Charts
     ======================================================================= */
  U.drawChart = function (el, spec) {
    if (spec.kind === 'weight') return CH.weight(el, weightSpec(spec.person));
    if (spec.kind === 'progress') return CH.progress(el, progressSpec());
    if (spec.kind === 'adherence') return CH.bars(el, adherenceSpec(spec.person));
    if (spec.kind === 'cardio') return CH.bars(el, cardioSpec(spec.person));
  };

  function trailingAvg(points, win) {
    return points.map(function (p, i) {
      const lo = N.addDays(p.d, -(win - 1));
      const sel = points.filter(function (q, j) { return j <= i && q.d >= lo; });
      return { d: p.d, w: sel.reduce(function (s, q) { return s + q.w; }, 0) / sel.length };
    });
  }

  function weightSpec(pk) {
    const pd = S.person(pk), prof = pd.profile;
    const points = C.series(pd.days);
    const traj = [];
    const endDate = points.length ? (points[points.length - 1].d > prof.startDate ? points[points.length - 1].d : prof.goalDate) : prof.goalDate;
    const span = Math.max(1, N.daysBetween(prof.startDate, endDate));
    for (let i = 0; i <= span; i += Math.max(1, Math.round(span / 24))) {
      const d = N.addDays(prof.startDate, i);
      traj.push({ d: d, w: C.expectedWeight(prof, d) });
    }
    if (traj.length && traj[traj.length - 1].d !== endDate) traj.push({ d: endDate, w: C.expectedWeight(prof, endDate) });
    return {
      points: points, avg: points.length > 2 ? trailingAvg(points, 7) : [],
      traj: points.length ? traj : [], color: 'var(--' + pk + ')', height: 190
    };
  }

  function progressSpec() {
    return {
      series: S.PEOPLE.map(function (pk) {
        const pd = S.person(pk), prof = pd.profile;
        const pts = C.series(pd.days);
        const avg = pts.length > 2 ? trailingAvg(pts, 7) : pts;
        const total = prof.startWeight - prof.goalWeight;
        return {
          label: S.DISPLAY[pk], color: 'var(--' + pk + ')',
          points: total > 0 ? avg.map(function (p) { return { d: p.d, pct: (prof.startWeight - p.w) / total * 100 }; }) : []
        };
      }), height: 190
    };
  }

  function adherenceSpec(pk) {
    const pd = S.person(pk);
    const sessions = S.sessionsByDate(pk, N.addDays(ui.date, -13), 14);
    const bars = [];
    for (let i = 13; i >= 0; i--) {
      const d = N.addDays(ui.date, -i);
      const rec = pd.days[d] || {};
      const meals = rec.meals || {};
      const rest = sessions[d] && sessions[d].kind === 'rest';
      if (d < pd.profile.startDate) { bars.push({ label: h.shortDate(d), value: 0, text: 'before you started', tick: i === 13 || i === 0 || i === 7 ? h.dayOnly(d) : '', color: 'var(--' + pk + ')' }); continue; }
      const items = 1 + 3 + (rest ? 0 : 1);
      const got = (rec.w > 0 ? 1 : 0) + ['b', 'l', 'd'].filter(function (m) { return meals[m]; }).length +
        (rest ? 0 : (rec.workout && rec.workout.done ? 1 : 0));
      bars.push({
        label: h.shortDate(d), value: Math.round(got / items * 100),
        text: got + ' of ' + items + ' done' + (rest ? ' (rest day)' : ''),
        tick: i === 13 || i === 0 || i === 7 ? h.dayOnly(d) : '',
        color: 'var(--' + pk + ')'
      });
    }
    return { bars: bars, max: 100, suffix: '%', height: 120, color: 'var(--' + pk + ')' };
  }

  function cardioSpec(pk) {
    const pd = S.person(pk);
    const bars = [];
    for (let w = 7; w >= 0; w--) {
      const end = N.addDays(ui.date, -w * 7);
      let moderate = 0, vigorous = 0;
      const sessions = S.sessionsByDate(pk, N.addDays(end, -6), 7);
      for (let i = 6; i >= 0; i--) {
        const d = N.addDays(end, -i);
        const rec = pd.days[d] || {};
        if (!(rec.workout && rec.workout.done)) continue;
        const s = sessions[d];
        if (rec.workout.cardio != null && s) {
          const ratio = s.cardioMinutes > 0 ? rec.workout.cardio / s.cardioMinutes : 1;
          moderate += s.moderateMinutes * ratio; vigorous += s.vigorousMinutes * ratio;
        } else if (s) { moderate += s.moderateMinutes; vigorous += s.vigorousMinutes; }
      }
      const equiv = Math.round(CDC.aerobicEquivalent(moderate, vigorous));
      bars.push({
        label: 'week to ' + h.dayOnly(end), value: equiv,
        text: equiv + ' equivalent min (' + Math.round(moderate) + ' moderate, ' + Math.round(vigorous) + ' vigorous)',
        tick: w === 7 || w === 0 ? h.dayOnly(end) : '',
        color: 'var(--' + pk + ')'
      });
    }
    return {
      bars: bars, max: Math.max(160, CDC.ACTIVITY.moderateMinPerWeek), height: 120,
      color: 'var(--' + pk + ')',
      reference: { value: CDC.ACTIVITY.moderateMinPerWeek, label: 'CDC 150 min' }
    };
  }

  /* =======================================================================
     Sheets
     ======================================================================= */
  U.sheetView = function (sheet) {
    const body = sheetBody(sheet);
    return '<div class="scrim" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true">' +
      '<div class="inner"><div class="grab"></div>' +
      '<button class="iconbtn sheet-x" data-act="sheet-close" aria-label="Close">' + ICON.close + '</button>' +
      body + '</div></div>';
  };

  function sheetBody(sheet) {
    const v = S.view(ui.date);
    if (sheet.name === 'weight') {
      return '<h2>Today’s weight</h2>' +
        '<form data-form="weigh"><div class="weighin" style="margin:12px 0">' +
        '<input name="w" type="number" step="0.1" min="50" max="600" inputmode="decimal" value="' + (v.rec.w || '') + '" required autofocus>' +
        '<button class="btn primary" type="submit">Save</button></div></form>' +
        '<p class="xs dim">Same conditions every day is what makes the trend line mean anything — morning, after the bathroom, before food.</p>';
    }
    if (sheet.name === 'waist') {
      const limit = CDC.WAIST[v.profile.sex === 'male' ? 'male' : 'female'];
      return '<h2>Waist</h2>' +
        '<p class="small muted">Tape at the top of your hip bone, level all the way round, relaxed, after breathing out. Once a week is plenty.</p>' +
        '<form data-form="waist"><div class="weighin" style="margin:12px 0">' +
        '<input name="waist" type="number" step="0.1" min="15" max="80" inputmode="decimal" value="' + (v.rec.waist || '') + '" required autofocus>' +
        '<button class="btn primary" type="submit">Save</button></div></form>' +
        '<p class="xs dim">CDC flags a waist above ' + limit + '″ for an adult ' + (v.profile.sex === 'male' ? 'man' : 'woman') +
        ' as higher risk for obesity-related conditions.</p>';
    }
    if (sheet.name === 'swap') {
      const m = sheet.arg, meal = v.meals && v.meals.meals[m];
      if (!meal) return '<h2>Nothing to swap</h2>';
      return '<h2>Swap ' + N.MEAL_LABEL[m].toLowerCase() + '</h2>' +
        '<p class="small muted">Built from your food list only, scaled to the same calorie target.</p>' +
        '<div class="checkrow"><button class="check" aria-pressed="true" data-act="pick-meal" data-m="' + m + '" data-id="">' + ICON.check + '</button>' +
        '<div class="body"><div class="ttl">' + esc(meal.tpl.name) + '</div><div class="xs dim">' + kk(meal.totals.kcal) + ' kcal · ' +
        Math.round(meal.totals.p) + ' g protein · currently chosen</div></div></div>' +
        meal.alternatives.map(function (a) {
          return '<div class="checkrow"><button class="check" aria-pressed="false" data-act="pick-meal" data-m="' + m + '" data-id="' + a.id + '">' + ICON.check + '</button>' +
            '<div class="body"><div class="ttl">' + esc(a.name) + '</div><div class="xs dim">' + kk(a.kcal) + ' kcal · ' + a.p + ' g protein</div></div></div>';
        }).join('') +
        (v.rec.mealPick && v.rec.mealPick[m] ? '<button class="btn full" data-act="pick-meal" data-m="' + m + '" data-id="" style="margin-top:10px">Back to the automatic pick</button>' : '');
    }
    if (sheet.name === 'nudge') {
      return '<h2>Nudge ' + esc(S.DISPLAY[S.partnerKey()]) + '</h2>' +
        '<p class="small muted">Supportive only — that was the deal.</p>' +
        C.NUDGES.map(function (t) {
          return '<button class="checkrow" data-act="send-nudge" data-text="' + esc(t) + '" style="width:100%;text-align:left">' +
            '<span class="check">' + ICON.plus + '</span><span class="body"><span class="ttl">' + esc(t) + '</span></span></button>';
        }).join('');
    }
    if (sheet.name === 'backup') return backupSheet();
    if (sheet.name === 'pantry') return pantrySheet();
    if (sheet.name === 'low') return lowSheet();
    if (sheet.name === 'weeklist') return weekListSheet();
    if (sheet.name === 'profile') return profileSheet(v);
    if (sheet.name === 'settings') return settingsSheet(v);
    if (sheet.name === 'sync') return syncSheet();
    return '<h2>—</h2>';
  }

  function profileSheet(v) {
    const prof = v.profile;
    const ft = prof.heightIn ? Math.floor(prof.heightIn / 12) : '';
    const inch = prof.heightIn ? prof.heightIn % 12 : '';
    return '<h2>Your details</h2>' +
      '<form data-form="profile">' +
        '<div class="field"><label>Height</label><div class="row">' +
          '<input name="ft" type="number" min="3" max="7" value="' + ft + '" placeholder="ft" style="text-align:center" required>' +
          '<input name="in" type="number" min="0" max="11" value="' + inch + '" placeholder="in" style="text-align:center" required>' +
        '</div></div>' +
        '<div class="field"><label>Age</label><input name="age" type="number" min="13" max="100" value="' + (prof.age || '') + '" required></div>' +
        '<div class="field"><label>Sex (for the resting-energy formula only)</label><select name="sex">' +
          '<option value="female"' + (prof.sex === 'female' ? ' selected' : '') + '>Female</option>' +
          '<option value="male"' + (prof.sex === 'male' ? ' selected' : '') + '>Male</option></select></div>' +
        '<div class="field"><label>Goal weight (lb)</label><input name="goal" type="number" step="0.1" value="' + prof.goalWeight + '" required></div>' +
        '<div class="field"><label>Goal date</label><input name="date" type="date" value="' + prof.goalDate + '" required></div>' +
        '<div class="field"><label>What you are after</label><select name="type">' +
          '<option value="fatloss"' + (prof.goalType === 'fatloss' ? ' selected' : '') + '>Lose fat, keep muscle, visible abs</option>' +
          '<option value="recomp"' + (prof.goalType === 'recomp' ? ' selected' : '') + '>Lose fat and build muscle (six-pack)</option>' +
        '</select></div>' +
        '<div class="field"><label>Normal gym session</label><select name="budget">' +
          P.BUDGET_CHOICES.map(function (b) {
            return '<option value="' + b + '"' + ((prof.defaultBudget || 60) === b ? ' selected' : '') + '>' + mins(b) + '</option>';
          }).join('') + '</select></div>' +
        '<button class="btn primary full" type="submit">Save</button>' +
      '</form>';
  }

  function settingsSheet(v) {
    const st = S.state.sync;
    const notifyOn = S.state.prefs.notify && window.Notification && Notification.permission === 'granted';
    const theme = S.state.prefs.theme || 'auto';
    return '<h2>Settings</h2>' +
      '<div class="card tight"><div class="eyebrow">Signed in as</div>' +
      '<div class="row" style="margin-top:6px"><span class="swatch" style="background:var(--' + S.state.me + ')"></span>' +
      '<b>' + esc(S.DISPLAY[S.state.me]) + '</b><span class="xs dim">' +
      (A.mode === 'firebase' && A.user ? esc(A.user.email || '') : 'passcode on this device') + '</span>' +
      '<div style="flex:1"></div><button class="btn sm danger" data-act="signout">Sign out</button></div></div>' +

      '<div class="card tight"><div class="eyebrow">Sync</div>' +
      '<p class="small" id="syncLine" style="margin:6px 0">' + esc(S.SYNC_LABEL[st.status] || '') + '</p>' +
      (st.status === 'denied' || st.status === 'error'
        ? '<div class="banner warning"><span class="ic">' + ICON.alert + '</span><div>' + esc(st.detail || '') + '</div></div>' : '') +
      '<button class="btn sm" data-act="sheet" data-v="sync">Sync setup &amp; database rules</button></div>' +

      '<div class="card tight"><div class="eyebrow">Reminders</div>' +
      '<p class="small" style="margin:6px 0">' + (notifyOn
        ? 'On. You will be reminded about unlogged meals and the gym, and told when ' + esc(S.DISPLAY[S.partnerKey()]) + ' misses something.'
        : 'Off. Turn these on to get reminded about meals, the weigh-in and the gym.') + '</p>' +
      (notifyOn ? '<button class="btn sm" data-act="notify-off">Turn off</button>'
                : '<button class="btn sm primary" data-act="notify-on">Turn on reminders</button>') +
      '<p class="xs dim" style="margin-top:8px">Straight answer about how these work: they fire while the app is open or ' +
      'freshly reopened. Real background push would need a server, which this does not have. ' +
      'On iPhone you have to add the app to your home screen first.</p></div>' +

      '<div class="card tight"><div class="eyebrow">Appearance</div><div class="row wrap" style="margin-top:6px">' +
        ['auto', 'light', 'dark'].map(function (t) {
          return '<button class="chip sm" data-act="theme" data-v="' + t + '" aria-pressed="' + (theme === t) + '">' + t + '</button>';
        }).join('') + '</div></div>' +

      '<div class="card tight"><div class="eyebrow">Add to home screen</div>' +
      '<p class="small" style="margin:6px 0">Installs like an app, opens full screen, works offline.</p>' +
      '<button class="btn sm" data-act="install">How / install</button></div>' +

      '<div class="card tight"><div class="eyebrow">Your plan</div>' +
      '<button class="btn sm" data-act="sheet" data-v="profile">Height, age, goal, gym time</button> ' +
      '<button class="btn sm" data-act="tab-close" data-v="food">Food list</button></div>' +

      (v.data.adjust && v.data.adjust.history && v.data.adjust.history.length
        ? '<div class="card tight"><div class="eyebrow">Plan changes the coach has made</div><ul class="feed">' +
          v.data.adjust.history.slice(-8).reverse().map(function (x) {
            return '<li><span class="when">' + esc(h.shortDate(x.at)) + '</span><span>' +
              (x.kcal ? sgn(x.kcal, 0) + ' kcal ' : '') + (x.cardio ? '+' + x.cardio + ' min cardio' : '') +
              '<br><span class="xs dim">' + esc(x.reason || '') + '</span></span></li>';
          }).join('') + '</ul>' +
          '<p class="xs dim">Running total: ' + sgn(v.data.adjust.kcal || 0, 0) + ' kcal, +' + (v.data.adjust.cardio || 0) + ' min cardio a day. ' +
          '<button class="linkbtn" data-act="reset-adjust">Reset</button></p></div>'
        : '') +

      '<div class="card tight"><div class="eyebrow">Your data</div>' +
      '<p class="small" style="margin:6px 0">Copy everything out of this device, or paste it into another one. ' +
      'Use this to carry your history to a new phone, or across from the preview page.</p>' +
      '<button class="btn sm" data-act="sheet" data-v="backup">Back up / restore</button></div>' +

      '<div class="card tight"><div class="eyebrow">Replay</div>' +
      '<button class="btn sm" data-act="replay-welcome">Show the welcome screen again</button></div>' +

      '<p class="xs dim" style="margin-top:14px">Built by Danil, for Danil and Towne. ' +
      'Health figures from CDC and other named sources — see Sources in the Food or Progress tab. ' +
      'This is a planner, not medical advice; a real doctor beats an app every time.</p>';
  }

  function syncSheet() {
    const st = S.state.sync;
    const authMode = A.mode === 'firebase';
    return '<h2>Sync setup</h2>' +
      '<p class="small muted">Status: <b>' + esc(S.SYNC_LABEL[st.status] || st.status) + '</b>' +
      (st.detail ? ' — ' + esc(st.detail) : '') + '</p>' +
      '<div class="card tight"><div class="eyebrow">What is stored where</div>' +
      '<p class="small">Each of you writes only your own document — <code>' + S.COLL + '/danil</code> and ' +
      '<code>' + S.COLL + '/towne</code> — so you can both be logging dinner at the same moment and neither of you ' +
      'can overwrite the other. Everything is mirrored on your phone first, so the app works with no signal.</p></div>' +

      (st.status === 'denied' || st.status === 'local' || st.status === 'error'
        ? '<div class="banner warning"><span class="ic">' + ICON.alert + '</span><div><b>Sync is not running yet.</b> ' +
          'The database is rejecting it. Paste the rules below into Firebase → Firestore Database → Rules → Publish, and it starts working immediately. ' +
          'Nothing is lost in the meantime — it is all saved on the device.</div></div>'
        : '') +

      '<div class="card tight"><div class="eyebrow">' + (authMode ? 'Recommended — with logins' : 'With logins (do this one)') + '</div>' +
      '<p class="xs dim">This is the whole rules file: it leaves the homework planner\u2019s rules exactly as they are ' +
      'and adds this app in its own collection beside them. Requires Authentication \u2192 Sign-in method \u2192 Email/Password \u2192 Enable.</p>' +
      '<pre class="code" id="rulesAuth">' + esc(S.RULES_AUTH) + '</pre>' +
      '<button class="btn sm" data-act="copy" data-from="#rulesAuth">' + ICON.copy + ' Copy</button></div>' +

      '<div class="card tight"><div class="eyebrow">Without logins</div>' +
      '<p class="xs dim">Works instantly but anyone who knows the project could read or write these documents. ' +
      'Fine for an hour of testing; the version above is the one to leave on.</p>' +
      '<pre class="code" id="rulesOpen">' + esc(S.RULES_OPEN) + '</pre>' +
      '<button class="btn sm" data-act="copy" data-from="#rulesOpen">' + ICON.copy + ' Copy</button></div>' +

      '<button class="btn full" data-act="retry-sync">Retry connection</button>';
  }

  /* =======================================================================
     Actions
     ======================================================================= */
  Object.assign(U.acts, {
    'extra': function (t) {
      S.setExtra(ui.date, t.getAttribute('data-id'), +t.getAttribute('data-d'));
    },
    'low': function (t) {
      S.setLow(t.getAttribute('data-id'), t.getAttribute('data-v') === '1');
    },
    'grocery-copy': function () {
      const G = FIT.GROCERY;
      const txt = G.text(G.list(G.weekStart(ui.date), 7));
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { toast('List copied.'); },
          function () { toast('Could not copy \u2014 try Share instead.'); });
      } else toast('Could not copy \u2014 try Share instead.');
    },
    'grocery-share': function () {
      const G = FIT.GROCERY;
      const l = G.list(G.weekStart(ui.date), 7);
      const txt = G.text(l);
      if (navigator.share) {
        navigator.share({ title: 'Grocery list', text: txt }).catch(function () {});
      } else {
        U.acts['grocery-copy']();
      }
    },
    'grocery-mail': function () {
      const G = FIT.GROCERY;
      const l = G.list(G.weekStart(ui.date), 7);
      const partner = S.person(S.partnerKey());
      const to = (partner.profile && partner.profile.email) || (S.me().profile.email || '');
      const href = G.mailto(l, to);
      try { window.location.href = href; } catch (e) {}
      toast(to ? 'Opening your mail app, addressed to ' + to : 'Opening your mail app with the list.', 4200);
    },
    'grocery-seen': function () {
      FIT.GROCERY.markShown(ui.date);
      ui.sheet = null; render();
    },
    'set-budget': function (t) {
      S.setBudget(t.getAttribute('data-d') || ui.date, +t.getAttribute('data-v'));
    },
    'set-mode': function (t) { S.setMode(ui.date, t.getAttribute('data-v')); },
    'toggle-ex': function (t) { S.toggleExercise(ui.date, t.getAttribute('data-id')); },
    'finish-workout': function () {
      const v = S.view(ui.date);
      const done = !!(v.rec.workout && v.rec.workout.done);
      S.completeWorkout(ui.date, { done: !done, minutes: v.session.totalMinutes, cardio: v.session.cardioMinutes });
      if (!done) toast('Logged. ' + mins(v.session.totalMinutes) + ' in the gym.');
    },
    'toggle-meal': function (t) {
      const m = t.getAttribute('data-m');
      const v = S.view(ui.date);
      const meal = v.meals && v.meals.meals[m];
      const items = meal ? meal.items.map(function (i) { return { id: i.id, q: i.q }; }) : null;
      const on = S.toggleMeal(ui.date, m, items);
      if (on) toast('Logged.');
    },
    'pick-meal': function (t) {
      S.setMealChoice(ui.date, t.getAttribute('data-m'), t.getAttribute('data-id') || null);
      ui.sheet = null; render();
    },
    'send-nudge': function (t) {
      S.sendNudge(t.getAttribute('data-text'));
      ui.sheet = null; render();
      toast('Sent to ' + S.DISPLAY[S.partnerKey()]);
    },
    'clear-nudges': function () { S.markSeen('nudgesAt'); },
    'tab-close': function (t) { ui.sheet = null; ui.tab = t.getAttribute('data-v'); render(); },
    'theme': function (t) {
      S.setPref('theme', t.getAttribute('data-v'));
      FIT.MAIN.applyTheme();
      render();
      CH.redrawAll();
    },
    'notify-on': function () { FIT.MAIN.enableNotifications().then(function () { render(); }); },
    'notify-off': function () { S.setPref('notify', false); render(); },
    'install': function () { FIT.MAIN.install(); },
    'retry-sync': function () { S.startSync(); toast('Reconnecting…'); },
    'replay-welcome': function () { S.me().seen.welcome = 0; S.touch(); ui.sheet = null; render(); },
    'reset-adjust': function () {
      const d = S.me();
      d.adjust = { kcal: 0, cardio: 0, at: null, reason: '', history: d.adjust.history || [] };
      S.touch(); render(); toast('Adjustments reset.');
    }
  });

  Object.assign(U.forms, {
    restore: function (data) {
      const r = S.importText(data.blob || '');
      if (!r.ok) { toast(r.error, 5000); return; }
      ui.sheet = null; render();
      toast(r.added
        ? 'Merged in \u2014 ' + r.added + ' new day' + (r.added === 1 ? '' : 's') + ' for ' + S.DISPLAY[r.person] + '.'
        : 'Merged in. Nothing new to add.', 4500);
    },
    pantry: function (data) {
      let n = 0;
      Object.keys(data).forEach(function (id) {
        const raw = String(data[id]).trim();
        if (raw === '') { S.clearStock(id); return; }
        const val = Number(raw);
        if (isNaN(val) || val < 0) return;
        S.setStock(id, val); n++;
      });
      ui.sheet = null; render();
      toast(n ? 'Kitchen updated.' : 'Saved.');
    },
    weigh: function (data) {
      const r = S.setWeight(ui.date, data.w);
      if (!r.ok) { toast(r.error); return; }
      ui.sheet = null; render();
      toast('Logged ' + lb(r.w) + ' lb.');
    },
    waist: function (data) {
      S.setWaist(ui.date, data.waist);
      ui.sheet = null; render();
    },
    lift: function (data, form) {
      if (S.logLift(data.ex, data.w, data.reps, ui.date)) {
        toast('Saved.');
        form.reset();
      } else toast('Enter a weight and reps.');
    },
    profile: function (data) {
      const hh = (+data.ft) * 12 + (+data.in);
      if (!(hh >= 36 && hh <= 95)) { toast('That height does not look right.'); return; }
      const range = CDC.healthyWeightRange(hh);
      if (range && +data.goal < range.lo) {
        toast('Goal below the healthy range for that height (' + Math.round(range.lo) + ' lb).', 5000);
        return;
      }
      S.setProfile({
        heightIn: hh, age: +data.age, sex: data.sex, goalWeight: +data.goal,
        goalDate: data.date, goalType: data.type, defaultBudget: +data.budget
      });
      ui.sheet = null; render(); toast('Saved.');
    }
  });
})(FIT.UI);
