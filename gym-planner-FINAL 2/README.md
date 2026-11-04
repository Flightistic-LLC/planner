# planner

Two small web apps, no build step, no server of their own.

## `gym/` — Danil & Towne
A gym, meal and weight planner for two people keeping each other accountable.

- **Two accounts.** Email/password sign-in (Firebase Auth), one slot each. Falls back to a
  per-device passcode, clearly labelled as such, if Authentication is not enabled on the project.
- **Shared data.** Each person writes only their own Firestore document, so there is no write
  contention; both people read both documents live.
- **Built on CDC guidance.** BMI and its categories, the 150 min/week aerobic plus two
  muscle-strengthening days, the 1–2 lb/week weight-loss pace and its 500–1,000 kcal/day deficit,
  the calories-burned table, waist thresholds and the healthy eating plan. Figures that are not
  CDC (Mifflin-St Jeor, DRI protein and fiber, MET values, USDA food macros) say so where they
  appear. Sources are listed in the app.
- **Honest.** The deficit is capped at CDC's ceiling, intake never goes below a clinical floor,
  and if the goal date cannot be met safely the date moves rather than the food. When progress
  stalls, the app names the cause from the logs instead of quietly cutting calories.
- **Installable.** Manifest, service worker, offline-first; works on phone and desktop.

### Setup (one minute, in the Firebase console)
1. **Authentication → Sign-in method → Email/Password → Enable.**
2. **Firestore Database → Rules** — paste the rules shown in the app under
   *Settings → Sync setup*, then Publish.

Until that is done the app still works; it just keeps data on each device instead of syncing,
and says so on screen.

## `index.html` — Towne's homework planner
The earlier assignment scheduler. Unchanged.
