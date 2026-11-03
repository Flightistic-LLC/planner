/* ===========================================================================
   program.js — turns "I have N minutes today" into an actual timed session.

   Non-negotiables baked in:
     • every gym day is at least 60 minutes
     • at least 30 minutes of that is cardio, always
     • the rest is the day's focus, built biggest-lift-first
     • one active-recovery day a week, and one true rest day every 4th week,
       because training the same muscle every day is how progress stops
     • tell it you have 3 hours and it rebuilds the whole session, it does not
       just stretch the numbers
   =========================================================================== */
window.FIT = window.FIT || {};
FIT.PROGRAM = (() => {
  'use strict';
  const EX = FIT.EX, CDC = FIT.CDC, N = FIT.NUTRITION;

  /* Sunday-indexed, matching Date.getDay() */
  const SPLIT = ['recovery', 'chest_tri', 'back_bi', 'legs_glutes', 'shoulders_arms', 'core_cond', 'full_body'];

  const SCHEME = {
    fatloss: {
      1: { sets: 3, reps: [10, 12], rest: 60 },
      2: { sets: 3, reps: [12, 15], rest: 45 },
      3: { sets: 2, reps: [15, 20], rest: 30 },
      label: 'Moderate weight, higher reps, short rests — keeps the heart rate up and holds on to muscle while the fat comes off.'
    },
    recomp: {
      1: { sets: 4, reps: [6, 8],   rest: 120 },
      2: { sets: 3, reps: [8, 10],  rest: 90 },
      3: { sets: 3, reps: [12, 15], rest: 45 },
      label: 'Heavy compound work with long rests, then volume — the combination that adds muscle while the scale comes down.'
    }
  };

  const CARDIO_DEFAULT = {
    towne: ['walk_brisk', 'incline_walk', 'elliptical', 'bike_static', 'stairs'],
    danil: ['incline_walk', 'row_erg', 'run_5mph', 'bike_static', 'stairs', 'elliptical']
  };

  const BUDGET_CHOICES = [60, 75, 90, 120, 150, 180];
  const round5 = (v) => Math.round(v / 5) * 5;
  const mid = (r) => (r[0] + r[1]) / 2;

  /* ---- which day is it ---- */
  function weekIndex(profile, dateStr) {
    const anchor = profile.startDate || dateStr;
    return Math.floor(N.daysBetween(anchor, dateStr) / 7);
  }

  function focusFor(profile, dateStr) {
    const dow = new Date(dateStr + 'T12:00:00').getDay();
    const focus = SPLIT[dow];
    if (focus === 'recovery') {
      const wi = weekIndex(profile, dateStr);
      const full = (profile.fullRestEvery !== 0) && (((wi % (profile.fullRestEvery || 4)) + (profile.fullRestEvery || 4)) % (profile.fullRestEvery || 4) === 3);
      return full
        ? { focus: 'recovery', kind: 'rest',   reason: 'Every fourth week this one is a real day off. Muscle is built while you rest, not while you train — skipping rest is how people plateau.' }
        : { focus: 'recovery', kind: 'cardio', reason: 'Active recovery: easy cardio and mobility. You still go, you just don’t lift.' };
    }
    return { focus, kind: 'strength', reason: '' };
  }

  /* ---- time cost of one exercise ---- */
  function exMinutes(ex, sc) {
    const work = ex.timed ? ex.timed : mid(ex.reps || sc.reps) * 3;
    return (sc.sets * (work + sc.rest)) / 60 + 0.5;   /* +30s to set up */
  }

  function rotate(arr, n) {
    if (!arr.length) return arr;
    const k = ((n % arr.length) + arr.length) % arr.length;
    return arr.slice(k).concat(arr.slice(0, k));
  }

  /* One exercise per movement family inside the main lifts, two across the
     whole session — otherwise a leg day comes out as squat, goblet squat and
     leg press, which is the same exercise three times. */
  function pickExercises(focus, scheme, minutesAvailable, wi, equip, maxCount) {
    const pool = EX.forFocus(focus).filter(e => !equip || equip.includes(e.equip));
    const tiers = [1, 2, 3].map(t => rotate(pool.filter(e => e.tier === t), wi));
    const tierCaps = { 1: 3, 2: 3, 3: 3 };
    const famCount = {};
    const chosen = [];
    let left = minutesAvailable;
    for (const t of [1, 2, 3]) {
      let used = 0;
      for (const ex of tiers[t - 1]) {
        if (chosen.length >= maxCount || used >= tierCaps[t]) break;
        const fam = ex.fam || ex.id;
        const seen = famCount[fam] || 0;
        if (seen >= (t === 1 ? 1 : 2)) continue;
        const sc = scheme[ex.tier];
        const cost = exMinutes(ex, sc);
        if (cost > left + 0.75) continue;
        chosen.push({ ex, sc, minutes: Math.round(cost * 10) / 10 });
        famCount[fam] = seen + 1;
        left -= cost; used++;
      }
    }
    return { chosen, left: Math.max(0, left) };
  }

  function liftItem(entry, lifts) {
    const { ex, sc, minutes } = entry;
    const last = lifts && lifts[ex.id];
    const item = {
      exId: ex.id, name: ex.name, groups: ex.groups, equip: ex.equip,
      sets: sc.sets, rest: sc.rest, cue: ex.cue, alt: ex.alt,
      tier: ex.tier, minutes
    };
    if (ex.timed) { item.timed = ex.timed; item.reps = `${ex.timed}s hold`; }
    else item.reps = `${sc.reps[0]}–${sc.reps[1]}`;
    if (last && last.w > 0) {
      item.last = last;
      item.suggest = last.reps >= (ex.timed ? 0 : sc.reps[1])
        ? `Last time ${last.w} lb × ${last.reps}. Add weight — try ${Math.round((last.w + (last.w >= 100 ? 10 : 5)))} lb.`
        : `Last time ${last.w} lb × ${last.reps}. Same weight, aim for ${last.reps + 1} reps.`;
    }
    return item;
  }

  /* =======================================================================
     Build one session
     ======================================================================= */
  function buildSession(o) {
    const profile = o.profile, person = o.person, dateStr = o.date;
    const weight = o.weight || profile.startWeight;
    const f = focusFor(profile, dateStr);
    const forcedMode = o.mode && o.mode !== 'auto' ? o.mode : null;
    const kind = forcedMode || f.kind;
    const budget = Math.max(30, o.budget || profile.defaultBudget || 60);
    const wi = weekIndex(profile, dateStr);
    const scheme = SCHEME[profile.goalType === 'recomp' ? 'recomp' : 'fatloss'];
    const cardioPool = (o.cardioPref && o.cardioPref.length ? o.cardioPref : CARDIO_DEFAULT[person] || CARDIO_DEFAULT.towne);
    const cardioKey = cardioPool[(N.dayNumber(dateStr) + (person === 'danil' ? 2 : 0)) % cardioPool.length];
    const blocks = [];

    /* ---------- a true rest day ---------- */
    if (kind === 'rest') {
      blocks.push({
        id: 'rest', kind: 'rest', title: 'Full rest day', minutes: 0,
        note: f.reason || 'Scheduled day off.',
        optional: 'If sitting still drives you mad: a 20–30 minute easy walk is fine and still counts toward CDC’s weekly minutes.'
      });
      return finish({ dateStr, person, f, kind, budget, blocks, weight, scheme, wi, cardioKey: null, profile });
    }

    const warm = Math.min(12, Math.max(5, Math.round(budget * 0.09)));
    const cool = Math.min(12, Math.max(5, Math.round(budget * 0.08)));

    /* ---------- cardio-only / active recovery ---------- */
    if (kind === 'cardio') {
      const isRecovery = f.focus === 'recovery' && !forcedMode;
      let cardioMin = Math.max(30, budget - warm - cool - (isRecovery ? 20 : 0));
      blocks.push({ id: 'warm', kind: 'warmup', title: 'Warm-up', minutes: warm, note: 'Five minutes easy on the machine, then leg swings, arm circles, 10 bodyweight squats.' });
      blocks.push({
        id: 'cardio', kind: 'cardio', title: isRecovery ? 'Easy cardio' : 'Cardio', minutes: cardioMin,
        activity: isRecovery ? 'walk_brisk' : cardioKey,
        activityLabel: CDC.ACTIVITIES[isRecovery ? 'walk_brisk' : cardioKey].label,
        intensity: isRecovery ? 'moderate' : CDC.ACTIVITIES[cardioKey].intensity,
        note: isRecovery
          ? 'Conversational pace — you should be able to talk the whole time. This is recovery, not a workout.'
          : 'Steady pace you could hold for the whole block. If you can sing, speed up; if you can’t talk, slow down.'
      });
      if (isRecovery) {
        let left = budget - warm - cool - cardioMin;
        const items = [];
        for (const r of EX.RECOVERY.filter(r => r.id !== 'rec_walk')) {
          if (left < r.minutes) continue;
          items.push(r); left -= r.minutes;
        }
        if (items.length) blocks.push({ id: 'mob', kind: 'mobility', title: 'Mobility & stretching', minutes: items.reduce((s, i) => s + i.minutes, 0), recovery: items, note: 'The part everyone skips and then wonders why their hips hurt.' });
      }
      blocks.push({ id: 'cool', kind: 'cooldown', title: 'Cool-down & stretch', minutes: cool, note: 'Walk it out, then stretch whatever is tight. 30 seconds a side.' });
      return finish({ dateStr, person, f, kind, budget, blocks, weight, scheme, wi, cardioKey, profile });
    }

    /* ---------- strength + cardio ---------- */
    let cardioMin = Math.min(60, 30 + round5(Math.max(0, budget - 60) * 0.18));
    const wantsCore = f.focus !== 'core_cond' && budget >= 75;
    const coreReserve = wantsCore ? (budget >= 120 ? 12 : 8) : 0;
    let strengthBudget = budget - warm - cool - cardioMin - coreReserve;

    if (strengthBudget < 12) {                 /* very short day: protect cardio, shrink the rest */
      strengthBudget = Math.max(10, budget - warm - cool - 30);
      cardioMin = 30;
    }

    const maxCount = budget >= 150 ? 8 : budget >= 110 ? 7 : budget >= 85 ? 5 : budget >= 70 ? 4 : 3;
    const picked = pickExercises(f.focus, scheme, strengthBudget, wi, profile.equip, maxCount);

    blocks.push({
      id: 'warm', kind: 'warmup', title: 'Warm-up', minutes: warm,
      note: budget >= 120
        ? '5 min easy cardio, then dynamic drills, then one light set of your first lift at about half your working weight.'
        : '4 min easy cardio, leg swings and arm circles, then one light set of your first lift.'
    });

    /* On long days, split cardio so the lifting is not done on tired legs. */
    const splitCardio = budget >= 120;
    if (splitCardio) {
      const pre = Math.min(15, Math.round(cardioMin * 0.3));
      blocks.push({ id: 'cardio1', kind: 'cardio', title: 'Cardio — part 1', minutes: pre, activity: cardioKey, activityLabel: CDC.ACTIVITIES[cardioKey].label, intensity: CDC.ACTIVITIES[cardioKey].intensity, note: 'Easy start. Save your legs for the lifts.' });
      blocks.push(strengthBlock(f, picked, scheme, o.lifts));
      if (wantsCore) blocks.push(coreBlock(coreReserve, wi, scheme, o.lifts));
      blocks.push({ id: 'cardio2', kind: 'cardio', title: 'Cardio — part 2', minutes: cardioMin - pre, activity: cardioKey, activityLabel: CDC.ACTIVITIES[cardioKey].label, intensity: CDC.ACTIVITIES[cardioKey].intensity, note: 'Lifting is done, so push the pace a little here.' });
    } else {
      blocks.push(strengthBlock(f, picked, scheme, o.lifts));
      if (wantsCore) blocks.push(coreBlock(coreReserve, wi, scheme, o.lifts));
      blocks.push({ id: 'cardio', kind: 'cardio', title: 'Cardio', minutes: cardioMin, activity: cardioKey, activityLabel: CDC.ACTIVITIES[cardioKey].label, intensity: CDC.ACTIVITIES[cardioKey].intensity, note: 'After lifting on purpose — doing it first costs you strength on the bar.' });
    }

    blocks.push({ id: 'cool', kind: 'cooldown', title: 'Cool-down & stretch', minutes: cool, note: 'Stretch what you trained. 30–45 seconds a side, no bouncing.' });
    return finish({ dateStr, person, f, kind, budget, blocks, weight, scheme, wi, cardioKey, profile, leftover: picked.left });
  }

  function strengthBlock(f, picked, scheme, lifts) {
    const items = picked.chosen.map(e => liftItem(e, lifts));
    return {
      id: 'strength', kind: 'strength', title: EX.FOCUS[f.focus].label,
      minutes: Math.round(items.reduce((s, i) => s + i.minutes, 0)),
      items, note: scheme.label,
      empty: !items.length
    };
  }

  function coreBlock(reserve, wi, scheme, lifts) {
    const ids = rotate(EX.CORE_FINISHERS, wi);
    const sc = scheme[3];
    const items = [];
    let left = reserve;
    for (const id of ids) {
      const ex = EX.byId[id];
      if (!ex) continue;
      const cost = exMinutes(ex, sc);
      if (cost > left + 0.5) continue;
      items.push(liftItem({ ex, sc, minutes: Math.round(cost * 10) / 10 }, lifts));
      left -= cost;
      if (items.length >= 3) break;
    }
    return {
      id: 'core', kind: 'core', title: 'Abs finisher',
      minutes: Math.round(items.reduce((s, i) => s + i.minutes, 0)) || reserve,
      items, note: 'Both of you want abs, so core gets trained most days, not once a week. Visible abs are mostly the kitchen — this is the half that makes them look like something when they show up.'
    };
  }

  /* Never hand back a 56-minute day when an hour was promised: push the
     spare minutes into cardio (to CDC-useful levels), then mobility, then
     the cool-down, then a conditioning finisher. */
  function absorbLeftover(blocks, budget, kind) {
    if (kind === 'rest') return;
    let guard = 0;
    while (guard++ < 8) {
      const total = blocks.reduce((s, b) => s + b.minutes, 0);
      let spare = budget - total;
      if (spare < -2) {                     /* overshot: give the time back */
        const cool = blocks.find(b => b.kind === 'cooldown');
        if (cool && cool.minutes > 5) { cool.minutes += Math.max(spare, 5 - cool.minutes); continue; }
        const cardios = blocks.filter(b => b.kind === 'cardio');
        const ct = cardios.reduce((s2, b) => s2 + b.minutes, 0);
        if (cardios.length && ct > 30) { const last = cardios[cardios.length - 1]; last.minutes += Math.max(spare, 30 - ct); continue; }
        const st = blocks.find(b => b.kind === 'strength' && b.items && b.items.length > 1);
        if (st) { const drop = st.items.pop(); st.minutes = Math.max(0, Math.round(st.minutes - drop.minutes)); continue; }
        return;
      }
      if (spare < 4) return;

      const cardio = blocks.filter(b => b.kind === 'cardio');
      const cardioTotal = cardio.reduce((s, b) => s + b.minutes, 0);
      if (cardio.length && cardioTotal < 60) {
        const add = Math.min(spare, 60 - cardioTotal);
        cardio[cardio.length - 1].minutes += add;
        continue;
      }
      const mob = blocks.find(b => b.kind === 'mobility');
      if (!mob && spare >= 8) {
        const items = [], budgetM = Math.min(spare, 25);
        let left = budgetM;
        for (const r of EX.RECOVERY.filter(r => r.id !== 'rec_walk')) {
          if (left < r.minutes) continue;
          items.push(r); left -= r.minutes;
        }
        if (items.length) {
          const mins = items.reduce((s, i) => s + i.minutes, 0);
          const cool = blocks.findIndex(b => b.kind === 'cooldown');
          const blk = { id: 'mob', kind: 'mobility', title: 'Mobility & stretching', minutes: mins, recovery: items, note: 'You bought the time, so spend it on the thing that keeps you training: hips, shoulders, and the stuff that gets tight.' };
          if (cool >= 0) blocks.splice(cool, 0, blk); else blocks.push(blk);
          continue;
        }
      }
      const cool = blocks.find(b => b.kind === 'cooldown');
      if (cool && cool.minutes < 15) { cool.minutes += Math.min(spare, 15 - cool.minutes); continue; }
      const fin = blocks.find(b => b.kind === 'finisher');
      if (fin && fin.minutes < 25) { fin.minutes += Math.min(spare, 25 - fin.minutes); continue; }
      if (mob && mob.minutes < 30) { mob.minutes += Math.min(spare, 30 - mob.minutes); continue; }
      if (spare >= 8 && !fin) {
        const cd = blocks.findIndex(b => b.kind === 'cooldown');
        const blk = {
          id: 'finisher', kind: 'finisher', title: 'Conditioning finisher', minutes: Math.min(spare, 20),
          note: 'Intervals: 30 seconds hard, 90 seconds easy, repeat. Rower, bike or incline treadmill — your choice.'
        };
        if (cd >= 0) blocks.splice(cd, 0, blk); else blocks.push(blk);
        continue;
      }
      return;
    }
  }

  function finish(c) {
    const { dateStr, person, f, kind, budget, blocks, weight, profile } = c;
    absorbLeftover(blocks, budget, kind);
    const cardioBlocks = blocks.filter(b => b.kind === 'cardio' || b.kind === 'finisher');
    const cardioMinutes = cardioBlocks.reduce((s, b) => s + b.minutes, 0);
    const vigorous = cardioBlocks.filter(b => b.intensity === 'vigorous' || b.kind === 'finisher').reduce((s, b) => s + b.minutes, 0);
    const moderate = cardioMinutes - vigorous;
    const strengthMinutes = blocks.filter(b => b.kind === 'strength' || b.kind === 'core').reduce((s, b) => s + b.minutes, 0);

    let kcal = 0;
    for (const b of blocks) {
      if (b.kind === 'cardio') kcal += CDC.burn(b.activity, b.minutes, weight);
      else if (b.kind === 'strength' || b.kind === 'core') kcal += CDC.burn('lift_light', b.minutes, weight);
      else if (b.kind === 'finisher') kcal += CDC.burn('row_erg', b.minutes, weight);
      else if (b.kind === 'mobility' || b.kind === 'cooldown' || b.kind === 'warmup') kcal += CDC.burn('stretch', b.minutes, weight);
    }

    const groups = new Set();
    blocks.forEach(b => (b.items || []).forEach(i => (i.groups || []).forEach(g => groups.add(g))));

    const total = blocks.reduce((s, b) => s + b.minutes, 0);
    return {
      date: dateStr, person, kind,
      focus: f.focus, focusLabel: EX.FOCUS[f.focus].label, focusShort: EX.FOCUS[f.focus].short,
      reason: f.reason, budget, totalMinutes: total,
      blocks, cardioMinutes, moderateMinutes: moderate, vigorousMinutes: vigorous,
      strengthMinutes, estKcal: Math.round(kcal), groups: [...groups],
      itemCount: blocks.reduce((s, b) => s + (b.items ? b.items.length : 0), 0),
      leftover: c.leftover || 0,
      shortfall: Math.max(0, budget - total)
    };
  }

  /* =======================================================================
     A whole week, and how it measures against the CDC guideline
     ======================================================================= */
  function weekSessions(o) {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const date = N.addDays(o.weekStart, i);
      const day = (o.days && o.days[date]) || {};
      out.push(buildSession({
        person: o.person, profile: o.profile, date,
        budget: day.budget || o.profile.defaultBudget || 60,
        mode: day.mode || 'auto', weight: o.weight, lifts: o.lifts,
        cardioPref: o.profile.cardioPref
      }));
    }
    return out;
  }

  function weeklyStats(sessions) {
    const moderate = sessions.reduce((s, x) => s + x.moderateMinutes, 0);
    const vigorous = sessions.reduce((s, x) => s + x.vigorousMinutes, 0);
    const equiv = CDC.aerobicEquivalent(moderate, vigorous);
    const strengthDays = sessions.filter(s => s.strengthMinutes > 0).length;
    const covered = new Set();
    sessions.forEach(s => s.groups.forEach(g => covered.add(g)));
    const missing = CDC.ACTIVITY.muscleGroups.filter(g => !covered.has(g));
    return {
      moderate, vigorous, equiv,
      aerobicMet: equiv >= CDC.ACTIVITY.moderateMinPerWeek,
      aerobicBonus: equiv >= CDC.ACTIVITY.moreBenefitsMinPerWeek,
      strengthDays, strengthMet: strengthDays >= CDC.ACTIVITY.strengthDaysPerWeek,
      covered: [...covered], missing, coverageMet: missing.length === 0,
      gymDays: sessions.filter(s => s.kind !== 'rest').length,
      totalMinutes: sessions.reduce((s, x) => s + x.totalMinutes, 0),
      estKcal: sessions.reduce((s, x) => s + x.estKcal, 0)
    };
  }

  return { SPLIT, SCHEME, BUDGET_CHOICES, CARDIO_DEFAULT, focusFor, buildSession, weekSessions, weeklyStats, weekIndex, exMinutes };
})();
