/* ===========================================================================
   main.js — boot, reminders, install, and the midnight rollover.
   =========================================================================== */
window.FIT = window.FIT || {};
FIT.MAIN = (() => {
  'use strict';
  const S = FIT.STORE, A = FIT.AUTH, C = FIT.COACH, N = FIT.NUTRITION, U = FIT.UI;

  let installEvent = null;
  let reminderTimer = null;

  function applyTheme() {
    const r = document.documentElement;
    const t = (S.state.prefs && S.state.prefs.theme) || 'auto';
    if (t === 'auto') {
      /* only clear the attribute if we were the ones who set it */
      if (r.getAttribute('data-theme-by') === 'fit') { r.removeAttribute('data-theme'); r.removeAttribute('data-theme-by'); }
    } else { r.setAttribute('data-theme', t); r.setAttribute('data-theme-by', 'fit'); }
  }

  function boot() {
    S.init();
    applyTheme();
    if (S.state.prefs.tab) U.h.ui.tab = S.state.prefs.tab;

    /* home-screen shortcuts: ?go=weight | today | food */
    const go = new URLSearchParams(location.search).get('go');
    if (go === 'food') U.h.ui.tab = 'food';
    else if (go === 'today' || go === 'weight') U.h.ui.tab = 'today';
    if (go) history.replaceState(null, '', location.pathname);

    U.mount(document.getElementById('app'));
    A.init();
    if (go === 'weight') setTimeout(function () {
      if (S.state.me) { U.h.ui.sheet = { name: 'weight' }; U.render(); }
    }, 600);

    /* if the app is left open past midnight, roll the date over */
    setInterval(function () {
      const t = N.todayStr();
      if (U.h.ui.date !== t) { U.h.ui.date = t; U.render(); }
    }, 30000);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { U.render(); checkReminders(); }
    });

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); installEvent = e;
    });

    /* the worker exists to back the installed app, so only register it where
       this page is actually the installable app (it has the manifest) */
    if ('serviceWorker' in navigator && location.protocol !== 'file:' && document.querySelector('link[rel="manifest"]')) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache is a bonus, not a requirement */ });
      });
    }

    startReminders();
  }

  /* =======================================================================
     Reminders.
     These fire while the app is open or has just been reopened. There is no
     server here, so there is no true background push — Settings says so
     rather than implying otherwise.
     ======================================================================= */
  function startReminders() {
    clearInterval(reminderTimer);
    reminderTimer = setInterval(checkReminders, 60000);
    setTimeout(checkReminders, 4000);
  }

  function canNotify() {
    return !!(window.Notification && Notification.permission === 'granted' && S.state.prefs.notify);
  }

  function already(key) {
    const k = 'fit:notified:' + key;
    try { if (localStorage.getItem(k)) return true; localStorage.setItem(k, '1'); return false; }
    catch (e) { return true; }
  }

  function notify(title, body, tag) {
    if (!canNotify()) return;
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function (reg) {
          reg.showNotification(title, { body: body, tag: tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
        }).catch(function () { new Notification(title, { body: body, tag: tag }); });
      } else new Notification(title, { body: body, tag: tag });
    } catch (e) { /* some browsers refuse constructor notifications; nothing to do */ }
  }

  function checkReminders() {
    if (!canNotify() || !S.state.me) return;
    const date = N.todayStr();
    const d = S.me();
    const rec = d.days[date] || {};
    const prof = d.profile;
    const now = new Date();
    const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const remind = prof.remind || {};
    const meals = rec.meals || {};

    const due = function (t) { return t && hhmm >= t; };

    if (due(remind.weigh) && !(rec.w > 0) && !already(date + ':weigh')) {
      notify('Weigh-in', 'Today’s summary is locked until the number is in.', 'weigh');
    }
    [['b', 'Breakfast'], ['l', 'Lunch'], ['d', 'Dinner']].forEach(function (pair) {
      if (due(remind[pair[0]]) && !meals[pair[0]] && !already(date + ':' + pair[0])) {
        notify(pair[1], 'Tick it off when you have eaten — an unlogged meal counts as missed for both of you.', 'meal-' + pair[0]);
      }
    });
    const session = S.view(date).session;
    if (session.kind !== 'rest' && due(remind.gym) && !(rec.workout && rec.workout.done) && !already(date + ':gym')) {
      notify('Gym · ' + session.focusLabel, U.h.mins(session.totalMinutes) + ', ' + session.cardioMinutes + ' of it cardio.', 'gym');
    }

    /* partner accountability */
    const pk = S.partnerKey(), pd = S.person(pk);
    const yest = N.addDays(date, -1);
    const sessions = S.sessionsByDate(pk, yest, 1);
    const misses = C.missesFor(pd.days, yest, 1, sessions, 23, pd.profile.startDate);
    if (misses.length && !already(date + ':partner')) {
      notify(S.DISPLAY[pk] + ' missed something yesterday',
        C.missLabel(misses[0].items) + '. Worth a nudge — the supportive kind.', 'partner');
    }
    const nudges = S.incomingNudges();
    if (nudges.length) {
      const last = nudges[nudges.length - 1];
      if (!already(date + ':nudge:' + last.id)) notify(S.DISPLAY[pk] + ' says', last.text, 'nudge');
    }
  }

  async function enableNotifications() {
    if (!window.Notification) { U.h.toast('This browser has no notifications.'); return; }
    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        S.setPref('notify', true);
        U.h.toast('Reminders on.');
        notify('Reminders on', 'You will hear about meals, the weigh-in and the gym.', 'hello');
      } else {
        S.setPref('notify', false);
        U.h.toast('Permission was declined, so reminders stay off.');
      }
    } catch (e) { U.h.toast('Could not turn reminders on.'); }
  }

  function install() {
    if (installEvent) {
      installEvent.prompt();
      installEvent.userChoice.then(function () { installEvent = null; });
      return;
    }
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    U.h.toast(iOS
      ? 'Tap the Share button, then "Add to Home Screen".'
      : 'Use your browser menu, then "Install app" or "Add to Home screen".', 6000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { enableNotifications: enableNotifications, install: install, checkReminders: checkReminders, applyTheme: applyTheme };
})();
