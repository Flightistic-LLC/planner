/* ===========================================================================
   store.js — local-first state with live two-way sync.

   Shape: one Firestore document per person, in this app's own collection.

       fitness/danil     written only by Danil
       fitness/towne     written only by Towne
       fitness/shared    tiny, merge-written, who claimed which slot

   It deliberately does NOT share the `planners` collection with the homework
   planner. That one's rules are written tightly around its own document shape,
   and a shared collection would mean one app's rules could break the other.

   Each person only ever writes their own document, and nudges live on the
   sender's document as `nudgesOut`. That means there is no write contention
   between the two of them at all — no lost edits, no clobbering, even if both
   phones are logging dinner at the same moment.

   Everything is mirrored to localStorage first, so the app is fully usable
   with no network and syncs when it comes back.
   =========================================================================== */
window.FIT = window.FIT || {};
FIT.STORE = (() => {
  'use strict';
  const N = FIT.NUTRITION;

  const CREW = 'dt1';
  const PEOPLE = ['danil', 'towne'];
  const COLL = 'fitness';
  const DOC = (p) => p;
  const LS = (p) => `fit:${CREW}:${p}`;
  const LS_PREFS = `fit:${CREW}:prefs`;
  const SCHEMA = 1;

  const DISPLAY = { danil: 'Danil', towne: 'Towne' };

  /* ---- the two profiles, seeded from what Danil asked for ---- */
  function defaultProfile(person) {
    const today = N.todayStr();
    const goalDate = N.addDays(today, 91);         /* three months */
    if (person === 'towne') {
      return {
        person: 'towne', name: 'Towne', sex: 'female', age: null, heightIn: null,
        startWeight: 140, goalWeight: 120, goalDate, startDate: today,
        goalType: 'fatloss', wants: 'Lose 20 lb and have abs',
        defaultBudget: 60, fullRestEvery: 4, equip: null,
        cardioPref: FIT.PROGRAM.CARDIO_DEFAULT.towne.slice(),
        remind: { weigh: '08:00', b: '09:00', l: '13:00', d: '19:00', gym: '17:30' }
      };
    }
    return {
      person: 'danil', name: 'Danil', sex: 'male', age: null, heightIn: null,
      startWeight: 190, goalWeight: 180, goalDate, startDate: today,
      goalType: 'recomp', wants: 'Get to 180, build muscle, visible six-pack',
      defaultBudget: 60, fullRestEvery: 4, equip: null,
      cardioPref: FIT.PROGRAM.CARDIO_DEFAULT.danil.slice(),
      remind: { weigh: '08:00', b: '09:00', l: '13:00', d: '19:00', gym: '17:30' }
    };
  }

  function blank(person) {
    return {
      v: SCHEMA, person, authUid: null,
      profile: defaultProfile(person),
      days: {}, lifts: {},
      adjust: { kcal: 0, cardio: 0, at: null, reason: '', history: [] },
      allowedFoods: person === 'towne' ? FIT.FOODS.TOWNE_CORE.slice() : FIT.FOODS.ALL_IDS.slice(),
      coreVersion: FIT.FOODS.CORE_VERSION,
      pantry: {}, nudgesOut: [], seen: {}, updatedAt: 0
    };
  }

  /* ---- state ---- */
  const state = {
    me: null,
    data: { danil: blank('danil'), towne: blank('towne') },
    shared: {},
    sync: { status: 'local', detail: '', lastError: null, lastPush: 0 },
    prefs: { theme: 'auto', notify: false, lastSeenFeed: 0, tab: 'today' },
    ready: false
  };

  /* ---- events ---- */
  const subs = {};
  function on(ev, fn) { (subs[ev] = subs[ev] || []).push(fn); return () => off(ev, fn); }
  function off(ev, fn) { if (subs[ev]) subs[ev] = subs[ev].filter(f => f !== fn); }
  function emit(ev, payload) { (subs[ev] || []).forEach(f => { try { f(payload); } catch (e) { console.error(e); } }); }

  /* ---- local persistence ---- */
  function loadLocal() {
    for (const p of PEOPLE) {
      try {
        const raw = localStorage.getItem(LS(p));
        if (raw) state.data[p] = migrate(JSON.parse(raw), p);
      } catch (e) { /* corrupt entry: fall back to blank, never crash */ }
    }
    try {
      const raw = localStorage.getItem(LS_PREFS);
      if (raw) Object.assign(state.prefs, JSON.parse(raw));
    } catch (e) {}
  }
  function saveLocal(p) {
    try { localStorage.setItem(LS(p), JSON.stringify(state.data[p])); } catch (e) {}
  }
  function savePrefs() {
    try { localStorage.setItem(LS_PREFS, JSON.stringify(state.prefs)); } catch (e) {}
    emit('prefs', state.prefs);
  }

  function migrate(d, person) {
    const b = blank(person);
    const out = {
      ...b, ...d,
      profile: { ...b.profile, ...(d.profile || {}) },
      days: d.days || {}, lifts: d.lifts || {},
      adjust: { ...b.adjust, ...(d.adjust || {}) },
      allowedFoods: Array.isArray(d.allowedFoods) ? d.allowedFoods : b.allowedFoods,
      pantry: (d.pantry && typeof d.pantry === 'object') ? d.pantry : {},
      nudgesOut: Array.isArray(d.nudgesOut) ? d.nudgesOut : [],
      seen: d.seen || {}, v: SCHEMA, person
    };
    /* New foods added to the standard list reach existing installs here. It
       only ever adds; nothing anyone un-ticked is put back. */
    if ((d.coreVersion || 0) < FIT.FOODS.CORE_VERSION) {
      const add = person === 'towne' ? FIT.FOODS.TOWNE_CORE : FIT.FOODS.ALL_IDS;
      for (const id of add) if (out.allowedFoods.indexOf(id) < 0) out.allowedFoods.push(id);
      out.coreVersion = FIT.FOODS.CORE_VERSION;
      out.foodsJustAdded = true;
    } else out.coreVersion = d.coreVersion;
    /* never let a corrupt day record take the app down */
    for (const k of Object.keys(out.days)) {
      const r = out.days[k];
      if (!r || typeof r !== 'object') { delete out.days[k]; continue; }
      if (r.w != null && !(r.w > 0)) delete r.w;
      if (r.meals && typeof r.meals !== 'object') delete r.meals;
    }
    return out;
  }

  /* =======================================================================
     Firestore
     ======================================================================= */
  const fs = { db: null, unsub: [], pushTimer: null, queued: false, merged: {} };

  function setSync(status, detail) {
    if (state.sync.status === status && state.sync.detail === detail) return;
    state.sync.status = status;
    state.sync.detail = detail || '';
    emit('sync', state.sync);
  }

  const SYNC_LABEL = {
    local:      'Saved on this device only.',
    connecting: 'Connecting…',
    live:       'Live. Both of you see the same data.',
    offline:    'Offline — changes are saved here and will sync when you reconnect.',
    denied:     'The database is refusing writes. Firestore rules need updating (Settings → Sync).',
    error:      'Sync trouble. Nothing is lost — it is all saved on this device.'
  };

  function startSync() {
    if (!window.firebase || !window.FIREBASE_CONFIG) { setSync('local', 'No Firebase config found.'); return; }
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      fs.db = firebase.firestore();
      try { fs.db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) {}
      setSync('connecting');
      stopSync();
      fs.merged = {};
      for (const p of PEOPLE) {
        const ref = fs.db.collection(COLL).doc(DOC(p));
        fs.unsub.push(ref.onSnapshot(
          { includeMetadataChanges: true },
          (snap) => onSnap(p, snap),
          (err) => onErr(err)
        ));
      }
      fs.unsub.push(fs.db.collection(COLL).doc(DOC('shared')).onSnapshot(
        (snap) => { if (snap.exists) { state.shared = snap.data() || {}; emit('shared', state.shared); } },
        () => {}
      ));
    } catch (e) {
      setSync('error', String(e && e.message || e));
    }
  }

  function stopSync() { fs.unsub.forEach(u => { try { u(); } catch (e) {} }); fs.unsub = []; }

  function onSnap(person, snap) {
    if (!snap.exists) {
      if (person === state.me && (state.data[person].updatedAt || 0) > 0) push();
      else setSync('live');
      return;
    }
    const remote = snap.data() || {};
    const rUp = +remote.updatedAt || 0, lUp = +(state.data[person].updatedAt || 0);

    /* First real meeting with the server copy: merge instead of overwrite, so
       neither phone's history is lost. Afterwards, newest wins as normal. */
    if (!snap.metadata.fromCache && !fs.merged[person]) {
      fs.merged[person] = true;
      if (lUp > 0 && rUp > 0) {
        const gained = newDays(remote, state.data[person]);
        state.data[person] = mergeDocs(state.data[person], remote, person);
        saveLocal(person);
        emit('change', { person, from: 'merge', gained: gained });
        if (person === state.me) push();
        setSync('live');
        return;
      }
    }

    if (rUp > lUp) {
      state.data[person] = migrate(remote, person);
      saveLocal(person);
      emit('change', { person, from: 'remote' });
    } else if (person === state.me && lUp > rUp) {
      push();
    }
    if (!snap.metadata.fromCache) setSync('live');
    else if (state.sync.status !== 'live') setSync('offline');
  }

  function onErr(err) {
    state.sync.lastError = err;
    const code = (err && err.code) || '';
    if (code === 'permission-denied') setSync('denied', describeDenied());
    else if (code === 'unavailable') setSync('offline');
    else setSync('error', (err && err.message) || String(err));
  }

  function describeDenied() {
    return FIT.AUTH && FIT.AUTH.mode === 'firebase' && FIT.AUTH.user
      ? 'Signed in, but the Firestore rules do not allow this document yet.'
      : 'Firestore rules require a signed-in user, or deny access entirely.';
  }


  /* =======================================================================
     Merging two copies of the same person.

     The first time a device meets the server copy, both sides may hold real
     history that the other has never seen — which is exactly what happens
     when two phones have been running without syncing. Taking the newer
     document wholesale would throw one of them away, so the first meeting is
     a merge, per day, and only after that does newest-wins apply.
     ======================================================================= */

  /** How much a single day's record actually holds. */
  function dayScore(r) {
    if (!r || typeof r !== 'object') return -1;
    return (r.w > 0 ? 4 : 0) +
      (r.meals ? Object.keys(r.meals).length : 0) +
      (r.workout && r.workout.done ? 3 : 0) +
      (r.workout && r.workout.completed ? r.workout.completed.length * 0.1 : 0) +
      (r.waist > 0 ? 1 : 0) +
      (r.extras ? Object.keys(r.extras).length : 0) +
      (r.sets ? Object.keys(r.sets).length : 0);
  }

  function mergeDocs(a, b, person) {
    const L = migrate(a || {}, person), R = migrate(b || {}, person);
    const out = { ...R };

    out.days = { ...R.days };
    for (const k of Object.keys(L.days)) {
      out.days[k] = R.days[k] ? (dayScore(L.days[k]) > dayScore(R.days[k]) ? L.days[k] : R.days[k]) : L.days[k];
    }

    out.lifts = { ...R.lifts };
    for (const k of Object.keys(L.lifts || {})) {
      const x = L.lifts[k], y = R.lifts[k];
      if (!y || (x.date || '') > (y.date || '')) out.lifts[k] = x;
    }

    out.pantry = { ...(R.pantry || {}) };
    for (const k of Object.keys(L.pantry || {})) {
      const x = L.pantry[k], y = R.pantry[k];
      if (!y || (x.at || 0) > (y.at || 0)) out.pantry[k] = x;
    }

    out.allowedFoods = (R.allowedFoods || []).slice();
    (L.allowedFoods || []).forEach(id => { if (out.allowedFoods.indexOf(id) < 0) out.allowedFoods.push(id); });

    const ids = new Set((R.nudgesOut || []).map(n => n.id));
    out.nudgesOut = (R.nudgesOut || []).concat((L.nudgesOut || []).filter(n => !ids.has(n.id)))
      .sort((x, y) => (x.at || 0) - (y.at || 0)).slice(-60);

    out.seen = { ...(R.seen || {}) };
    for (const k of Object.keys(L.seen || {})) {
      const x = L.seen[k], y = R.seen[k];
      out.seen[k] = (y == null) ? x : (typeof x === 'number' && typeof y === 'number') ? Math.max(x, y) : (x > y ? x : y);
    }

    /* the profile that finished setup wins; failing that, the newer one */
    const lNewer = (L.updatedAt || 0) >= (R.updatedAt || 0);
    out.profile = (R.profile.setupDone && !L.profile.setupDone) ? R.profile
      : (L.profile.setupDone && !R.profile.setupDone) ? L.profile
      : (lNewer ? L.profile : R.profile);
    /* keep the earliest start date so no logged history falls outside the plan */
    const starts = [L.profile.startDate, R.profile.startDate].filter(Boolean).sort();
    if (starts.length) out.profile = { ...out.profile, startDate: starts[0] };

    const la = L.adjust || {}, ra = R.adjust || {};
    out.adjust = ((la.at || '') > (ra.at || '')) ? { ...la } : { ...ra };
    const seenH = new Set();
    out.adjust.history = (ra.history || []).concat(la.history || []).filter(h => {
      const key = h.at + ':' + h.kcal + ':' + h.cardio;
      if (seenH.has(key)) return false;
      seenH.add(key); return true;
    }).sort((x, y) => (x.at < y.at ? -1 : 1));

    out.authUid = R.authUid || L.authUid || null;
    if (L.pcHash || R.pcHash) out.pcHash = R.pcHash || L.pcHash;
    out.coreVersion = Math.max(L.coreVersion || 0, R.coreVersion || 0);
    out.updatedAt = Math.max(L.updatedAt || 0, R.updatedAt || 0) + 1;
    return out;
  }

  /** Count of dates one side had that the other did not. */
  function newDays(from, into) {
    let n = 0;
    for (const k of Object.keys((from && from.days) || {})) if (!(into.days || {})[k]) n++;
    return n;
  }

  /* ---- carrying data by hand, when there is no database ---- */
  function exportText(personKey) {
    const key = personKey || state.me;
    return JSON.stringify({ app: 'dt-fit', v: SCHEMA, person: key, exportedAt: Date.now(), doc: compact(state.data[key]) });
  }

  function importText(txt) {
    let obj;
    try { obj = JSON.parse(String(txt).trim()); }
    catch (e) { return { ok: false, error: 'That is not a valid backup \u2014 copy the whole block, including the braces.' }; }
    if (!obj || obj.app !== 'dt-fit' || !obj.doc) return { ok: false, error: 'That does not look like a planner backup.' };
    const person = (obj.person === 'danil' || obj.person === 'towne') ? obj.person : state.me;
    const added = newDays(obj.doc, state.data[person]);
    state.data[person] = mergeDocs(obj.doc, state.data[person], person);
    saveLocal(person);
    if (person === state.me) push();
    emit('change', { person, from: 'import' });
    return { ok: true, person: person, added: added };
  }

  /** Keep the document small: days older than 180 days keep only the weight. */
  function compact(d) {
    const cutoff = N.addDays(N.todayStr(), -180);
    const days = {};
    for (const k of Object.keys(d.days)) {
      const r = d.days[k];
      if (k >= cutoff) days[k] = r;
      else if (r && r.w > 0) days[k] = { w: r.w };
    }
    const nudges = (d.nudgesOut || []).slice(-60);
    return { ...d, days, nudgesOut: nudges };
  }

  function push() {
    if (!fs.db || !state.me) { fs.queued = true; return; }
    clearTimeout(fs.pushTimer);
    fs.pushTimer = setTimeout(() => {
      const body = compact(state.data[state.me]);
      state.sync.lastPush = Date.now();
      fs.db.collection(COLL).doc(DOC(state.me)).set(body)
        .then(() => { if (state.sync.status !== 'live') setSync('live'); })
        .catch(onErr);
    }, 600);
  }

  /** The two-line fix for a `denied` status, shown in Settings. */
  /* Paste-ready rules that keep the homework planner working exactly as it
     does today and add this app alongside it. */
  const RULES_AUTH = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Towne's homework planner - unchanged
    match /planners/{key} {
      allow read: if key.size() >= 20;
      allow write: if key.size() >= 20
        && request.resource.data.keys().hasOnly(['settings', 'assignments', 'classes', 'updatedAt'])
        && request.resource.data.assignments is list
        && request.resource.data.assignments.size() <= 500;
    }

    // Gym planner - signed in, and each person writes only their own document
    match /fitness/{doc} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
        && (!('authUid' in resource.data) || resource.data.authUid == request.auth.uid);
    }

    match /{document=**} { allow read, write: if false; }
  }
}`;

  const RULES_OPEN = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /planners/{key} {
      allow read: if key.size() >= 20;
      allow write: if key.size() >= 20
        && request.resource.data.keys().hasOnly(['settings', 'assignments', 'classes', 'updatedAt'])
        && request.resource.data.assignments is list
        && request.resource.data.assignments.size() <= 500;
    }
    match /fitness/{doc} { allow read, write: if true; }
    match /{document=**} { allow read, write: if false; }
  }
}`;

  /* =======================================================================
     Mutations — everything funnels through here so every change is saved,
     pushed and announced exactly once.
     ======================================================================= */
  function touch(person) {
    const p = person || state.me;
    state.data[p].updatedAt = Date.now();
    saveLocal(p);
    if (p === state.me) push();
    emit('change', { person: p, from: 'local' });
  }

  const me = () => state.data[state.me] || blank('towne');
  const other = () => state.data[state.me === 'danil' ? 'towne' : 'danil'];
  const partnerKey = () => (state.me === 'danil' ? 'towne' : 'danil');
  const person = (k) => state.data[k];

  function day(dateStr, personKey) {
    const d = state.data[personKey || state.me];
    return d.days[dateStr] || null;
  }

  function ensureDay(dateStr) {
    const d = me();
    if (!d.days[dateStr]) d.days[dateStr] = {};
    return d.days[dateStr];
  }

  function setWeight(dateStr, lb) {
    const w = Math.round(+lb * 10) / 10;
    if (!(w > 40 && w < 700)) return { ok: false, error: 'That weight does not look right. Enter it in pounds.' };
    const rec = ensureDay(dateStr);
    const prev = rec.w;
    rec.w = w;
    rec.wAt = Date.now();
    /* first weigh-in ever doubles as the start weight, so the trend line is real */
    const prof = me().profile;
    if (!prof.startWeightConfirmed) { prof.startWeight = w; prof.startDate = dateStr; prof.startWeightConfirmed = true; }
    touch();
    return { ok: true, w, prev };
  }

  function setWaist(dateStr, inches) {
    const rec = ensureDay(dateStr);
    if (inches === null || inches === '') delete rec.waist;
    else { const v = Math.round(+inches * 10) / 10; if (!(v > 10 && v < 90)) return { ok: false }; rec.waist = v; }
    touch(); return { ok: true };
  }

  /** `items` is [{id, q}] for what that meal actually contains, so eating it
      comes out of the kitchen stock and un-ticking puts it back. */
  function toggleMeal(dateStr, meal, items) {
    const rec = ensureDay(dateStr);
    rec.meals = rec.meals || {};
    const turningOn = !rec.meals[meal];
    if (turningOn) {
      rec.meals[meal] = Date.now();
      if (items && items.length) {
        rec.consumed = rec.consumed || {};
        rec.consumed[meal] = items.map(i => ({ id: i.id, q: i.q }));
        consume(rec.consumed[meal], -1);
      }
    } else {
      delete rec.meals[meal];
      if (rec.consumed && rec.consumed[meal]) { consume(rec.consumed[meal], +1); delete rec.consumed[meal]; }
    }
    touch();
    return turningOn;
  }

  /** Move stock by `sign` x quantity. Never goes below zero. */
  function consume(items, sign) {
    const d = me();
    d.pantry = d.pantry || {};
    for (const it of items) {
      const cur = d.pantry[it.id];
      if (!cur || typeof cur.stock !== 'number') continue;   /* untracked: ignore */
      cur.stock = Math.max(0, Math.round((cur.stock + sign * it.q) * 100) / 100);
      cur.at = Date.now();
      if (sign < 0 && cur.low) { /* leave the flag where the person put it */ }
    }
  }

  /* ---- extras: drinks and snacks logged beside the three meals ---- */
  function setExtra(dateStr, foodId, delta) {
    const rec = ensureDay(dateStr);
    rec.extras = rec.extras || {};
    const before = rec.extras[foodId] || 0;
    const after = Math.max(0, Math.min(20, before + delta));
    if (after) rec.extras[foodId] = after; else delete rec.extras[foodId];
    if (after !== before) consume([{ id: foodId, q: after - before }], -1);
    touch();
    return after;
  }

  /* ---- the kitchen ---- */
  function setStock(foodId, units) {
    const d = me();
    d.pantry = d.pantry || {};
    const v = Math.max(0, Math.round((+units) * 100) / 100);
    d.pantry[foodId] = { ...(d.pantry[foodId] || {}), stock: isNaN(v) ? 0 : v, at: Date.now() };
    touch();
  }

  function setLow(foodId, low) {
    const d = me();
    d.pantry = d.pantry || {};
    d.pantry[foodId] = { ...(d.pantry[foodId] || {}), low: !!low, at: Date.now() };
    touch();
  }

  function clearStock(foodId) {
    const d = me();
    if (d.pantry) delete d.pantry[foodId];
    touch();
  }

  /** One kitchen, two writers: merge both people's entries, newest edit wins. */
  function pantry() {
    const out = {};
    for (const p of PEOPLE) {
      const map = (state.data[p] && state.data[p].pantry) || {};
      for (const id of Object.keys(map)) {
        const e = map[id];
        if (!e) continue;
        if (!out[id] || (e.at || 0) > (out[id].at || 0)) out[id] = { ...e, by: p };
      }
    }
    return out;
  }

  function setMealChoice(dateStr, meal, templateId) {
    const rec = ensureDay(dateStr);
    rec.mealPick = rec.mealPick || {};
    if (templateId) rec.mealPick[meal] = templateId; else delete rec.mealPick[meal];
    touch();
  }

  function setBudget(dateStr, minutes) {
    const rec = ensureDay(dateStr);
    rec.budget = Math.max(30, Math.min(300, Math.round(+minutes)));
    touch();
  }

  function setMode(dateStr, mode) {
    const rec = ensureDay(dateStr);
    if (mode && mode !== 'auto') rec.mode = mode; else delete rec.mode;
    touch();
  }

  function toggleExercise(dateStr, exId) {
    const rec = ensureDay(dateStr);
    rec.workout = rec.workout || { completed: [] };
    rec.workout.completed = rec.workout.completed || [];
    const i = rec.workout.completed.indexOf(exId);
    if (i >= 0) rec.workout.completed.splice(i, 1); else rec.workout.completed.push(exId);
    touch();
    return i < 0;
  }

  function completeWorkout(dateStr, { minutes, cardio, done }) {
    const rec = ensureDay(dateStr);
    rec.workout = rec.workout || {};
    rec.workout.done = done !== false;
    if (!rec.workout.done) { delete rec.workout.done; }
    else {
      rec.workout.minutes = Math.round(minutes || 0);
      rec.workout.cardio = Math.round(cardio || 0);
      rec.workout.at = Date.now();
    }
    touch();
  }

  function logLift(exId, weight, reps, dateStr) {
    const d = me();
    const w = +weight, r = +reps;
    if (!(w >= 0) || !(r > 0)) return false;
    d.lifts[exId] = { w, reps: r, date: dateStr };
    const rec = ensureDay(dateStr);
    rec.sets = rec.sets || {};
    rec.sets[exId] = { w, reps: r };
    touch();
    return true;
  }

  function setProfile(patch) {
    Object.assign(me().profile, patch);
    touch();
  }

  function setAllowedFoods(list) { me().allowedFoods = list.slice(); touch(); }
  function toggleFood(id) {
    const d = me();
    const i = d.allowedFoods.indexOf(id);
    if (i >= 0) d.allowedFoods.splice(i, 1); else d.allowedFoods.push(id);
    touch();
    return i < 0;
  }

  function applyAdjustment(adj, dateStr, verdictKey) {
    const d = me();
    d.adjust.history = d.adjust.history || [];
    d.adjust.history.push({ at: dateStr, kcal: adj.kcal || 0, cardio: adj.cardio || 0, reason: adj.why, verdict: verdictKey });
    d.adjust.kcal = Math.max(-400, Math.min(400, (d.adjust.kcal || 0) + (adj.kcal || 0)));
    d.adjust.cardio = Math.max(0, Math.min(40, (d.adjust.cardio || 0) + (adj.cardio || 0)));
    d.adjust.at = dateStr;
    d.adjust.reason = adj.why;
    touch();
  }

  function sendNudge(text) {
    const d = me();
    d.nudgesOut = d.nudgesOut || [];
    d.nudgesOut.push({ id: Math.random().toString(36).slice(2, 9), to: partnerKey(), text, at: Date.now() });
    touch();
  }

  function markSeen(key, value) {
    me().seen[key] = value == null ? Date.now() : value;
    touch();
  }

  function setPref(k, v) { state.prefs[k] = v; savePrefs(); }

  /** Nudges the partner sent me that I have not seen yet. */
  function incomingNudges() {
    const since = me().seen.nudgesAt || 0;
    return (other().nudgesOut || []).filter(n => n.to === state.me && n.at > since);
  }

  function setMe(personKey) {
    state.me = personKey;
    try { localStorage.setItem(`fit:${CREW}:me`, personKey); } catch (e) {}
    emit('me', personKey);
    if (fs.queued) { fs.queued = false; push(); }
  }
  function rememberedMe() {
    try { return localStorage.getItem(`fit:${CREW}:me`); } catch (e) { return null; }
  }

  function init() {
    loadLocal();
    state.ready = true;
    return state;      /* sync starts once we know who is signed in */
  }

  /** Everything the whole app needs for one date, computed in one place. */
  function view(dateStr, personKey) {
    const key = personKey || state.me;
    const d = state.data[key];
    const prof = d.profile;
    const rec = d.days[dateStr] || {};
    const latest = latestWeight(key, dateStr) || prof.startWeight;
    const session = FIT.PROGRAM.buildSession({
      person: key, profile: prof, date: dateStr,
      budget: (rec.budget || prof.defaultBudget || 60),
      mode: rec.mode || 'auto', weight: latest, lifts: d.lifts,
      cardioPref: prof.cardioPref
    });
    if (d.adjust && d.adjust.cardio > 0 && session.kind !== 'rest') {
      const blk = session.blocks.filter(b => b.kind === 'cardio').pop();
      if (blk) {
        blk.minutes += d.adjust.cardio;
        blk.adjusted = d.adjust.cardio;
        session.cardioMinutes += d.adjust.cardio;
        session.totalMinutes += d.adjust.cardio;
        if (blk.intensity === 'vigorous') session.vigorousMinutes += d.adjust.cardio;
        else session.moderateMinutes += d.adjust.cardio;
        session.estKcal += FIT.CDC.burn(blk.activity, d.adjust.cardio, latest);
      }
    }
    const tgt = FIT.NUTRITION.targets(prof, session.estKcal, { today: dateStr, weight: latest, adjust: d.adjust });
    const meals = tgt.ok ? FIT.NUTRITION.planDay(key, dateStr, tgt, d.allowedFoods, rec.mealPick || {}, rec.extras || {}) : null;
    return { key, name: DISPLAY[key], data: d, profile: prof, rec, latest, session, tgt, meals };
  }

  function latestWeight(personKey, onOrBefore) {
    const d = state.data[personKey];
    const keys = Object.keys(d.days).filter(k => d.days[k] && d.days[k].w > 0 && (!onOrBefore || k <= onOrBefore)).sort();
    return keys.length ? d.days[keys[keys.length - 1]].w : null;
  }

  function sessionsByDate(personKey, fromDate, days) {
    const out = {};
    for (let i = 0; i < days; i++) {
      const dt = N.addDays(fromDate, i);
      const d = state.data[personKey];
      const rec = d.days[dt] || {};
      out[dt] = FIT.PROGRAM.buildSession({
        person: personKey, profile: d.profile, date: dt,
        budget: rec.budget || d.profile.defaultBudget || 60,
        mode: rec.mode || 'auto', weight: latestWeight(personKey, dt) || d.profile.startWeight,
        lifts: d.lifts, cardioPref: d.profile.cardioPref
      });
    }
    return out;
  }

  return {
    CREW, PEOPLE, DISPLAY, SCHEMA, DOC, COLL, RULES_AUTH, RULES_OPEN, SYNC_LABEL,
    state, on, off, emit, init, setMe, rememberedMe, startSync, stopSync, push, touch,
    me, other, partnerKey, person, day, ensureDay, view, latestWeight, sessionsByDate,
    setWeight, setWaist, toggleMeal, setMealChoice, setBudget, setMode,
    setExtra, setStock, setLow, clearStock, pantry,
    toggleExercise, completeWorkout, logLift, setProfile, setAllowedFoods, toggleFood,
    applyAdjustment, sendNudge, markSeen, incomingNudges, setPref, defaultProfile, blank,
    mergeDocs, exportText, importText, newDays
  };
})();
