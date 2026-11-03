/* ===========================================================================
   exercises.js — the lifting library.

   `groups` uses CDC's own list of major muscle groups (legs, hips, back,
   abdomen, chest, shoulders, arms) so the weekly plan can be checked against
   the guideline directly instead of by vibes.

   tier 1 = the lift the day is built on   (heaviest, done first)
   tier 2 = accessory
   tier 3 = finisher / isolation / core
   =========================================================================== */
window.FIT = window.FIT || {};
FIT.EX = (() => {
  'use strict';

  const FOCUS = {
    chest_tri:      { label: 'Chest & Triceps',      short: 'Chest',     groups: ['chest', 'arms', 'shoulders'] },
    back_bi:        { label: 'Back & Biceps',        short: 'Back',      groups: ['back', 'arms'] },
    legs_glutes:    { label: 'Legs & Glutes',        short: 'Legs',      groups: ['legs', 'hips'] },
    shoulders_arms: { label: 'Shoulders & Arms',     short: 'Shoulders', groups: ['shoulders', 'arms'] },
    core_cond:      { label: 'Core & Conditioning',  short: 'Core',      groups: ['abdomen', 'hips'] },
    full_body:      { label: 'Full Body',            short: 'Full body', groups: ['legs', 'hips', 'back', 'chest', 'shoulders', 'arms'] },
    recovery:       { label: 'Active Recovery',      short: 'Recovery',  groups: [] }
  };

  const L = [
    /* ---------------- chest & triceps ---------------- */
    { id: 'bench_press',    focus: 'chest_tri', fam: 'horiz_press', tier: 1, name: 'Barbell bench press',        groups: ['chest', 'arms', 'shoulders'], equip: 'barbell', cue: 'Shoulder blades pinched down, bar to mid-chest, elbows about 45° from your sides.', alt: 'Dumbbell bench press' },
    { id: 'incline_db',     focus: 'chest_tri', fam: 'incline_press', tier: 1, name: 'Incline dumbbell press',     groups: ['chest', 'shoulders'], equip: 'dumbbell', cue: 'Bench at 30°. Stop when your upper arm is level with the bench.', alt: 'Incline machine press' },
    { id: 'machine_press',  focus: 'chest_tri', fam: 'horiz_press', tier: 1, name: 'Machine chest press',        groups: ['chest', 'arms'], equip: 'machine', cue: 'Handles at nipple height. Push, pause an inch before lockout.', alt: 'Push-up' },
    { id: 'pushup',         focus: 'chest_tri', fam: 'bw_press', tier: 2, name: 'Push-up',                    groups: ['chest', 'arms', 'abdomen'], equip: 'bodyweight', cue: 'Hands under shoulders, body one straight line. Knees down is a real push-up.', alt: 'Incline push-up on a bench' },
    { id: 'cable_fly',      focus: 'chest_tri', fam: 'fly', tier: 2, name: 'Cable fly',                  groups: ['chest'], equip: 'cable', cue: 'Slight elbow bend, hug forward like closing a door. Squeeze for one second.', alt: 'Pec deck machine' },
    { id: 'dips_assist',    focus: 'chest_tri', fam: 'dip', tier: 2, name: 'Dips (assisted)',            groups: ['chest', 'arms'], equip: 'machine', cue: 'Lean forward for chest, stay upright for triceps. Stop at shoulder level.', alt: 'Bench dips' },
    { id: 'tri_pushdown',   focus: 'chest_tri', fam: 'tri_press', tier: 3, name: 'Triceps rope pushdown',      groups: ['arms'], equip: 'cable', cue: 'Elbows glued to your ribs, split the rope at the bottom.', alt: 'Straight-bar pushdown' },
    { id: 'oh_tri_ext',     focus: 'chest_tri', fam: 'tri_oh', tier: 3, name: 'Overhead triceps extension', groups: ['arms'], equip: 'dumbbell', cue: 'Elbows pointing forward, stretch at the bottom. This is the one that builds the back of the arm.', alt: 'Cable overhead extension' },
    { id: 'tri_kickback',   focus: 'chest_tri', fam: 'tri_press', tier: 3, name: 'Triceps kickback',           groups: ['arms'], equip: 'dumbbell', cue: 'Light weight. Straighten the arm fully and hold a beat.', alt: 'Cable kickback' },

    /* ---------------- back & biceps ---------------- */
    { id: 'lat_pulldown',   focus: 'back_bi', fam: 'vert_pull', tier: 1, name: 'Lat pulldown',                 groups: ['back', 'arms'], equip: 'machine', cue: 'Chest up, pull the bar to your collarbone, drive elbows down not back.', alt: 'Assisted pull-up' },
    { id: 'barbell_row',    focus: 'back_bi', fam: 'row', tier: 1, name: 'Barbell row',                  groups: ['back', 'arms', 'hips'], equip: 'barbell', cue: 'Hinge to about 45°, flat back, pull to the bottom of your ribs.', alt: 'Chest-supported machine row' },
    { id: 'seated_row',     focus: 'back_bi', fam: 'row', tier: 1, name: 'Seated cable row',             groups: ['back', 'arms'], equip: 'cable', cue: 'Don’t rock. Pull with the back, squeeze the shoulder blades together.', alt: 'Machine row' },
    { id: 'db_row',         focus: 'back_bi', fam: 'row', tier: 2, name: 'One-arm dumbbell row',          groups: ['back', 'arms'], equip: 'dumbbell', cue: 'Knee and hand on the bench, pull the dumbbell to your hip.', alt: 'Chest-supported row' },
    { id: 'pullup_assist',  focus: 'back_bi', fam: 'vert_pull', tier: 2, name: 'Assisted pull-up',             groups: ['back', 'arms'], equip: 'machine', cue: 'Full hang at the bottom. Dropping the assist by 5 lb is a real PR.', alt: 'Lat pulldown' },
    { id: 'straight_arm',   focus: 'back_bi', fam: 'lat_iso', tier: 2, name: 'Straight-arm pulldown',        groups: ['back'], equip: 'cable', cue: 'Arms almost locked, sweep down to your thighs. Pure lat.', alt: 'Dumbbell pullover' },
    { id: 'face_pull',      focus: 'back_bi', fam: 'rear', tier: 3, name: 'Face pull',                    groups: ['back', 'shoulders'], equip: 'cable', cue: 'Rope to your forehead, thumbs back. Fixes desk posture.', alt: 'Rear-delt machine' },
    { id: 'barbell_curl',   focus: 'back_bi', fam: 'curl', tier: 3, name: 'Barbell curl',                 groups: ['arms'], equip: 'barbell', cue: 'Elbows still, no swinging. Lower it for two full seconds.', alt: 'EZ-bar curl' },
    { id: 'hammer_curl',    focus: 'back_bi', fam: 'curl_neutral', tier: 3, name: 'Hammer curl',                  groups: ['arms'], equip: 'dumbbell', cue: 'Palms facing in the whole way. Builds arm thickness.', alt: 'Rope hammer curl' },
    { id: 'incline_curl',   focus: 'back_bi', fam: 'curl', tier: 3, name: 'Incline dumbbell curl',        groups: ['arms'], equip: 'dumbbell', cue: 'Arms hanging behind you — that stretch is the point.', alt: 'Cable curl' },

    /* ---------------- legs & glutes ---------------- */
    { id: 'squat',          focus: 'legs_glutes', fam: 'squat', tier: 1, name: 'Back squat',               groups: ['legs', 'hips'], equip: 'barbell', cue: 'Brace your stomach, knees travel over your toes, hips to at least parallel.', alt: 'Goblet squat' },
    { id: 'goblet_squat',   focus: 'legs_glutes', fam: 'squat', tier: 1, name: 'Goblet squat',             groups: ['legs', 'hips'], equip: 'dumbbell', cue: 'Dumbbell at your chest, sit straight down between your feet.', alt: 'Hack squat machine' },
    { id: 'leg_press',      focus: 'legs_glutes', fam: 'leg_press', tier: 1, name: 'Leg press',                groups: ['legs', 'hips'], equip: 'machine', cue: 'Knees to about 90°. Never bounce off the bottom.', alt: 'Hack squat' },
    { id: 'rdl',            focus: 'legs_glutes', fam: 'hinge', tier: 1, name: 'Romanian deadlift',        groups: ['hips', 'legs', 'back'], equip: 'barbell', cue: 'Push your hips back, bar grazing your legs, stop when the hamstrings pull.', alt: 'Dumbbell RDL' },
    { id: 'hip_thrust',     focus: 'legs_glutes', fam: 'thrust', tier: 1, name: 'Hip thrust',               groups: ['hips'], equip: 'barbell', cue: 'Chin tucked, squeeze at the top for a full second. The best glute lift there is.', alt: 'Glute bridge machine' },
    { id: 'bulgarian',      focus: 'legs_glutes', fam: 'lunge', tier: 2, name: 'Bulgarian split squat',    groups: ['legs', 'hips'], equip: 'dumbbell', cue: 'Back foot on the bench, front shin vertical. Brutal, worth it.', alt: 'Walking lunge' },
    { id: 'lunge_walk',     focus: 'legs_glutes', fam: 'lunge', tier: 2, name: 'Walking lunge',            groups: ['legs', 'hips'], equip: 'dumbbell', cue: 'Long steps, back knee toward the floor, torso tall.', alt: 'Step-up' },
    { id: 'leg_curl',       focus: 'legs_glutes', fam: 'ham_iso', tier: 2, name: 'Lying leg curl',           groups: ['legs'], equip: 'machine', cue: 'Curl all the way, lower slowly. Hamstrings shape the back of the leg.', alt: 'Seated leg curl' },
    { id: 'leg_ext',        focus: 'legs_glutes', fam: 'quad_iso', tier: 3, name: 'Leg extension',            groups: ['legs'], equip: 'machine', cue: 'Pause at the top with the knee straight.', alt: 'Sissy squat' },
    { id: 'abductor',       focus: 'legs_glutes', fam: 'abduct', tier: 3, name: 'Hip abduction machine',    groups: ['hips'], equip: 'machine', cue: 'Lean forward slightly to hit the upper glute.', alt: 'Banded side steps' },
    { id: 'calf_raise',     focus: 'legs_glutes', fam: 'calf', tier: 3, name: 'Standing calf raise',      groups: ['legs'], equip: 'machine', cue: 'All the way up onto the toes, all the way down. Slow.', alt: 'Seated calf raise' },

    /* ---------------- shoulders & arms ---------------- */
    { id: 'db_shoulder',    focus: 'shoulders_arms', fam: 'oh_press', tier: 1, name: 'Dumbbell shoulder press', groups: ['shoulders', 'arms'], equip: 'dumbbell', cue: 'Ribs down, press without arching your lower back.', alt: 'Machine shoulder press' },
    { id: 'arnold_press',   focus: 'shoulders_arms', fam: 'oh_press', tier: 1, name: 'Arnold press',            groups: ['shoulders', 'arms'], equip: 'dumbbell', cue: 'Start palms-in, rotate as you press.', alt: 'Dumbbell shoulder press' },
    { id: 'machine_sh',     focus: 'shoulders_arms', fam: 'oh_press', tier: 1, name: 'Machine shoulder press',  groups: ['shoulders'], equip: 'machine', cue: 'Seat set so the handles start at shoulder height.', alt: 'Dumbbell press' },
    { id: 'lat_raise',      focus: 'shoulders_arms', fam: 'lateral', tier: 2, name: 'Lateral raise',           groups: ['shoulders'], equip: 'dumbbell', cue: 'Light. Lead with the elbows to shoulder height, little finger slightly high. This is what widens shoulders.', alt: 'Cable lateral raise' },
    { id: 'rear_delt',      focus: 'shoulders_arms', fam: 'rear', tier: 2, name: 'Rear-delt fly',           groups: ['shoulders', 'back'], equip: 'machine', cue: 'Hinge over, sweep wide, thumbs down.', alt: 'Cable rear-delt fly' },
    { id: 'upright_row',    focus: 'shoulders_arms', fam: 'upright', tier: 2, name: 'Cable upright row',       groups: ['shoulders', 'back'], equip: 'cable', cue: 'Elbows lead, stop at chest height.', alt: 'Dumbbell shrug' },
    { id: 'ez_curl',        focus: 'shoulders_arms', fam: 'curl', tier: 3, name: 'EZ-bar curl',             groups: ['arms'], equip: 'barbell', cue: 'Wrists neutral on the angled grip — kinder on the elbows.', alt: 'Dumbbell curl' },
    { id: 'cable_curl',     focus: 'shoulders_arms', fam: 'curl', tier: 3, name: 'Cable curl',              groups: ['arms'], equip: 'cable', cue: 'Constant tension the whole way — that is the advantage of the cable.', alt: 'Barbell curl' },
    { id: 'tri_pushdown2',  focus: 'shoulders_arms', fam: 'tri_press', tier: 3, name: 'Triceps pushdown',        groups: ['arms'], equip: 'cable', cue: 'Elbows pinned. Last three reps are the ones that count.', alt: 'Overhead extension' },
    { id: 'shrug',          focus: 'shoulders_arms', fam: 'shrug', tier: 3, name: 'Dumbbell shrug',          groups: ['shoulders', 'back'], equip: 'dumbbell', cue: 'Straight up, hold for a second. No rolling.', alt: 'Barbell shrug' },

    /* ---------------- core & conditioning ---------------- */
    { id: 'hanging_knee',   focus: 'core_cond', fam: 'hip_flex', tier: 1, name: 'Hanging knee raise',          groups: ['abdomen', 'hips'], equip: 'bodyweight', cue: 'Curl your pelvis up toward your ribs — don’t just swing the legs.', alt: 'Captain’s chair knee raise' },
    { id: 'cable_crunch',   focus: 'core_cond', fam: 'crunch', tier: 1, name: 'Cable crunch',                groups: ['abdomen'], equip: 'cable', cue: 'Kneel, hips fixed, crunch your ribs toward your hips. The one ab move you can actually add weight to — which is how abs get visible.', alt: 'Weighted crunch' },
    { id: 'leg_raise',      focus: 'core_cond', fam: 'hip_flex', tier: 1, name: 'Lying leg raise',             groups: ['abdomen', 'hips'], equip: 'bodyweight', cue: 'Press your lower back into the floor the whole time.', alt: 'Reverse crunch' },
    { id: 'plank',          focus: 'core_cond', fam: 'brace', tier: 2, name: 'Plank',                       groups: ['abdomen'], equip: 'bodyweight', cue: 'Squeeze glutes, tuck ribs. Thirty honest seconds beats two sloppy minutes.', alt: 'Forearm plank on knees', timed: 45 },
    { id: 'side_plank',     focus: 'core_cond', fam: 'brace_lat', tier: 2, name: 'Side plank',                  groups: ['abdomen'], equip: 'bodyweight', cue: 'Stack the shoulders, lift the hip high.', alt: 'Side plank on knees', timed: 30 },
    { id: 'dead_bug',       focus: 'core_cond', fam: 'brace', tier: 2, name: 'Dead bug',                    groups: ['abdomen'], equip: 'bodyweight', cue: 'Opposite arm and leg, lower back glued down. Slow is the whole exercise.', alt: 'Bird dog' },
    { id: 'hollow_hold',    focus: 'core_cond', fam: 'brace', tier: 2, name: 'Hollow hold',                 groups: ['abdomen'], equip: 'bodyweight', cue: 'Lower back flat, shoulders and feet off the floor.', alt: 'Dead bug', timed: 30 },
    { id: 'bicycle',        focus: 'core_cond', fam: 'crunch', tier: 3, name: 'Bicycle crunch',              groups: ['abdomen'], equip: 'bodyweight', cue: 'Slow, rotate from the ribs not the elbows.', alt: 'Russian twist' },
    { id: 'ab_wheel',       focus: 'core_cond', fam: 'brace_dyn', tier: 3, name: 'Ab wheel rollout',            groups: ['abdomen'], equip: 'other', cue: 'Only roll as far as you can keep your back flat.', alt: 'Kneeling plank reach' },
    { id: 'farmer_carry',   focus: 'core_cond', fam: 'carry', tier: 3, name: 'Farmer carry',                groups: ['abdomen', 'shoulders', 'back'], equip: 'dumbbell', cue: 'Heavy in both hands, walk tall for 40 m.', alt: 'Suitcase carry', timed: 40 },
    { id: 'kb_swing',       focus: 'core_cond', fam: 'hinge', tier: 2, name: 'Kettlebell swing',            groups: ['hips', 'back', 'abdomen'], equip: 'other', cue: 'A hinge, not a squat. Snap the hips, let the bell float.', alt: 'Dumbbell swing' },
    { id: 'mountain_climb', focus: 'core_cond', fam: 'cond', tier: 3, name: 'Mountain climbers',           groups: ['abdomen', 'legs'], equip: 'bodyweight', cue: 'Hips low and still, drive the knees.', alt: 'High knees', timed: 40 },

    /* ---------------- full body ---------------- */
    { id: 'deadlift',       focus: 'full_body', fam: 'hinge', tier: 1, name: 'Deadlift (trap bar or barbell)', groups: ['back', 'hips', 'legs'], equip: 'barbell', cue: 'Bar over mid-foot, chest up, push the floor away. Stop the set when the back rounds.', alt: 'Dumbbell deadlift' },
    { id: 'fb_squat',       focus: 'full_body', fam: 'squat', tier: 1, name: 'Goblet squat',                groups: ['legs', 'hips'], equip: 'dumbbell', cue: 'Elbows inside the knees at the bottom.', alt: 'Leg press' },
    { id: 'thruster',       focus: 'full_body', fam: 'squat_press', tier: 1, name: 'Dumbbell thruster',           groups: ['legs', 'shoulders', 'arms'], equip: 'dumbbell', cue: 'Squat, then drive straight into the press. One motion.', alt: 'Squat to press' },
    { id: 'fb_pulldown',    focus: 'full_body', fam: 'vert_pull', tier: 2, name: 'Lat pulldown',                groups: ['back', 'arms'], equip: 'machine', cue: 'Chest proud, elbows down.', alt: 'Assisted pull-up' },
    { id: 'fb_press',       focus: 'full_body', fam: 'horiz_press', tier: 2, name: 'Dumbbell bench press',        groups: ['chest', 'arms'], equip: 'dumbbell', cue: 'Wrists over elbows at all times.', alt: 'Push-up' },
    { id: 'step_up',        focus: 'full_body', fam: 'lunge', tier: 2, name: 'Step-up',                     groups: ['legs', 'hips'], equip: 'dumbbell', cue: 'Knee-height box, drive through the top foot, don’t push off the back toe.', alt: 'Reverse lunge' },
    { id: 'renegade_row',   focus: 'full_body', fam: 'row', tier: 3, name: 'Renegade row',                groups: ['back', 'abdomen', 'arms'], equip: 'dumbbell', cue: 'Wide feet, hips square to the floor.', alt: 'Plank + dumbbell row' },
    { id: 'fb_plank',       focus: 'full_body', fam: 'brace', tier: 3, name: 'Plank',                       groups: ['abdomen'], equip: 'bodyweight', cue: 'One straight line from ear to ankle.', alt: 'Dead bug', timed: 45 }
  ];

  /* Core finishers bolted onto non-core strength days — both of them want
     abs, and abs respond to being trained most days, not once a week. */
  const CORE_FINISHERS = ['hanging_knee', 'cable_crunch', 'plank', 'dead_bug', 'bicycle', 'leg_raise', 'hollow_hold', 'side_plank'];

  /* Mobility / recovery items — timed, not sets and reps. */
  const RECOVERY = [
    { id: 'rec_foam',   name: 'Foam roll: quads, hamstrings, back',  minutes: 8,  cue: 'Thirty slow seconds per spot. Breathe out on the tender ones.' },
    { id: 'rec_hips',   name: 'Hip mobility flow',                   minutes: 7,  cue: '90/90 switches, hip-flexor stretch, deep squat hold.' },
    { id: 'rec_shldr',  name: 'Shoulder & chest opener',             minutes: 5,  cue: 'Doorway pec stretch, band pull-aparts, thread the needle.' },
    { id: 'rec_stretch',name: 'Full-body stretch',                   minutes: 10, cue: 'Hold each for 30–45 seconds. No bouncing.' },
    { id: 'rec_walk',   name: 'Easy walk',                           minutes: 30, cue: 'Conversational pace. This still counts toward CDC’s 150 weekly minutes.' }
  ];

  const byId = {};
  L.forEach(e => { byId[e.id] = e; });
  const forFocus = (f) => L.filter(e => e.focus === f);

  return { FOCUS, LIBRARY: L, byId, forFocus, CORE_FINISHERS, RECOVERY };
})();
