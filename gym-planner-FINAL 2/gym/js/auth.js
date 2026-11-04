/* ===========================================================================
   auth.js — two accounts, one for each of them.

   Preferred mode is real Firebase email/password auth: Danil signs in on his
   phone, Towne on hers, each account claims one of the two slots (stored as
   `authUid` on that person's document), and the Firestore rules let a person
   write only the document they claimed.

   If Firebase Authentication has not been switched on for the project, the
   app does not break — it falls back to a per-device passcode and says so in
   plain words, because a passcode on a device is not the same thing as a
   login and pretending otherwise would be a lie.
   =========================================================================== */
window.FIT = window.FIT || {};
FIT.AUTH = (() => {
  'use strict';
  const S = FIT.STORE;

  const api = {
    mode: 'unknown',        /* 'firebase' | 'passcode' */
    user: null,             /* firebase user when mode === 'firebase' */
    person: null,           /* 'danil' | 'towne' once resolved */
    ready: false,
    needsClaim: false,
    claimOptions: [],
    error: '',
    blocked: false,         /* signed in, but the database will not answer */
    allowOffline: false,
    reason: ''              /* why we are in passcode mode, if we are */
  };

  const subs = [];
  const on = (fn) => { subs.push(fn); return () => subs.splice(subs.indexOf(fn), 1); };
  const emit = () => subs.forEach(f => { try { f(api); } catch (e) { console.error(e); } });

  const PC_KEY = (p) => `fit:${S.CREW}:pc:${p}`;

  async function sha256(text) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    /* last-resort fallback so a passcode still works on an old browser */
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return 'fnv' + (h >>> 0).toString(16);
  }

  /* =======================================================================
     Boot
     ======================================================================= */
  async function init() {
    const hasAuthSdk = !!(window.firebase && firebase.auth && window.FIREBASE_CONFIG);
    if (!hasAuthSdk) return toPasscode('The Firebase Auth library did not load (you may be offline).');

    try {
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      const auth = firebase.auth();
      try { await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}

      /* Probe: is Authentication actually enabled on the project? */
      try {
        await auth.fetchSignInMethodsForEmail('probe-not-a-real-user@example.invalid');
      } catch (e) {
        const c = (e && e.code) || '';
        if (c === 'auth/configuration-not-found' || c === 'auth/project-not-found' || c === 'auth/api-key-not-valid') {
          return toPasscode('Firebase Authentication is not switched on for this project yet.');
        }
        /* any other error (network, invalid-email, too-many-requests) means
           Auth is alive and answering — carry on */
      }

      api.mode = 'firebase';
      auth.onAuthStateChanged(async (user) => {
        api.user = user || null;
        api.error = '';
        if (!user) { api.person = null; api.ready = true; api.needsClaim = false; emit(); return; }
        S.startSync();                       /* rules allow reads now */
        await resolvePerson(user);
        api.ready = true;
        emit();
      });
      return api;
    } catch (e) {
      return toPasscode('Could not start Firebase Auth: ' + (e && e.message || e));
    }
  }

  function toPasscode(reason) {
    api.mode = 'passcode';
    api.reason = window.FIT_HOST_NOTE || reason || '';
    api.ready = true;
    const remembered = S.rememberedMe();
    let unlocked = false;
    try { unlocked = !!remembered && sessionStorage.getItem(`fit:${S.CREW}:unlocked`) === remembered; } catch (e) {}
    if (unlocked) { api.person = remembered; S.setMe(remembered); }
    S.startSync();
    emit();
    return api;
  }

  /* =======================================================================
     Which of the two is this account?
     ======================================================================= */
  function slotOwner(personKey) {
    const d = S.state.data[personKey];
    return (d && d.authUid) || null;
  }

  async function resolvePerson(user) {
    /* give the snapshots a beat to arrive so we do not claim a taken slot */
    await waitForDocs(3000);
    api.blocked = false;
    for (const p of S.PEOPLE) {
      if (slotOwner(p) === user.uid) {
        api.person = p; api.needsClaim = false; S.setMe(p);
        return p;
      }
    }
    /* known by email from a previous claim on another device */
    for (const p of S.PEOPLE) {
      const prof = S.state.data[p].profile;
      if (prof && prof.email && user.email && prof.email.toLowerCase() === user.email.toLowerCase() && !slotOwner(p)) {
        return claim(p);
      }
    }
    const free = S.PEOPLE.filter(p => !slotOwner(p));

    /* Nothing claimed AND the database is not answering: this is almost
       always an existing user on a new device, not a new user. Offering the
       setup wizard here is what silently creates a second, unsynced copy. */
    const syncLive = S.state.sync.status === 'live';
    if (!syncLive && free.length === S.PEOPLE.length && !api.allowOffline) {
      api.blocked = true;
      api.needsClaim = false;
      api.person = null;
      api.claimOptions = free;
      return null;
    }

    api.claimOptions = free;
    api.needsClaim = free.length > 0;
    api.person = null;
    if (!free.length) api.error = 'Both accounts on this planner are already taken. Sign in with the email you used before, or ask Danil to free a slot in Settings.';
    return null;
  }

  function waitForDocs(ms) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; off(); resolve(); } };
      const off = S.on('change', () => { if (slotOwner('danil') || slotOwner('towne')) finish(); });
      setTimeout(finish, ms);
    });
  }

  async function claim(personKey) {
    if (!api.user) return null;
    if (slotOwner(personKey) && slotOwner(personKey) !== api.user.uid) {
      api.error = `${S.DISPLAY[personKey]} is already taken by another account.`;
      emit(); return null;
    }
    S.setMe(personKey);
    S.state.data[personKey].authUid = api.user.uid;
    S.setProfile({ email: api.user.email || '' });
    api.person = personKey; api.needsClaim = false; api.error = '';
    S.push();
    emit();
    return personKey;
  }

  /* =======================================================================
     Email + password
     ======================================================================= */
  const FRIENDLY = {
    'auth/invalid-email': 'That email address does not look right.',
    'auth/user-not-found': 'No account with that email. Tap "Create account" if this is your first time.',
    'auth/wrong-password': 'Wrong password.',
    'auth/invalid-credential': 'That email and password do not match.',
    'auth/invalid-login-credentials': 'That email and password do not match.',
    'auth/email-already-in-use': 'There is already an account with that email — sign in instead.',
    'auth/weak-password': 'Password needs to be at least 6 characters.',
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
    'auth/network-request-failed': 'No connection. The app still works offline — your data is on this device.',
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled on the Firebase project yet.',
    'auth/configuration-not-found': 'Firebase Authentication is not set up for this project yet.'
  };
  const friendly = (e) => FRIENDLY[(e && e.code) || ''] || (e && e.message) || 'Something went wrong.';

  async function signIn(email, password) {
    try {
      await firebase.auth().signInWithEmailAndPassword(email.trim(), password);
      return { ok: true };
    } catch (e) {
      if ((e.code || '') === 'auth/configuration-not-found' || (e.code || '') === 'auth/operation-not-allowed') {
        toPasscode(friendly(e));
        return { ok: false, error: friendly(e), fellBack: true };
      }
      api.error = friendly(e); emit();
      return { ok: false, error: friendly(e) };
    }
  }

  async function signUp(email, password) {
    try {
      await firebase.auth().createUserWithEmailAndPassword(email.trim(), password);
      return { ok: true };
    } catch (e) {
      if ((e.code || '') === 'auth/configuration-not-found' || (e.code || '') === 'auth/operation-not-allowed') {
        toPasscode(friendly(e));
        return { ok: false, error: friendly(e), fellBack: true };
      }
      api.error = friendly(e); emit();
      return { ok: false, error: friendly(e) };
    }
  }

  async function resetPassword(email) {
    try { await firebase.auth().sendPasswordResetEmail(email.trim()); return { ok: true }; }
    catch (e) { return { ok: false, error: friendly(e) }; }
  }

  async function signOut() {
    try { sessionStorage.removeItem(`fit:${S.CREW}:unlocked`); } catch (e) {}
    if (api.mode === 'firebase') { try { await firebase.auth().signOut(); } catch (e) {} }
    api.person = null; api.user = null; api.needsClaim = false;
    api.blocked = false; api.allowOffline = false;
    S.stopSync();
    emit();
  }

  /* =======================================================================
     Passcode fallback
     ======================================================================= */
  function passcodeSet(personKey) {
    const stored = S.state.data[personKey].pcHash;
    if (stored) return true;
    try { return !!localStorage.getItem(PC_KEY(personKey)); } catch (e) { return false; }
  }

  async function setPasscode(personKey, code) {
    if (!/^\d{4,10}$/.test(String(code))) return { ok: false, error: 'Use 4 to 10 digits.' };
    const h = await sha256(`${S.CREW}:${personKey}:${code}`);
    try { localStorage.setItem(PC_KEY(personKey), h); } catch (e) {}
    S.setMe(personKey);
    S.state.data[personKey].pcHash = h;
    S.touch(personKey);
    api.person = personKey;
    try { sessionStorage.setItem(`fit:${S.CREW}:unlocked`, personKey); } catch (e) {}
    emit();
    return { ok: true };
  }

  async function passcodeLogin(personKey, code) {
    const h = await sha256(`${S.CREW}:${personKey}:${code}`);
    let stored = S.state.data[personKey].pcHash;
    if (!stored) { try { stored = localStorage.getItem(PC_KEY(personKey)); } catch (e) {} }
    if (!stored) return { ok: false, error: 'No passcode set for ' + S.DISPLAY[personKey] + ' yet.' };
    if (stored !== h) return { ok: false, error: 'Wrong passcode.' };
    S.setMe(personKey);
    api.person = personKey;
    try { sessionStorage.setItem(`fit:${S.CREW}:unlocked`, personKey); } catch (e) {}
    emit();
    return { ok: true };
  }

  /** Let the other person take over a slot (used if an account is lost). */
  function releaseSlot(personKey) {
    S.state.data[personKey].authUid = null;
    S.touch(personKey);
    emit();
  }

  return Object.assign(api, {
    init, on, signIn, signUp, resetPassword, signOut, claim,
    passcodeSet, setPasscode, passcodeLogin, releaseSlot, toPasscode, slotOwner
  });
})();
