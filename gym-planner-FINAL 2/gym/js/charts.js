/* ===========================================================================
   charts.js — canvas charts, no libraries, works offline.

   Design rules held to deliberately:
     • Danil and Towne weigh very different amounts, so their weight charts
       are SMALL MULTIPLES with their own y-axis each. Never a dual y-axis.
     • The one chart that puts them on a shared axis indexes both to the same
       base: percent of their own goal closed.
     • 2px lines, 8px+ markers, recessive grid, selective direct labels (the
       last point only), legend whenever there are two or more series, and a
       table view for every chart so nothing depends on colour or on hover.
   =========================================================================== */
window.FIT = window.FIT || {};
FIT.CHARTS = (() => {
  'use strict';
  const N = FIT.NUTRITION;
  const live = new Set();

  function tok(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* Canvas cannot read CSS custom properties, so resolve them here. */
  function resolveColor(c) {
    if (typeof c === 'string' && c.slice(0, 4) === 'var(') return tok(c.slice(4, -1).trim(), '#888888');
    return c || '#888888';
  }

  function setup(el, height) {
    el.innerHTML = '';
    el.classList.add('chartwrap');
    const cv = document.createElement('canvas');
    const tip = document.createElement('div');
    tip.className = 'tip';
    el.appendChild(cv); el.appendChild(tip);
    const w = Math.max(240, el.clientWidth || 320);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.style.height = height + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(height * dpr);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.font = '11px ' + tok('--font', 'system-ui');
    return { cv, ctx, tip, w, h: height };
  }

  function niceScale(lo, hi, steps) {
    if (!(hi > lo)) { hi = lo + 1; }
    const raw = (hi - lo) / steps;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step };
  }

  const fmtShort = (d) => {
    const [y, m, dd] = d.split('-').map(Number);
    return `${m}/${dd}`;
  };

  /* =======================================================================
     Weight over time — one chart per person
     ======================================================================= */
  function weight(el, o) {
    const { ctx, cv, tip, w, h } = setup(el, o.height || 190);
    const padL = 40, padR = 14, padT = 12, padB = 24;
    const ink2 = tok('--ink-2'), ink3 = tok('--ink-3'), grid = tok('--grid'), axis = tok('--axis'), surface = tok('--surface');
    const color = resolveColor(o.color);

    const all = o.points.concat(o.avg || []).concat(o.traj || []);
    if (!all.length) { ctx.fillStyle = ink3; ctx.fillText('No weigh-ins yet.', padL, h / 2); return () => {}; }
    const dates = [...new Set(all.map(p => p.d))].sort();
    const x0 = dates[0], x1 = dates[dates.length - 1];
    const span = Math.max(1, N.daysBetween(x0, x1));
    const vals = all.map(p => p.w);
    const sc = niceScale(Math.min(...vals) - 0.8, Math.max(...vals) + 0.8, 4);

    const X = (d) => padL + (N.daysBetween(x0, d) / span) * (w - padL - padR);
    const Y = (v) => padT + (1 - (v - sc.lo) / (sc.hi - sc.lo)) * (h - padT - padB);

    /* grid + y labels */
    ctx.lineWidth = 1; ctx.strokeStyle = grid; ctx.fillStyle = ink3; ctx.textAlign = 'right';
    for (let v = sc.lo; v <= sc.hi + 1e-6; v += sc.step) {
      const y = Math.round(Y(v)) + .5;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(String(Math.round(v)), padL - 7, y + 3.5);
    }
    /* x labels */
    ctx.textAlign = 'center';
    const marks = dates.length > 2 ? [x0, dates[Math.floor(dates.length / 2)], x1] : dates;
    marks.forEach(d => ctx.fillText(fmtShort(d), Math.min(w - padR - 10, Math.max(padL + 10, X(d))), h - 7));

    /* goal trajectory: dashed, neutral — a reference, not a series */
    if (o.traj && o.traj.length > 1) {
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = axis; ctx.lineWidth = 2;
      ctx.beginPath();
      o.traj.forEach((p, i) => i ? ctx.lineTo(X(p.d), Y(p.w)) : ctx.moveTo(X(p.d), Y(p.w)));
      ctx.stroke(); ctx.restore();
    }

    /* daily points: the noise, drawn lightly */
    ctx.fillStyle = color; ctx.globalAlpha = .34;
    o.points.forEach(p => { ctx.beginPath(); ctx.arc(X(p.d), Y(p.w), 2.6, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;

    /* 7-day average: the signal */
    const avg = o.avg || [];
    if (avg.length > 1) {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      avg.forEach((p, i) => i ? ctx.lineTo(X(p.d), Y(p.w)) : ctx.moveTo(X(p.d), Y(p.w)));
      ctx.stroke();
      const last = avg[avg.length - 1];
      ctx.fillStyle = surface; ctx.beginPath(); ctx.arc(X(last.d), Y(last.w), 5.5, 0, 7); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(last.d), Y(last.w), 4, 0, 7); ctx.fill();
      /* the one direct label */
      ctx.fillStyle = ink2; ctx.textAlign = 'right'; ctx.font = '600 11px ' + tok('--font', 'system-ui');
      const lx = Math.min(w - padR, X(last.d) + 2), ly = Math.max(padT + 9, Y(last.w) - 9);
      ctx.fillText(last.w.toFixed(1), lx, ly);
    } else if (o.points.length === 1) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(o.points[0].d), Y(o.points[0].w), 4.5, 0, 7); ctx.fill();
    }

    /* hover */
    const hit = (ev) => {
      const r = cv.getBoundingClientRect();
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      let best = null, bd = 1e9;
      for (const p of o.points) { const d = Math.abs(X(p.d) - px); if (d < bd) { bd = d; best = p; } }
      if (!best || bd > 34) { tip.classList.remove('on'); return; }
      const a = avg.find(p => p.d === best.d);
      tip.innerHTML = `<b>${fmtShort(best.d)}</b> &nbsp;${best.w.toFixed(1)} lb${a ? ` &nbsp;· avg ${a.w.toFixed(1)}` : ''}`;
      tip.classList.add('on');
      const tx = Math.max(2, Math.min(el.clientWidth - tip.offsetWidth - 2, X(best.d) - tip.offsetWidth / 2));
      tip.style.left = tx + 'px';
      tip.style.top = Math.max(0, Y(best.w) - 34) + 'px';
    };
    cv.addEventListener('pointermove', hit);
    cv.addEventListener('pointerdown', hit);
    cv.addEventListener('pointerleave', () => tip.classList.remove('on'));
    return () => {};
  }

  /* =======================================================================
     Both of them on one axis — percent of their own goal closed
     ======================================================================= */
  function progress(el, o) {
    const { ctx, cv, tip, w, h } = setup(el, o.height || 180);
    const padL = 38, padR = 14, padT = 12, padB = 24;
    const ink3 = tok('--ink-3'), grid = tok('--grid'), axis = tok('--axis'), surface = tok('--surface');
    const sets = o.series.filter(s => s.points.length);
    if (!sets.length) { ctx.fillStyle = ink3; ctx.fillText('No data yet.', padL, h / 2); return () => {}; }

    const dates = [...new Set(sets.flatMap(s => s.points.map(p => p.d)))].sort();
    const x0 = dates[0], x1 = dates[dates.length - 1];
    const span = Math.max(1, N.daysBetween(x0, x1));
    const maxP = Math.max(100, ...sets.flatMap(s => s.points.map(p => p.pct)));
    const sc = niceScale(Math.min(0, ...sets.flatMap(s => s.points.map(p => p.pct))), maxP, 4);
    const X = (d) => padL + (N.daysBetween(x0, d) / span) * (w - padL - padR);
    const Y = (v) => padT + (1 - (v - sc.lo) / (sc.hi - sc.lo)) * (h - padT - padB);

    ctx.lineWidth = 1; ctx.strokeStyle = grid; ctx.fillStyle = ink3; ctx.textAlign = 'right';
    for (let v = sc.lo; v <= sc.hi + 1e-6; v += sc.step) {
      const y = Math.round(Y(v)) + .5;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(Math.round(v) + '%', padL - 6, y + 3.5);
    }
    ctx.textAlign = 'center';
    const marks = dates.length > 2 ? [x0, dates[Math.floor(dates.length / 2)], x1] : dates;
    marks.forEach(d => ctx.fillText(fmtShort(d), Math.min(w - padR - 10, Math.max(padL + 10, X(d))), h - 7));

    /* the 100% line: goal reached */
    ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = axis; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(padL, Y(100)); ctx.lineTo(w - padR, Y(100)); ctx.stroke(); ctx.restore();

    sets.forEach(s => {
      const sc2 = resolveColor(s.color);
      ctx.strokeStyle = sc2; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      s.points.forEach((p, i) => i ? ctx.lineTo(X(p.d), Y(p.pct)) : ctx.moveTo(X(p.d), Y(p.pct)));
      ctx.stroke();
      const last = s.points[s.points.length - 1];
      ctx.fillStyle = surface; ctx.beginPath(); ctx.arc(X(last.d), Y(last.pct), 5.5, 0, 7); ctx.fill();
      ctx.fillStyle = sc2; ctx.beginPath(); ctx.arc(X(last.d), Y(last.pct), 4, 0, 7); ctx.fill();
      ctx.fillStyle = tok('--ink-2'); ctx.textAlign = 'left'; ctx.font = '600 11px ' + tok('--font', 'system-ui');
      ctx.fillText(` ${s.label} ${Math.round(last.pct)}%`, Math.min(w - padR - 54, X(last.d) + 5), Math.max(padT + 9, Y(last.pct) - 7));
    });

    const hit = (ev) => {
      const r = cv.getBoundingClientRect();
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      let bestD = null, bd = 1e9;
      for (const d of dates) { const dx = Math.abs(X(d) - px); if (dx < bd) { bd = dx; bestD = d; } }
      if (bestD == null || bd > 34) { tip.classList.remove('on'); return; }
      const rows = sets.map(s => { const p = s.points.find(q => q.d === bestD); return p ? `${s.label} ${Math.round(p.pct)}%` : null; }).filter(Boolean);
      if (!rows.length) { tip.classList.remove('on'); return; }
      tip.innerHTML = `<b>${fmtShort(bestD)}</b> &nbsp;${rows.join(' &nbsp;· ')}`;
      tip.classList.add('on');
      tip.style.left = Math.max(2, Math.min(el.clientWidth - tip.offsetWidth - 2, X(bestD) - tip.offsetWidth / 2)) + 'px';
      tip.style.top = '2px';
    };
    cv.addEventListener('pointermove', hit);
    cv.addEventListener('pointerdown', hit);
    cv.addEventListener('pointerleave', () => tip.classList.remove('on'));
    return () => {};
  }

  /* =======================================================================
     Bars — adherence per day, cardio minutes per week
     ======================================================================= */
  function bars(el, o) {
    const { ctx, cv, tip, w, h } = setup(el, o.height || 120);
    const padL = o.yLabels === false ? 8 : 34, padR = 10, padT = 10, padB = 20;
    const ink3 = tok('--ink-3'), grid = tok('--grid'), critical = tok('--critical');
    const data = o.bars;
    if (!data.length) { ctx.fillStyle = ink3; ctx.fillText('No data yet.', padL, h / 2); return () => {}; }
    const top = Math.max(o.max || 0, ...data.map(b => b.value)) || 1;
    const sc = niceScale(0, top, 3);
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const gap = 2;
    const bw = Math.max(3, plotW / data.length - gap);
    const Y = (v) => padT + (1 - v / sc.hi) * plotH;

    ctx.lineWidth = 1; ctx.strokeStyle = grid; ctx.fillStyle = ink3; ctx.textAlign = 'right';
    for (let v = 0; v <= sc.hi + 1e-6; v += sc.step) {
      const y = Math.round(Y(v)) + .5;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      if (o.yLabels !== false) ctx.fillText(String(Math.round(v)) + (o.suffix || ''), padL - 6, y + 3.5);
    }

    data.forEach((b, i) => {
      const x = padL + i * (bw + gap);
      const y = Y(b.value), bh = Math.max(b.value > 0 ? 2 : 0, padT + plotH - y);
      ctx.fillStyle = resolveColor(b.color || o.color);
      if (b.value <= 0) { ctx.globalAlpha = .18; ctx.fillRect(x, padT + plotH - 2, bw, 2); ctx.globalAlpha = 1; return; }
      roundTop(ctx, x, y, bw, bh, Math.min(4, bw / 2));
      ctx.fill();
    });

    if (o.reference) {
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = tok('--axis'); ctx.lineWidth = 2;
      const y = Y(o.reference.value);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke(); ctx.restore();
      ctx.fillStyle = ink3; ctx.textAlign = 'left'; ctx.fillText(o.reference.label, padL + 2, Math.max(padT + 9, y - 4));
    }

    ctx.fillStyle = ink3; ctx.textAlign = 'center'; ctx.font = '10px ' + tok('--font', 'system-ui');
    data.forEach((b, i) => { if (b.tick) ctx.fillText(b.tick, padL + i * (bw + gap) + bw / 2, h - 6); });

    const hit = (ev) => {
      const r = cv.getBoundingClientRect();
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const i = Math.floor((px - padL) / (bw + gap));
      const b = data[i];
      if (!b) { tip.classList.remove('on'); return; }
      tip.innerHTML = `<b>${b.label}</b> &nbsp;${b.text != null ? b.text : b.value + (o.suffix || '')}`;
      tip.classList.add('on');
      tip.style.left = Math.max(2, Math.min(el.clientWidth - tip.offsetWidth - 2, padL + i * (bw + gap) + bw / 2 - tip.offsetWidth / 2)) + 'px';
      tip.style.top = Math.max(0, Y(b.value) - 32) + 'px';
    };
    cv.addEventListener('pointermove', hit);
    cv.addEventListener('pointerdown', hit);
    cv.addEventListener('pointerleave', () => tip.classList.remove('on'));
    return () => {};
  }

  function roundTop(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  /* All charts re-draw on resize and on a theme change. */
  function register(fn) { live.add(fn); return fn; }
  function redrawAll() { live.forEach(f => { try { f(); } catch (e) {} }); }
  function clearRegistry() { live.clear(); }

  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(redrawAll, 160); });
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redrawAll);
  } catch (e) {}

  return { weight, progress, bars, resolveColor, register, redrawAll, clearRegistry, fmtShort };
})();
