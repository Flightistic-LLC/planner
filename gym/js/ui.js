/* ===========================================================================
   ui.js — app shell, login, the first-open welcome, and setup.

   Rendering is innerHTML plus one delegated handler keyed on data-act, so
   every interaction in the app is a named entry in U.acts. views.js adds the
   per-tab screens to the same object.
   =========================================================================== */
window.FIT = window.FIT || {};
FIT.UI = FIT.UI || {};
(function (U) {
  'use strict';
  const S = FIT.STORE, A = FIT.AUTH, C = FIT.COACH, N = FIT.NUTRITION,
        P = FIT.PROGRAM, CDC = FIT.CDC, FOODS = FIT.FOODS, CH = FIT.CHARTS;

  /* ---------------- helpers shared with views.js ---------------- */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, r) => (r || document).querySelector(sel);
  const $$ = (sel, r) => [...(r || document).querySelectorAll(sel)];
  const svg = (d, extra) => '<svg viewBox="0 0 24 24" ' + (extra || '') + '>' + d + '</svg>';

  const ICON = {
    today: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/>'),
    plan: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
    food: svg('<path d="M4 11h16a8 8 0 0 1-16 0ZM7.5 7.2c0-1.4 1-1.9 1.4-2.9M12 7.2c0-1.4 1-1.9 1.4-2.9M16.5 7.2c0-1.4 1-1.9 1.4-2.9M2.5 21h19"/>'),
    chart: svg('<path d="M4 20V11M10 20V4M16 20v-6M21.5 20h-19"/>'),
    us: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20.5c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6"/><circle cx="17.6" cy="9.6" r="2.5"/><path d="M15.8 20.5c0-2.4 1.4-4 3.3-4 1.3 0 2.5.8 3.1 2"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.9 14.6a1.6 1.6 0 0 0 .4 1.7 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-2.7 1.1 2 2 0 1 1-4 0A1.6 1.6 0 0 0 8.1 19a1.6 1.6 0 0 0-1.7.4 2 2 0 1 1-2.8-2.8A1.6 1.6 0 0 0 4 14a1.6 1.6 0 0 0-1.5-1 2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.4-1.7 2 2 0 1 1 2.8-2.8A1.6 1.6 0 0 0 8.1 4 1.6 1.6 0 0 0 9.1 2.5a2 2 0 1 1 4 0A1.6 1.6 0 0 0 15.8 4a1.6 1.6 0 0 0 1.7-.4 2 2 0 1 1 2.8 2.8A1.6 1.6 0 0 0 20 8.1a1.6 1.6 0 0 0 1.5 1 2 2 0 1 1 0 4 1.6 1.6 0 0 0-1.5 1Z"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    check: svg('<path d="M5 12.5 9.5 17 19 7"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    bell: svg('<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>'),
    heart: svg('<path d="M20.8 5.8a4.9 4.9 0 0 0-7 0L12 7.6l-1.8-1.8a4.9 4.9 0 1 0-7 7l8.8 8.8 8.8-8.8a4.9 4.9 0 0 0 0-7Z"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.4"/>'),
    alert: svg('<path d="M10.3 3.9 2.4 17.5A1.9 1.9 0 0 0 4 20.4h16a1.9 1.9 0 0 0 1.6-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z"/><path d="M12 9.2v4M12 16.6v.4"/>'),
    dumbbell: svg('<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>'),
    share: svg('<path d="M12 16.5V4M8 7.5 12 3.5l4 4M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>'),
    flame: svg('<path d="M12 22c3.9 0 6-2.7 6-6 0-4.5-4-6-4-10 0 0-2.5 1.5-2.5 5C11.5 8 9 7 9 4.5 7.5 6 6 8.5 6 12c0 3.3 2.1 10 6 10Z"/>'),
    scale: svg('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8.5 11 12 8.2l3.5 2.8M7 15.5h10"/>'),
    back: svg('<path d="M15 5l-7 7 7 7"/>'),
    copy: svg('<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15"/>'),
    exit: svg('<path d="M15 12H3M7 8l-4 4 4 4M13 3h5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5"/>'),
    cart: svg('<circle cx="9.5" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.2l2.6 12.2a1.6 1.6 0 0 0 1.6 1.3h8.7a1.6 1.6 0 0 0 1.6-1.3L21 7H6"/>'),
    minus: svg('<path d="M5 12h14"/>')
  };

  const TABS = [
    { k: 'today', label: 'Today', icon: ICON.today },
    { k: 'plan', label: 'Plan', icon: ICON.plan },
    { k: 'food', label: 'Food', icon: ICON.food },
    { k: 'grocery', label: 'Grocery', icon: ICON.cart },
    { k: 'progress', label: 'Progress', icon: ICON.chart },
    { k: 'us', label: 'Us', icon: ICON.us }
  ];

  const lb = (v, dp) => (v == null || isNaN(v) ? '—' : (+v).toFixed(dp == null ? 1 : dp));
  const sgn = (v, dp) => (v > 0 ? '+' : '') + (+v).toFixed(dp == null ? 1 : dp);
  const mins = (m) => { const h = Math.floor(m / 60), r = Math.round(m % 60); return h && r ? h + 'h ' + r + 'm' : h ? h + 'h' : r + 'm'; };
  const kk = (v) => Math.round(v || 0).toLocaleString();
  function prettyDate(d) {
    const a = d.split('-').map(Number);
    return new Date(a[0], a[1] - 1, a[2]).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function shortDate(d) {
    const a = d.split('-').map(Number);
    return new Date(a[0], a[1] - 1, a[2]).toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
  }
  function relDay(d) {
    const diff = N.daysBetween(N.todayStr(), d);
    return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : shortDate(d);
  }
  const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
  const dayOnly = (d) => { const a = d.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };

  function toast(msg, ms) {
    const host = $('#toastHost');
    if (!host) return;
    host.innerHTML = '<div class="toast">' + esc(msg) + '</div>';
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { host.innerHTML = ''; }, ms || 2800);
  }

  const ui = {
    tab: 'today',
    date: N.todayStr(),
    sheet: null,
    login: { mode: 'signin', person: null, msg: '', busy: false },
    onboard: null,
    tables: {},
    expand: {}
  };

  let root = null;

  /* =======================================================================
     Mount
     ======================================================================= */
  function mount(el) {
    root = el;
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ui.sheet) { ui.sheet = null; render(); }
    });
    S.on('change', function (e) {
      if (e && e.from === 'merge' && e.gained > 0) {
        toast('Synced \u2014 ' + e.gained + ' day' + (e.gained === 1 ? '' : 's') + ' of ' +
          S.DISPLAY[e.person] + '\u2019s history came back.', 5000);
      }
      render();
    });
    S.on('sync', chrome);
    A.on(function (st) {
      if (st && !st.user && st.mode === 'firebase') { ui.login.busy = false; ui.login.person = null; }
      render();
    });
    render();
  }

  function render() {
    if (!root) return;
    CH.clearRegistry();
    if (!A.ready) { root.innerHTML = splash(); return; }
    if (!A.person) { root.innerHTML = loginView(); return; }

    const d = S.me();
    if (!d.seen || !d.seen.welcome) { root.innerHTML = welcomeView(); return; }
    if (!d.profile.setupDone) {
      if (!ui.onboard) ui.onboard = { step: 0 };
      root.innerHTML = onboardView();
      return;
    }
    root.innerHTML = appView();
    afterRender();
  }

  function chrome() {
    const line = $('#syncLine');
    if (line) line.textContent = S.SYNC_LABEL[S.state.sync.status] || '';
  }

  function afterRender() {
    $$('[data-chart]').forEach(function (elc) {
      let spec;
      try { spec = JSON.parse(elc.getAttribute('data-chart')); } catch (e) { return; }
      const draw = function () { U.drawChart(elc, spec); };
      draw();
      CH.register(draw);
    });
    chrome();
  }

  const splash = () => '<div class="login"><div class="box" style="text-align:center">' +
    '<div class="mark">' + ICON.dumbbell + '</div><p class="muted">Loading…</p></div></div>';

  /* =======================================================================
     Login — two accounts
     ======================================================================= */
  function loginView() {
    if (A.blocked) return blockedView();
    if (A.mode === 'passcode') return passcodeView();
    if (A.needsClaim) return claimView();

    const m = ui.login.mode;
    return '<div class="login"><div class="box">' +
      '<div class="mark">' + ICON.dumbbell + '</div>' +
      '<h1 style="text-align:center">Danil &amp; Towne</h1>' +
      '<p class="muted small" style="text-align:center;margin-top:4px">' +
        'Gym, food and honest numbers. One account each — you both see both.</p>' +
      (ui.login.msg ? '<div class="banner ' + (ui.login.err ? 'critical' : 'neutral') + '"><span class="ic">' +
        (ui.login.err ? ICON.alert : ICON.info) + '</span><div>' + esc(ui.login.msg) + '</div></div>' : '') +
      '<form data-form="login" class="card">' +
        '<div class="field"><label for="lgEmail">Email</label>' +
        '<input id="lgEmail" name="email" type="email" autocomplete="username" required inputmode="email" placeholder="you@example.com"></div>' +
        '<div class="field"><label for="lgPass">Password</label>' +
        '<input id="lgPass" name="password" type="password" autocomplete="' + (m === 'signup' ? 'new-password' : 'current-password') +
        '" required minlength="6" placeholder="' + (m === 'signup' ? 'at least 6 characters' : '') + '"></div>' +
        '<button class="btn primary full" type="submit"' + (ui.login.busy ? ' disabled' : '') + '>' +
          (ui.login.busy ? 'Working…' : (m === 'signup' ? 'Create account' : 'Sign in')) + '</button>' +
        '<div class="row" style="justify-content:space-between;margin-top:12px">' +
          '<button type="button" class="linkbtn" data-act="login-mode" data-v="' + (m === 'signup' ? 'signin' : 'signup') + '">' +
            (m === 'signup' ? 'I already have an account' : 'Create account') + '</button>' +
          '<button type="button" class="linkbtn" data-act="login-reset">Forgot password</button>' +
        '</div>' +
      '</form>' +
      '<p class="xs dim" style="text-align:center">Two accounts, one planner. Whoever signs in first picks their name.</p>' +
      '</div></div>';
  }

  /* Signed in, but the database will not answer. Setting them up fresh here
     would quietly create a second, unsynced copy of their planner — which is
     exactly the bug they hit. So stop, explain, and offer the real fix. */
  function blockedView() {
    return '<div class="login"><div class="box">' +
      '<div class="mark" style="background:var(--critical)">' + ICON.alert + '</div>' +
      '<h1 style="text-align:center">Can\u2019t reach your data</h1>' +
      '<p class="muted small" style="text-align:center">You are signed in' +
        (A.user && A.user.email ? ' as ' + esc(A.user.email) : '') +
        ', but the database is refusing to load your planner.</p>' +
      '<div class="banner critical"><span class="ic">' + ICON.alert + '</span><div>' +
        '<b>Setting you up again here would make a second, separate copy</b> that never syncs with your phone. ' +
        'So this screen stops instead.</div></div>' +
      '<div class="card tight"><div class="eyebrow">The fix — about a minute</div>' +
        '<p class="small" style="margin:6px 0">In the Firebase console, open <b>Firestore Database → Rules</b>, ' +
        'replace what is there with the rules below, and press <b>Publish</b>.</p>' +
        '<pre class="code" id="rulesBlocked">' + esc(S.RULES_AUTH) + '</pre>' +
        '<button class="btn sm" data-act="copy" data-from="#rulesBlocked">' + ICON.copy + ' Copy the rules</button>' +
      '</div>' +
      '<button class="btn primary full" data-act="retry-sync" style="margin-top:10px">Try again</button>' +
      '<div class="row" style="justify-content:space-between;margin-top:12px">' +
        '<button class="linkbtn" data-act="sync-anyway">Use this device offline</button>' +
        '<button class="linkbtn" data-act="signout">Sign out</button>' +
      '</div>' +
      '<p class="xs dim" style="margin-top:10px">Offline mode keeps everything on this phone only \u2014 nothing you log ' +
      'there reaches the other person until the rules are published.</p>' +
      '</div></div>';
  }

  function claimView() {
    const free = A.claimOptions || [];
    return '<div class="login"><div class="box">' +
      '<div class="mark">' + ICON.dumbbell + '</div>' +
      '<h1 style="text-align:center">Which one are you?</h1>' +
      '<p class="muted small" style="text-align:center">This links your account to your side of the planner. It is asked once.</p>' +
      '<div class="who">' + free.map(function (p) {
        return '<button data-act="claim" data-p="' + p + '">' +
          '<div class="av" style="background:' + 'var(--' + p + ')">' + S.DISPLAY[p][0] + '</div>' +
          S.DISPLAY[p] + '</button>';
      }).join('') + '</div>' +
      (A.error ? '<div class="banner critical"><span class="ic">' + ICON.alert + '</span><div>' + esc(A.error) + '</div></div>' : '') +
      '<button class="btn full" data-act="signout">Sign out</button>' +
      '</div></div>';
  }

  function passcodeView() {
    const p = ui.login.person;
    if (!p) {
      return '<div class="login"><div class="box">' +
        '<div class="mark">' + ICON.dumbbell + '</div>' +
        '<h1 style="text-align:center">Who’s this?</h1>' +
        (A.reason ? '<div class="banner warning"><span class="ic">' + ICON.alert + '</span><div><b>Passcode mode.</b> ' +
          esc(A.reason) + (window.FIT_HOST_NOTE ? '' :
            ' Until it is, each of you unlocks this app with a passcode on your own device. ' +
            'Settings → Sync explains how to turn on real logins — it takes about a minute.') +
          '</div></div>' : '') +
        '<div class="who">' + S.PEOPLE.map(function (k) {
          return '<button data-act="pc-person" data-p="' + k + '">' +
            '<div class="av" style="background:var(--' + k + ')">' + S.DISPLAY[k][0] + '</div>' + S.DISPLAY[k] + '</button>';
        }).join('') + '</div></div></div>';
    }
    const isSet = A.passcodeSet(p);
    return '<div class="login"><div class="box">' +
      '<button class="iconbtn" data-act="pc-person" data-p="">' + ICON.back + '</button>' +
      '<div class="mark" style="background:var(--' + p + ')">' + ICON.dumbbell + '</div>' +
      '<h1 style="text-align:center">' + S.DISPLAY[p] + '</h1>' +
      '<p class="muted small" style="text-align:center">' + (isSet ? 'Enter your passcode.' : 'Pick a passcode for this device (4–10 digits).') + '</p>' +
      (ui.login.msg ? '<div class="banner critical"><span class="ic">' + ICON.alert + '</span><div>' + esc(ui.login.msg) + '</div></div>' : '') +
      '<form data-form="passcode" class="card">' +
        '<input type="hidden" name="person" value="' + p + '">' +
        '<div class="field"><label for="pcCode">Passcode</label>' +
        '<input id="pcCode" name="code" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" required ' +
        'style="text-align:center;font-size:1.5rem;letter-spacing:.3em"></div>' +
        '<button class="btn primary full" type="submit">' + (isSet ? 'Unlock' : 'Set passcode') + '</button>' +
      '</form></div></div>';
  }

  /* =======================================================================
     The first time she opens it
     ======================================================================= */
  function welcomeView() {
    const isTowne = A.person === 'towne';
    const body = isTowne ? welcomeTowne() : welcomeDanil();
    return '<div class="screen"><div class="inner">' + body +
      '<button class="btn primary full" data-act="welcome-done" style="margin-top:18px">' +
        (isTowne ? 'Okay. Let’s do this.' : 'Let’s go') + '</button>' +
      '</div></div>';
  }

  function welcomeTowne() {
    return '<div style="text-align:center;margin-bottom:6px">' +
      '<div class="mark" style="background:var(--love);width:58px;height:58px;border-radius:17px;display:grid;place-items:center;margin:8px auto 14px">' +
      '<span style="color:#fff;display:grid;place-items:center">' + ICON.heart + '</span></div></div>' +
      '<h1 style="text-align:center;font-size:1.7rem">Hi Towne.</h1>' +
      '<p class="muted" style="text-align:center;margin-top:6px">Danil built this. For you, and for him.</p>' +
      '<div class="card">' +
        '<p><b>He made it for both of us.</b> Not a thing he is doing <i>to</i> you — he is in here too, with his own weight, ' +
        'his own meals, his own missed days showing up exactly the same way yours do. Same rules, same honesty, same app.</p>' +
        '<p><b>You can both see everything.</b> Your weight, his weight, who skipped lunch, who skipped the gym. ' +
        'That is on purpose, and it is <i>not</i> so anyone can make fun of anyone. It is so neither of you can quietly ' +
        'disappear for a week without the other one noticing and saying something nice about it.</p>' +
        '<p><b>If either of us misses something, we both get told.</b> That is the whole deal. Accountability, in both directions.</p>' +
      '</div>' +
      '<div class="card">' +
        '<h3>It is going to be honest with you</h3>' +
        '<p class="small">When the number goes the right way, it will say so. When it does not, it will tell you that too — ' +
        'and then it will tell you <i>why</i>, from your own logs, and change the plan so it works. ' +
        'It will never guess, never guilt-trip you, and never pretend a bad week did not happen.</p>' +
        '<p class="small">It also will not do the thing where an app decides you need to eat 900 calories. ' +
        'Everything in here follows the CDC’s actual guidance — 1 to 2 pounds a week, never more — and it will move the ' +
        'finish date before it will ever cut your food below a safe floor.</p>' +
      '</div>' +
      '<div class="banner love"><span class="ic">' + ICON.heart + '</span><div>' +
        '<b>And the part Danil asked to be in here every single day:</b><br>He loves you so much. ' +
        'He thinks you are the most beautiful girl in the world — at 140, at 120, and at every number in between. ' +
        'None of this is because something was wrong with you. You said you wanted it, so he built you the best version of it he could.' +
      '</div></div>' +
      '<p class="small muted">Next: a couple of quick numbers so the plan is actually yours — your height, your age, ' +
      'and the foods you will actually eat. Takes a minute.</p>';
  }

  function welcomeDanil() {
    return '<h1 style="margin-top:10px">Hey Danil.</h1>' +
      '<p class="muted">Your side of the planner. Towne has her own account on her own phone.</p>' +
      '<div class="card">' +
        '<h3>How it works</h3>' +
        '<p class="small">You each log your own weight, meals and workouts. Both of you see both sets of data, ' +
        'and when either of you misses a weigh-in, a meal or a gym day, it shows up on both sides — that is the accountability loop you asked for.</p>' +
        '<p class="small">Your plan is built for recomposition: 190 to 180 with the muscle going the other way. ' +
        'That means a smaller deficit than hers, heavier lifts, more protein, and the waist measurement mattering more than the scale.</p>' +
        '<p class="small">Towne’s plan is built around the four foods she actually eats, and the app is honest with her ' +
        'about what that list can and cannot do — kindly, with the arithmetic shown, and with the smallest possible fix offered.</p>' +
      '</div>' +
      '<div class="card"><h3>One thing worth knowing</h3>' +
      '<p class="small">Her notes include a line from you every day. They are already written — you can read and edit the whole list in Settings.</p></div>';
  }

  /* =======================================================================
     Setup
     ======================================================================= */
  function onboardView() {
    const d = S.me(), prof = d.profile, isTowne = A.person === 'towne';
    const step = ui.onboard.step;
    const steps = isTowne ? ['you', 'goal', 'gym', 'food'] : ['you', 'goal', 'gym'];
    const cur = steps[Math.min(step, steps.length - 1)];
    let body = '';

    if (cur === 'you') {
      const ft = prof.heightIn ? Math.floor(prof.heightIn / 12) : '';
      const inch = prof.heightIn ? prof.heightIn % 12 : '';
      body = '<h1>A few numbers</h1>' +
        '<p class="muted small">Height and age are what the calorie maths needs — without them the app can only guess, and it would rather not.</p>' +
        '<form data-form="ob-you" class="card">' +
          '<div class="field"><label>Height</label><div class="row">' +
            '<input name="ft" type="number" min="3" max="7" inputmode="numeric" placeholder="ft" value="' + ft + '" required style="text-align:center">' +
            '<input name="in" type="number" min="0" max="11" inputmode="numeric" placeholder="in" value="' + inch + '" required style="text-align:center">' +
          '</div></div>' +
          '<div class="field"><label for="obAge">Age</label>' +
          '<input id="obAge" name="age" type="number" min="13" max="100" inputmode="numeric" value="' + (prof.age || '') + '" required></div>' +
          '<div class="field"><label for="obSex">Used for the resting-energy formula</label>' +
            '<select id="obSex" name="sex"><option value="female"' + (prof.sex === 'female' ? ' selected' : '') + '>Female</option>' +
            '<option value="male"' + (prof.sex === 'male' ? ' selected' : '') + '>Male</option></select>' +
            '<span class="hint">The Mifflin-St Jeor equation needs this. It is not used for anything else.</span></div>' +
          '<button class="btn primary full" type="submit">Next</button>' +
        '</form>';
    } else if (cur === 'goal') {
      body = '<h1>Your goal</h1>' +
        '<p class="muted small">Pre-filled with what you told Danil. Change anything that is off.</p>' +
        '<form data-form="ob-goal" class="card">' +
          '<div class="field"><label for="obNow">Weight today (lb)</label>' +
          '<input id="obNow" name="now" type="number" step="0.1" min="50" max="600" inputmode="decimal" value="' + prof.startWeight + '" required></div>' +
          '<div class="field"><label for="obGoal">Goal weight (lb)</label>' +
          '<input id="obGoal" name="goal" type="number" step="0.1" min="50" max="600" inputmode="decimal" value="' + prof.goalWeight + '" required></div>' +
          '<div class="field"><label for="obDate">By when</label>' +
          '<input id="obDate" name="date" type="date" value="' + prof.goalDate + '" required></div>' +
          '<div class="field"><label for="obType">What you are after</label>' +
            '<select id="obType" name="type">' +
            '<option value="fatloss"' + (prof.goalType === 'fatloss' ? ' selected' : '') + '>Lose fat, keep the muscle I have, visible abs</option>' +
            '<option value="recomp"' + (prof.goalType === 'recomp' ? ' selected' : '') + '>Lose fat and build muscle at the same time (six-pack)</option>' +
            '</select></div>' +
          '<button class="btn primary full" type="submit">Next</button>' +
        '</form>';
    } else if (cur === 'gym') {
      body = '<h1>Gym time</h1>' +
        '<p class="muted small">Every day, at least an hour — that was the deal. This is the default; you can give any single day more time later and the whole session gets rebuilt around it.</p>' +
        '<form data-form="ob-gym" class="card">' +
          '<div class="field"><label>Normal session length</label><div class="row wrap">' +
            P.BUDGET_CHOICES.map(function (b) {
              return '<label class="chip' + ((prof.defaultBudget || 60) === b ? ' on' : '') + '">' +
                '<input type="radio" name="budget" value="' + b + '" class="sr"' + ((prof.defaultBudget || 60) === b ? ' checked' : '') + '>' +
                mins(b) + '</label>';
            }).join('') + '</div></div>' +
          '<button class="btn primary full" type="submit">' + (A.person === 'towne' ? 'Next' : 'Done') + '</button>' +
        '</form>' +
        '<div class="card tight"><p class="xs dim">Sunday is active recovery — you still go, you just do easy cardio and ' +
        'mobility instead of lifting. Every fourth Sunday is a real day off. You can override any day.</p></div>';
    } else {
      body = foodSetupBody(true);
    }

    return '<div class="screen"><div class="inner">' +
      '<div class="row" style="margin-bottom:10px">' +
        (step > 0 ? '<button class="iconbtn" data-act="ob-back">' + ICON.back + '</button>' : '') +
        '<div class="spacer" style="flex:1"></div>' +
        '<span class="xs dim">Step ' + (Math.min(step, steps.length - 1) + 1) + ' of ' + steps.length + '</span>' +
      '</div>' + body + '</div></div>';
  }

  function foodSetupBody(isOnboard) {
    const d = S.me();
    const allowed = d.allowedFoods;
    const core = FOODS.TOWNE_CORE, optional = FOODS.TOWNE_OPTIONAL;
    const row = function (id) {
      const f = FOODS.items[id];
      const on = allowed.indexOf(id) >= 0;
      const per = f.unit === 'g' ? '100 g' : '1 ' + f.unit;
      const m = FOODS.macros(id, f.unit === 'g' ? 100 : 1);
      return '<button class="checkrow" data-act="food-toggle" data-id="' + id + '" style="width:100%;text-align:left">' +
        '<span class="check" aria-pressed="' + on + '" role="checkbox">' + ICON.check + '</span>' +
        '<span class="body"><span class="ttl">' + esc(f.name) + '</span>' +
        '<span class="xs dim" style="display:block">' + per + ': ' + Math.round(m.kcal) + ' kcal · ' + m.p.toFixed(0) + ' g protein' +
        (f.note ? ' · ' + esc(f.note) : '') + '</span></span></button>';
    };
    return '<h1>' + (isOnboard ? 'What will you actually eat?' : 'Your food list') + '</h1>' +
      '<p class="muted small">Danil said: chicken nuggets, french fries, rice and beans. Those are ticked. ' +
      'Everything else is off until <i>you</i> tick it — nothing gets put in your meals that you did not agree to.</p>' +
      '<div class="card"><div class="eyebrow">Your four</div>' + core.map(row).join('') + '</div>' +
      '<div class="card"><div class="eyebrow">Open to trying? (all off by default)</div>' +
        '<p class="xs dim" style="margin-bottom:6px">Ticking even one of the first two changes what this plan can do for you. ' +
        'The Food tab explains exactly why, with the numbers.</p>' +
        optional.map(row).join('') + '</div>' +
      (isOnboard ? '<button class="btn primary full" data-act="ob-finish">Done — build my plan</button>' : '');
  }

  /* =======================================================================
     App shell
     ======================================================================= */
  function appView() {
    const v = S.view(ui.date);
    const body = U.tabView(ui.tab, v);
    const attention = U.attentionCount();
    return '<div class="app">' +
      '<nav class="tabbar" aria-label="Sections">' +
        '<div class="brand"><span class="m">' + ICON.dumbbell + '</span>Danil &amp; Towne</div>' +
        TABS.map(function (t) {
          return '<button data-act="tab" data-v="' + t.k + '"' + (ui.tab === t.k ? ' aria-current="page"' : '') + '>' +
            t.icon + '<span>' + t.label + '</span>' +
            (t.k === 'us' && attention ? '<span class="dotflag" id="usFlag" aria-label="' + attention + ' things need attention"></span>' : '') +
            '</button>';
        }).join('') +
      '</nav>' +
      '<div style="flex:1;min-width:0">' +
        '<header class="topbar"><div class="inner">' +
          '<div style="min-width:0"><h1>' + esc(U.tabTitle(ui.tab, v)) + '</h1>' +
          '<div class="sub">' + esc(U.tabSub(ui.tab, v)) + '</div></div>' +
          '<div style="flex:1"></div>' +
          '<button class="iconbtn" data-act="sheet" data-v="settings" aria-label="Settings">' + ICON.gear + '</button>' +
        '</div></header>' +
        '<main class="shell" id="shell">' + body + '</main>' +
      '</div>' +
      '</div>' + (ui.sheet ? U.sheetView(ui.sheet) : '');
  }

  /* =======================================================================
     Events
     ======================================================================= */
  function onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.getAttribute('data-act');
    const fn = U.acts[act];
    if (!fn) return;
    e.preventDefault();
    fn(t, e);
  }

  function onChange(e) {
    const t = e.target.closest('[data-change]');
    if (!t) return;
    const fn = U.acts[t.getAttribute('data-change')];
    if (fn) fn(t, e);
  }

  function onSubmit(e) {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    const name = f.getAttribute('data-form');
    const data = {};
    new FormData(f).forEach(function (v, k2) { data[k2] = v; });
    const fn = U.forms[name];
    if (fn) fn(data, f);
  }

  /* =======================================================================
     Actions defined here; views.js adds more to the same tables
     ======================================================================= */
  U.acts = {
    tab: function (t) { ui.tab = t.getAttribute('data-v'); S.setPref('tab', ui.tab); render(); window.scrollTo(0, 0); },
    sheet: function (t) { ui.sheet = { name: t.getAttribute('data-v'), arg: t.getAttribute('data-arg') }; render(); },
    'sheet-close': function () { ui.sheet = null; render(); },

    'login-mode': function (t) { ui.login.mode = t.getAttribute('data-v'); ui.login.msg = ''; render(); },
    'login-reset': function () {
      const email = ($('#lgEmail') || {}).value;
      if (!email) { ui.login.msg = 'Type your email above first, then tap this again.'; ui.login.err = true; return render(); }
      A.resetPassword(email).then(function (r) {
        ui.login.msg = r.ok ? 'Password reset email sent to ' + email + '.' : r.error;
        ui.login.err = !r.ok; render();
      });
    },
    claim: function (t) { A.claim(t.getAttribute('data-p')); },
    signout: function () {
      A.signOut().then(function () { ui.login = { mode: 'signin', person: null, msg: '' }; ui.sheet = null; render(); });
    },
    'pc-person': function (t) { ui.login.person = t.getAttribute('data-p') || null; ui.login.msg = ''; render(); },
    'sync-anyway': function () { A.blocked = false; A.allowOffline = true; A.needsClaim = (A.claimOptions || []).length > 0; render(); },

    'welcome-done': function () { S.markSeen('welcome'); ui.onboard = { step: 0 }; render(); },
    'ob-back': function () { ui.onboard.step = Math.max(0, ui.onboard.step - 1); render(); },
    'ob-finish': function () {
      ui.onboard = null; ui.tab = 'today';
      S.setProfile({ setupDone: true });
      render();
      setTimeout(function () { if (FIT.MAIN) FIT.MAIN.maybeWeeklyList(); }, 900);
    },
    'food-toggle': function (t) {
      S.toggleFood(t.getAttribute('data-id'));
      if (ui.onboard) render();
    },

    'copy': function (t) {
      const txt = t.getAttribute('data-text') || ($(t.getAttribute('data-from')) || {}).textContent || '';
      const done = function () { toast('Copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { toast('Could not copy'); });
      else {
        const ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (err) { toast('Could not copy'); }
        ta.remove();
      }
    },
    'table-toggle': function (t) {
      const key = t.getAttribute('data-k');
      ui.tables[key] = !ui.tables[key];
      render();
    },
    'expand': function (t) {
      const key = t.getAttribute('data-k');
      ui.expand[key] = !ui.expand[key];
      render();
    }
  };

  U.forms = {
    login: function (data, form) {
      ui.login.busy = true; ui.login.msg = ''; render();
      const go = ui.login.mode === 'signup' ? A.signUp : A.signIn;
      go(data.email, data.password).then(function (r) {
        ui.login.busy = false;
        if (!r.ok) {
          ui.login.msg = r.error; ui.login.err = true;
          /* "that email already exists" is almost always someone signing back
             in, so put them on the right form instead of making them find it */
          if (/already an account/i.test(r.error || '')) ui.login.mode = 'signin';
          if (/No account with that email/i.test(r.error || '')) ui.login.mode = 'signup';
        }
        render();
      });
    },
    passcode: function (data) {
      const p = data.person, code = String(data.code || '');
      const isSet = A.passcodeSet(p);
      (isSet ? A.passcodeLogin(p, code) : A.setPasscode(p, code)).then(function (r) {
        if (!r.ok) { ui.login.msg = r.error; render(); }
      });
    },
    'ob-you': function (data) {
      const h = (+data.ft) * 12 + (+data.in);
      if (!(h >= 36 && h <= 95)) { toast('That height does not look right.'); return; }
      ui.onboard.step = 1;
      S.setProfile({ heightIn: h, age: +data.age, sex: data.sex });
      render();
    },
    'ob-goal': function (data) {
      const now = +data.now, goal = +data.goal;
      if (!(now > 50 && now < 600) || !(goal > 50 && goal < 600)) { toast('Check those weights.'); return; }
      const prof = S.me().profile;
      const range = CDC.healthyWeightRange(prof.heightIn);
      if (range && goal < range.lo) {
        toast('That goal is below the healthy range for your height (' + Math.round(range.lo) + ' lb). Pick ' + Math.round(range.lo) + ' or above.', 5200);
        return;
      }
      S.setProfile({
        startWeight: now, goalWeight: goal, goalDate: data.date,
        goalType: data.type, startDate: N.todayStr(), startWeightConfirmed: true
      });
      ui.onboard.step = 2;
      S.setWeight(N.todayStr(), now);
      render();
    },
    'ob-gym': function (data) {
      const toFood = A.person === 'towne';
      if (toFood) ui.onboard.step = 3; else ui.onboard = null;
      S.setProfile({ defaultBudget: +data.budget || 60, setupDone: !toFood });
      if (!toFood) ui.tab = 'today';
      render();
      if (!toFood) setTimeout(function () { if (FIT.MAIN) FIT.MAIN.maybeWeeklyList(); }, 900);
    }
  };

  /* shared out to views.js */
  U.h = {
    esc: esc, $: $, $$: $$, svg: svg, ICON: ICON, TABS: TABS, lb: lb, sgn: sgn, mins: mins, kk: kk,
    prettyDate: prettyDate, shortDate: shortDate, relDay: relDay, greet: greet, dayOnly: dayOnly,
    toast: toast, ui: ui, render: render, foodSetupBody: foodSetupBody
  };
  U.mount = mount;
  U.render = render;
})(FIT.UI);
