/* ===========================================================================
   coach.js — the part that tells the truth kindly.

   Rules it follows:
     • Judge the 7-day average, never this morning's number. Day-to-day weight
       is mostly water, and saying so is not a cop-out, it is the physiology.
     • When progress stalls, name the actual cause from the actual logs. If
       the cause is missed meals and missed gym days, do not quietly cut
       calories instead — say what happened.
     • Never cut below the intake floor. If the goal date cannot be met
       safely, move the date.
     • Honest does not mean cold. Every verdict ships with something true and
       kind, because a person who feels awful about themselves quits, and
       quitting is the only real failure here.
   =========================================================================== */
window.FIT = window.FIT || {};
FIT.COACH = (() => {
  'use strict';
  const CDC = FIT.CDC, N = FIT.NUTRITION;

  const CUTOFF = { weigh: 11, b: 11, l: 15, d: 21, gym: 22 };
  const ITEM_LABEL = { weigh: 'weigh-in', b: 'breakfast', l: 'lunch', d: 'dinner', gym: 'gym' };
  const ITEM_PLURAL = { weigh: 'weigh-ins', b: 'breakfasts', l: 'lunches', d: 'dinners', gym: 'gym days' };

  /* =======================================================================
     Trend
     ======================================================================= */
  function series(days) {
    return Object.keys(days || {}).filter(d => days[d] && days[d].w > 0)
      .sort().map(d => ({ d, w: +days[d].w }));
  }

  function windowAvg(pts, endDate, fromDaysAgo, toDaysAgo) {
    const lo = N.addDays(endDate, -fromDaysAgo), hi = N.addDays(endDate, -toDaysAgo);
    const sel = pts.filter(p => p.d >= lo && p.d <= hi);
    if (!sel.length) return null;
    return sel.reduce((s, p) => s + p.w, 0) / sel.length;
  }

  /** Least-squares slope in lb/week over the last `days` days. */
  function slopePerWeek(pts, endDate, days) {
    const lo = N.addDays(endDate, -(days - 1));
    const sel = pts.filter(p => p.d >= lo && p.d <= endDate);
    if (sel.length < 3) return null;
    const xs = sel.map(p => N.daysBetween(lo, p.d)), ys = sel.map(p => p.w);
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    if (!den) return null;
    return (num / den) * 7;
  }

  function trend(days, dateStr) {
    const pts = series(days);
    const today = days[dateStr] && days[dateStr].w > 0 ? +days[dateStr].w : null;
    const last = pts.length ? pts[pts.length - 1] : null;
    const prev = pts.length > 1 ? pts[pts.length - 2] : null;
    return {
      points: pts, count: pts.length, today, last,
      first: pts[0] || null,
      avg7: windowAvg(pts, dateStr, 6, 0),
      prev7: windowAvg(pts, dateStr, 13, 7),
      dayChange: today != null && prev ? today - prev.w : null,
      rate7: slopePerWeek(pts, dateStr, 7),
      rate14: slopePerWeek(pts, dateStr, 14),
      sinceStart: last && pts[0] ? last.w - pts[0].w : null
    };
  }

  /** Where the straight line from start to goal says you should be today. */
  function expectedWeight(profile, dateStr) {
    const total = N.daysBetween(profile.startDate, profile.goalDate);
    if (total <= 0) return profile.goalWeight;
    const elapsed = Math.max(0, Math.min(total, N.daysBetween(profile.startDate, dateStr)));
    return profile.startWeight + (profile.goalWeight - profile.startWeight) * (elapsed / total);
  }

  /* =======================================================================
     Adherence — straight from the logs, no interpretation
     ======================================================================= */
  function adherence(days, dateStr, windowDays, sessionsByDate, since) {
    let gymDue = 0, gymDone = 0, mealsDue = 0, mealsDone = 0, weighDue = 0, weighDone = 0;
    let cardioPlanned = 0, cardioDone = 0, minutesDone = 0;
    const missList = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = N.addDays(dateStr, -i);
      if (since && d < since) continue;        /* nothing counts before day one */
      const rec = (days && days[d]) || {};
      const isToday = d === dateStr;
      const h = new Date().getHours();
      const sess = sessionsByDate ? sessionsByDate[d] : null;
      const restDay = sess && sess.kind === 'rest';

      if (!isToday || h >= CUTOFF.weigh) { weighDue++; if (rec.w > 0) weighDone++; else missList.push({ d, key: 'weigh' }); }
      for (const m of ['b', 'l', 'd']) {
        if (isToday && h < CUTOFF[m]) continue;
        mealsDue++;
        if (rec.meals && rec.meals[m]) mealsDone++; else missList.push({ d, key: m });
      }
      if (!restDay && (!isToday || h >= CUTOFF.gym)) {
        gymDue++;
        if (rec.workout && rec.workout.done) gymDone++; else missList.push({ d, key: 'gym' });
      }
      if (sess) cardioPlanned += sess.cardioMinutes;
      if (rec.workout && rec.workout.done) {
        minutesDone += rec.workout.minutes || (sess ? sess.totalMinutes : 0);
        cardioDone += rec.workout.cardio != null ? rec.workout.cardio : (sess ? sess.cardioMinutes : 0);
      }
    }
    const pct = (a, b) => b > 0 ? a / b : 1;
    const counted = since ? Math.min(windowDays, N.daysBetween(since, dateStr) + 1) : windowDays;
    const overall = pct(gymDone + mealsDone + weighDone, gymDue + mealsDue + weighDue);
    return {
      windowDays: counted, gymDue, gymDone, mealsDue, mealsDone, weighDue, weighDone,
      cardioPlanned, cardioDone, minutesDone,
      gymPct: pct(gymDone, gymDue), mealPct: pct(mealsDone, mealsDue), weighPct: pct(weighDone, weighDue),
      overall, misses: missList
    };
  }

  /** Days in a row, counting back from today, with a logged weight. */
  function logStreak(days, dateStr) {
    const has = (d) => !!(days[d] && days[d].w > 0);
    let start = 0;
    if (!has(dateStr)) { if (!has(N.addDays(dateStr, -1))) return 0; start = 1; }
    let n = 0;
    for (let i = start; i < 730; i++) {
      if (has(N.addDays(dateStr, -i))) n++; else break;
    }
    return n;
  }


  /* =======================================================================
     Is the goal itself sensible? Asked once, answered honestly.
     ======================================================================= */
  function goalSafety(profile, currentWeight) {
    const out = { notes: [], warnings: [] };
    const now = currentWeight > 0 ? currentWeight : profile.startWeight;
    const curBmi = CDC.bmi(now, profile.heightIn);
    const goalBmi = CDC.bmi(profile.goalWeight, profile.heightIn);
    if (!curBmi) return out;
    out.currentBmi = curBmi; out.goalBmi = goalBmi;
    out.currentCategory = CDC.bmiCategory(curBmi);
    out.goalCategory = CDC.bmiCategory(goalBmi);
    const range = CDC.healthyWeightRange(profile.heightIn);
    out.healthyRange = range;

    if (out.currentCategory.key === 'healthy') {
      out.notes.push(`At ${Math.round(now)} lb you are already inside CDC’s healthy weight range for your height (${Math.round(range.lo)}–${Math.round(range.hi)} lb). So this is not about your health being in trouble — it is about how you want to look and feel, which is a completely reasonable thing to want.`);
    }
    if (goalBmi && goalBmi < 18.5) {
      out.warnings.push(`A goal of ${Math.round(profile.goalWeight)} lb would put you at a BMI of ${goalBmi.toFixed(1)}, below CDC’s healthy range. The lowest weight still inside it for your height is about ${Math.round(range.lo)} lb. This app will not build a plan below that — please pick a goal at or above it.`);
    } else if (goalBmi && goalBmi < 19.5) {
      out.warnings.push(`${Math.round(profile.goalWeight)} lb is a BMI of ${goalBmi.toFixed(1)} — inside CDC’s healthy range but near the bottom of it. Perfectly allowed; just know there is not much room below it.`);
    }
    const weeks = N.weeksBetween(profile.startDate, profile.goalDate);
    const rate = weeks > 0 ? (profile.startWeight - profile.goalWeight) / weeks : 0;
    out.rate = rate; out.weeks = weeks;
    out.rateVerdict = CDC.judgeRate(rate);
    if (rate > CDC.WEIGHT.maxRateLbPerWeek) {
      out.warnings.push(`${Math.round(profile.startWeight - profile.goalWeight)} lb in ${Math.round(weeks)} weeks is ${rate.toFixed(1)} lb a week. CDC’s sustainable range is 1–2 lb a week, so this plan will go as fast as that allows and then tell you the honest finish date instead of starving you.`);
    }
    return out;
  }

  /* =======================================================================
     The daily verdict
     ======================================================================= */
  function verdict(o) {
    const { profile, days, dateStr, tr, adh, tgt, plannedSodium } = o;
    const expected = expectedWeight(profile, dateStr);
    const ref = tr.avg7 != null ? tr.avg7 : (tr.last ? tr.last.w : null);
    const delta = ref != null ? ref - expected : null;    /* + = heavier than the line */
    const rate = tr.rate7 != null ? tr.rate7 : tr.rate14;
    const losing = profile.goalWeight < profile.startWeight;

    let key = 'early';
    if (tr.count >= 3 && delta != null) {
      if (losing) {
        if (rate != null && rate < -CDC.WEIGHT.maxRateLbPerWeek - 0.2) key = 'toofast';
        else if (rate != null && rate > 0.3) key = 'gaining';
        else if (rate != null && Math.abs(rate) <= 0.2 && delta > 0.8) key = 'stalled';
        else if (delta <= -0.5) key = 'ahead';
        else if (delta < 0.8) key = 'ontrack';
        else if (delta <= 2) key = 'slightly_behind';
        else key = 'behind';
      } else {
        key = Math.abs(delta) < 1 ? 'ontrack' : delta > 0 ? 'ahead' : 'behind';
      }
    }

    const V = {
      early:  { label: 'Getting started',  tone: 'neutral' },
      ahead:  { label: 'Ahead of plan',    tone: 'good' },
      ontrack:{ label: 'On track',         tone: 'good' },
      slightly_behind: { label: 'A little behind', tone: 'warning' },
      behind: { label: 'Behind the line',  tone: 'serious' },
      stalled:{ label: 'Stalled',          tone: 'warning' },
      gaining:{ label: 'Trending up',      tone: 'serious' },
      toofast:{ label: 'Dropping too fast',tone: 'warning' }
    };

    const reasons = [], wins = [];

    /* always say what the number actually means */
    if (tr.dayChange != null && Math.abs(tr.dayChange) >= 0.4) {
      reasons.push(`Today is ${fmtDelta(tr.dayChange)} on yesterday. Day-to-day moves of 1–3 lb are water, salt and what is still being digested — not fat. The 7-day average is the real number.`);
    }
    if (plannedSodium && plannedSodium > CDC.SODIUM_LIMIT) {
      reasons.push(`Yesterday’s food ran about ${Math.round(plannedSodium).toLocaleString()} mg of sodium, over the ${CDC.SODIUM_LIMIT.toLocaleString()} mg guideline. Salt holds water, and that alone can show up as 1–3 lb on the scale for a day or two. Frozen nuggets and fries are where nearly all of it comes from.`);
    }

    if (adh.gymDue && adh.gymPct < 1) reasons.push(`${adh.gymDone} of ${adh.gymDue} gym days done in the last ${adh.windowDays}.`);
    else if (adh.gymDue) wins.push(`Every gym day done — ${adh.gymDone} for ${adh.gymDue}.`);
    if (adh.mealsDue && adh.mealPct < 0.8) reasons.push(`${adh.mealsDone} of ${adh.mealsDue} meals logged. Unlogged meals are the usual reason a plan "stops working" — the calories still happened, we just cannot see them.`);
    else if (adh.mealsDue && adh.mealPct >= 0.95) wins.push(`${adh.mealsDone} of ${adh.mealsDue} meals logged.`);
    if (adh.weighDue && adh.weighPct < 0.8) reasons.push(`Weighed in on ${adh.weighDone} of the last ${adh.weighDue} days — the trend line needs most days to mean anything.`);
    if (adh.cardioPlanned) {
      const pct = adh.cardioDone / adh.cardioPlanned;
      if (pct < 0.8) reasons.push(`${Math.round(adh.cardioDone)} of ${Math.round(adh.cardioPlanned)} planned cardio minutes.`);
      else wins.push(`${Math.round(adh.cardioDone)} cardio minutes this week — CDC asks adults for 150.`);
    }

    /* the honest read on the trend itself */
    if (key === 'stalled' && adh.overall >= 0.85) {
      reasons.push('You are doing the plan and the average has not moved for a week. That usually means the calorie estimate is a little high for your body, not that you are doing it wrong. Fixed below.');
    }
    if (key === 'behind' || key === 'slightly_behind') {
      if (rate != null && rate < -0.1) reasons.push(`You are still losing — about ${Math.abs(rate).toFixed(1)} lb a week — just slower than the line to ${profile.goalWeight} lb needs.`);
      if (adh.overall < 0.85) reasons.push('The gap here is adherence, not the plan. The numbers are fine; the missed days are the thing.');
    }
    if (key === 'gaining') {
      reasons.push('The 7-day average is up, not flat. Worth checking honestly: were meals logged, and did portions creep? If both were fine, two weeks of this means the target needs a real change.');
      if (profile.goalType === 'recomp') reasons.push('You are also lifting heavy six days a week, so some of any early rise is muscle and glycogen. That is why the waist measurement matters more than the scale for you.');
    }
    if (key === 'toofast') {
      reasons.push(`Losing faster than CDC’s 2 lb a week is not a win — past that you start giving up muscle, which is the opposite of the abs goal. Calories are going back up below.`);
    }
    if (key === 'ahead') wins.push('Ahead of the line, at a pace CDC calls sustainable. Nothing needs changing.');

    return { key, ...V[key], expected, delta, ref, rate, reasons, wins, losing };
  }

  /* =======================================================================
     The adjustment — at most one a week, always explained, never below floor
     ======================================================================= */
  function proposeAdjustment(o) {
    const { v, adh, tgt, profile, dateStr, lastAdjust, tr } = o;
    const none = { change: false };
    if (!tgt || !tgt.ok) return none;
    if (tr.count < 7) return { change: false, why: 'Needs a full week of weigh-ins before changing anything.' };
    if (lastAdjust && N.daysBetween(lastAdjust.at, dateStr) < 7) {
      return { change: false, why: `Adjusted ${N.daysBetween(lastAdjust.at, dateStr)} days ago. Changes get a week to show up before the next one.` };
    }

    if (v.key === 'toofast') {
      return { change: true, kcal: +150, cardio: 0,
        why: 'Calories up 150 a day. Dropping faster than 2 lb a week costs muscle, and CDC puts the sustainable ceiling there.' };
    }
    if (v.key === 'ahead' || v.key === 'ontrack' || v.key === 'early') {
      return { change: false, why: 'On pace. Nothing to change — changing a working plan is how people break it.' };
    }
    if (adh.overall < 0.85) {
      const top = topMisses(adh.misses);
      return { change: false, adherence: true,
        why: `No change to your calories or cardio. The plan is not the problem — ${top}. Cutting food to cover missed days would make this harder, not faster.` };
    }

    const floor = tgt.floor;
    const room = tgt.intake - floor;
    const kcalCut = room >= 100 ? -100 : -Math.max(0, room);
    const cardio = +10;
    let why = '';
    if (kcalCut < 0) why = `Calories down ${Math.abs(kcalCut)} a day and 10 minutes added to each cardio block. CDC points at more activity first for weight loss, so the cardio is doing most of this.`;
    else why = `Calories are already at your floor of ${floor}, so they stay put — going below that is not something this app will do. Instead: 10 more minutes of cardio a day.`;
    return { change: true, kcal: kcalCut, cardio, why };
  }

  function topMisses(misses) {
    const counts = {};
    misses.forEach(m => { counts[m.key] = (counts[m.key] || 0) + 1; });
    const parts = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 2)
      .map(k => `${counts[k]} missed ${counts[k] > 1 ? ITEM_PLURAL[k] : ITEM_LABEL[k]}`);
    return parts.join(' and ') || 'some days are missing';
  }

  /* =======================================================================
     Projection from what is actually happening, not what was hoped
     ======================================================================= */
  function projection(profile, tr, dateStr) {
    const rate = tr.rate14 != null ? tr.rate14 : tr.rate7;
    const ref = tr.avg7 != null ? tr.avg7 : (tr.last ? tr.last.w : null);
    if (ref == null) return null;
    const left = ref - profile.goalWeight;
    if (left <= 0.3) return { done: true, ref };
    if (rate == null || rate >= -0.05) return { stalled: true, ref, left };
    const weeks = left / Math.abs(rate);
    const date = N.addDays(dateStr, Math.round(weeks * 7));
    return { ref, left, rate, weeks, date, late: date > profile.goalDate, early: date < profile.goalDate };
  }

  /* =======================================================================
     Misses, for both of them, so nothing quietly slides
     ======================================================================= */
  function missesFor(days, dateStr, windowDays, sessionsByDate, nowHour, since) {
    const h = nowHour != null ? nowHour : new Date().getHours();
    const out = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = N.addDays(dateStr, -i);
      if (since && d < since) continue;
      const rec = (days && days[d]) || {};
      const isToday = d === dateStr;
      const sess = sessionsByDate ? sessionsByDate[d] : null;
      const items = [];
      if (!isToday || h >= CUTOFF.weigh) if (!(rec.w > 0)) items.push('weigh');
      for (const m of ['b', 'l', 'd']) if ((!isToday || h >= CUTOFF[m]) && !(rec.meals && rec.meals[m])) items.push(m);
      if ((!sess || sess.kind !== 'rest') && (!isToday || h >= CUTOFF.gym)) if (!(rec.workout && rec.workout.done)) items.push('gym');
      if (items.length) out.push({ date: d, items, isToday });
    }
    return out.reverse();
  }

  const missLabel = (items) => items.map(k => ITEM_LABEL[k]).join(', ');

  /* =======================================================================
     Words. The honest ones and the kind ones are both required.
     ======================================================================= */
  const LOVE = [
    'Danil loves you more than he knows how to say.',
    'Danil thinks you are the most beautiful girl in the world. He asked for that to be in here every day.',
    'You were beautiful at 140 and you will be beautiful at 120. This was never about becoming worth loving.',
    'Danil built this whole thing because he wanted to do something with you, not to you.',
    'Whatever the scale says today, Danil is still going to look at you the same way.',
    'The most beautiful girl in the world is reading this. Danil wanted to make sure she knew.',
    'Danil is proud of you for opening this again today.',
    'You do not owe anyone a smaller body. You just said you wanted this, so he is helping.',
    'Danil loves your body today, at today’s weight, not the future one.',
    'If today was hard, Danil would rather you rest than quit.',
    'Twenty pounds is a number. You are not a number. Danil wanted that written down.',
    'Danil says: come to the gym with me, it is better when you are there.',
    'You are allowed to be proud of yourself before you are finished.',
    'Danil loves you so much. That is the whole message today.',
    'Nothing about this plan means there was something wrong with you.',
    'Danil would pick you again. Every single time.',
    'Showing up on the days you do not feel like it is the entire skill. You have it.',
    'Danil thinks you are gorgeous. The abs are a bonus, not the point.',
    'Your body carried you through today. Be a little kind to it tonight.',
    'Danil is in this with you — same app, same rules, same honest numbers.',
    'The girl in the mirror is doing better than she thinks.',
    'Danil loves you. Eat your dinner.',
    'You are the most beautiful girl in the world and you are also 11 days into a hard thing. Both are true.',
    'Progress is not a straight line and neither is love. Both are still going the right way.',
    'Danil wanted today’s note to just say: you are enough already.',
    'He made the app honest because he respects you. He made it kind because he loves you.',
    'If the number went the wrong way, it is information, not a verdict on you.',
    'Danil says he is lucky. Not the other way round.',
    'One hour at the gym, three meals, one weigh-in. That is all today asks of you.',
    'Danil loves you so, so much. Go get your hour in.'
  ];

  const loveNote = (dateStr, i) => LOVE[(Math.abs(hash(dateStr)) + (i || 0)) % LOVE.length];

  const KIND = {
    early:   'No verdicts yet — just keep logging. The first week is only data collection.',
    ahead:   'This is working. Do not get clever and cut more.',
    ontrack: 'Exactly where the plan says you should be. Boring is what success looks like.',
    slightly_behind: 'A little behind is not behind. One honest week fixes this.',
    behind:  'This is a gap in the data, not a verdict on you. Here is what it actually is and what changes.',
    stalled: 'Plateaus are normal and they end. Yours has a specific cause and a specific fix.',
    gaining: 'Up weeks happen to everyone who is honest enough to keep weighing. Nothing here is lost.',
    toofast: 'Slow down on purpose. Faster is not better and your body will take it out of your muscle.'
  };

  function hash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h | 0;
  }

  const NUDGES = [
    'Checking in — log your dinner when you get a sec?',
    'Still owe the app a weigh-in. No judgment, just the number.',
    'Gym? I’ll go with you.',
    'You’ve got one meal left to log today.',
    'Proud of you for this week. Don’t let today slide.',
    'Two days missing. Want to just do a cardio-only day and call it even?'
  ];

  const fmtDelta = (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' lb';

  /* =======================================================================
     The whole daily summary, assembled
     ======================================================================= */
  function dailySummary(o) {
    const tr = trend(o.days, o.dateStr);
    const adh = adherence(o.days, o.dateStr, 7, o.sessionsByDate, o.since);
    const v = verdict({ profile: o.profile, days: o.days, dateStr: o.dateStr, tr, adh, tgt: o.tgt, plannedSodium: o.plannedSodium });
    const adj = proposeAdjustment({ v, adh, tgt: o.tgt, profile: o.profile, dateStr: o.dateStr, lastAdjust: o.lastAdjust, tr });
    const proj = projection(o.profile, tr, o.dateStr);
    return {
      date: o.dateStr, trend: tr, adherence: adh, verdict: v, adjustment: adj, projection: proj,
      kindness: KIND[v.key], streak: logStreak(o.days, o.dateStr),
      locked: !(o.days[o.dateStr] && o.days[o.dateStr].w > 0)
    };
  }

  return {
    CUTOFF, ITEM_LABEL, series, trend, expectedWeight, adherence, logStreak,
    goalSafety, verdict, proposeAdjustment, projection, missesFor, missLabel,
    dailySummary, loveNote, LOVE, NUDGES, KIND, fmtDelta, topMisses, slopePerWeek
  };
})();
