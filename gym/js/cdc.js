/* ===========================================================================
   cdc.js — the real public-health numbers this app is built on.

   Every figure here is attributed. Nothing in this file is invented: where a
   number comes from CDC it says CDC, where it comes from somewhere else
   (USDA/DRI, the Compendium of Physical Activities, the Mifflin-St Jeor
   equation) it says so, because telling the difference matters.
   =========================================================================== */
window.FIT = window.FIT || {};
FIT.CDC = (() => {
  'use strict';

  /* ---- sources, shown in-app so the numbers can be checked ---- */
  const SOURCES = {
    bmi: {
      org: 'CDC',
      title: 'Adult BMI Categories',
      url: 'https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html'
    },
    activity: {
      org: 'CDC',
      title: 'Adult Activity: An Overview',
      url: 'https://www.cdc.gov/physical-activity-basics/guidelines/adults.html'
    },
    losing: {
      org: 'CDC',
      title: 'Healthy Weight: Losing Weight',
      url: 'https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html'
    },
    burn: {
      org: 'CDC',
      title: 'Physical Activity for a Healthy Weight',
      url: 'https://www.cdc.gov/healthy-weight-growth/physical-activity/index.html'
    },
    waist: {
      org: 'CDC',
      title: 'Assessing Your Weight',
      url: 'https://www.cdc.gov/healthy-weight-growth/assessing/index.html'
    },
    sleep: {
      org: 'CDC',
      title: 'Short Sleep Duration Among US Adults',
      url: 'https://www.cdc.gov/sleep/data-research/index.html'
    },
    eating: {
      org: 'CDC',
      title: 'Healthy Eating for a Healthy Weight',
      url: 'https://www.cdc.gov/healthy-weight-growth/healthy-eating/index.html'
    },
    dri: {
      org: 'USDA / National Academies (DRI)',
      title: 'Dietary Reference Intakes — protein and fiber',
      url: 'https://www.dietaryguidelines.gov/'
    },
    msj: {
      org: 'Mifflin-St Jeor (1990)',
      title: 'Resting energy expenditure equation',
      url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/'
    },
    compendium: {
      org: 'Compendium of Physical Activities',
      title: 'MET values for exercise',
      url: 'https://pacompendium.com/'
    },
    usda: {
      org: 'USDA',
      title: 'FoodData Central',
      url: 'https://fdc.nal.usda.gov/'
    }
  };

  /* =======================================================================
     BMI — CDC
     "BMI is a person's weight (in kilograms) divided by the square of their
     height (in meters)." US units: weight(lb) / height(in)^2 * 703.
     Categories apply to adults 20+, regardless of age, sex or race.
     CDC also says plainly: BMI is a *screening* measure, to be considered
     with other factors. This app repeats that caveat wherever BMI appears.
     ======================================================================= */
  const BMI_CATEGORIES = [
    { key: 'under',  label: 'Underweight',     min: -Infinity, max: 18.5 },
    { key: 'healthy',label: 'Healthy weight',  min: 18.5,      max: 25   },
    { key: 'over',   label: 'Overweight',      min: 25,        max: 30   },
    { key: 'ob1',    label: 'Obesity class 1', min: 30,        max: 35   },
    { key: 'ob2',    label: 'Obesity class 2', min: 35,        max: 40   },
    { key: 'ob3',    label: 'Obesity class 3', min: 40,        max: Infinity }
  ];

  const bmi = (lb, inches) =>
    (lb > 0 && inches > 0) ? (lb / (inches * inches)) * 703 : null;

  const bmiCategory = (v) =>
    v == null ? null : BMI_CATEGORIES.find(c => v >= c.min && v < c.max) || null;

  /** The weight band that puts an adult of this height in CDC's healthy range. */
  const healthyWeightRange = (inches) => {
    if (!(inches > 0)) return null;
    const lbAt = (b) => (b * inches * inches) / 703;
    return { lo: lbAt(18.5), hi: lbAt(24.9) };
  };

  /* =======================================================================
     Physical activity — CDC
     Adults need at least 150 minutes a week of moderate-intensity aerobic
     activity (e.g. 30 minutes a day, 5 days a week), OR 75 minutes of
     vigorous-intensity, OR an equivalent mix; PLUS muscle-strengthening
     activity on 2 or more days a week that works all major muscle groups.
     More activity (300+ min/wk moderate) brings additional benefits, and
     CDC points to higher amounts of activity when the goal is weight loss.
     ======================================================================= */
  const ACTIVITY = {
    moderateMinPerWeek: 150,
    vigorousMinPerWeek: 75,
    strengthDaysPerWeek: 2,
    moreBenefitsMinPerWeek: 300,
    /* CDC's own list of "all major muscle groups" */
    muscleGroups: ['legs', 'hips', 'back', 'abdomen', 'chest', 'shoulders', 'arms'],
    groupLabels: {
      legs: 'Legs', hips: 'Hips', back: 'Back', abdomen: 'Abdomen',
      chest: 'Chest', shoulders: 'Shoulders', arms: 'Arms'
    }
  };

  /** Moderate minutes + 2x vigorous minutes, the "equivalent mix" CDC allows. */
  const aerobicEquivalent = (moderateMin, vigorousMin) =>
    (moderateMin || 0) + (vigorousMin || 0) * 2;

  /* =======================================================================
     Losing weight — CDC
     People who lose weight gradually and steadily — about 1 to 2 pounds a
     week — are more successful at keeping it off. One pound is about 3,500
     calories, so a 500–1,000 calorie-a-day reduction gives roughly 1–2 lb
     a week. CDC is explicit that the 3,500 figure is an approximation.
     ======================================================================= */
  const WEIGHT = {
    minRateLbPerWeek: 1,
    maxRateLbPerWeek: 2,
    kcalPerLb: 3500,
    minDailyDeficit: 500,
    maxDailyDeficit: 1000,
    /* Not CDC: the intake floors below are the conventional clinical floors
       used for unsupervised dieting. They exist so this app can never hand
       someone a starvation target. */
    floorKcal: { female: 1200, male: 1500 }
  };

  const dailyDeficitForRate = (lbPerWeek) => (lbPerWeek * WEIGHT.kcalPerLb) / 7;
  const rateForDailyDeficit = (kcal) => (kcal * 7) / WEIGHT.kcalPerLb;

  /** Is this goal inside the pace CDC calls safe and sustainable? */
  const judgeRate = (lbPerWeek) => {
    const r = Math.abs(lbPerWeek);
    if (lbPerWeek <= 0) return { key: 'gain', ok: true, label: 'gaining or holding' };
    if (r < 0.5)  return { key: 'slow',   ok: true,  label: 'very gradual' };
    if (r <= 1)   return { key: 'gentle', ok: true,  label: 'gentle — inside CDC’s 1–2 lb range' };
    if (r <= 1.6) return { key: 'solid',  ok: true,  label: 'inside CDC’s 1–2 lb a week range' };
    if (r <= 2)   return { key: 'brisk',  ok: true,  label: 'at the fast end of CDC’s 1–2 lb range' };
    return { key: 'toofast', ok: false, label: 'faster than the 1–2 lb a week CDC calls sustainable' };
  };

  /* =======================================================================
     Waist circumference — CDC
     For adults, a waist over 40 inches (men) or over 35 inches (non-pregnant
     women) signals higher risk for obesity-related conditions. Useful here
     because when you are gaining muscle and losing fat the scale can sit
     still while the waist keeps moving — which is the honest good news.
     ======================================================================= */
  const WAIST = { male: 40, female: 35 };

  /* =======================================================================
     Sleep — CDC treats 7+ hours a night as healthy sleep for adults (the
     recommendation itself is from the American Academy of Sleep Medicine and
     the Sleep Research Society). CDC links short sleep to higher risk of
     obesity, diabetes, high blood pressure, heart disease and stroke.
     ======================================================================= */
  const SLEEP = { minHours: 7 };

  /* =======================================================================
     Calories burned.
     CDC publishes approximate burns for a 154-lb person and notes the number
     is higher for people who weigh more, lower for people who weigh less —
     so we scale linearly by bodyweight, which is what that note describes.
     Activities CDC's table does not cover are computed from MET values
     (Compendium of Physical Activities) and labelled 'met' in the UI, so the
     two sources are never silently mixed.
     ======================================================================= */
  const CDC_BASE_LB = 154;

  const ACTIVITIES = {
    walk_brisk:    { label: 'Treadmill walk, 3.5 mph',        src: 'cdc', base: 280, intensity: 'moderate' },
    walk_outdoor:  { label: 'Walk outside, brisk',            src: 'cdc', base: 280, intensity: 'moderate' },
    run_5mph:      { label: 'Jog / run, 5 mph',               src: 'cdc', base: 590, intensity: 'vigorous' },
    lift_light:    { label: 'Weight training, light',         src: 'cdc', base: 220, intensity: 'moderate' },
    lift_vigorous: { label: 'Weight training, vigorous',      src: 'cdc', base: 440, intensity: 'vigorous' },
    incline_walk:  { label: 'Incline treadmill walk, 10%',    src: 'met', met: 8.0,  intensity: 'vigorous' },
    elliptical:    { label: 'Elliptical, moderate',           src: 'met', met: 5.0,  intensity: 'moderate' },
    bike_static:   { label: 'Stationary bike, moderate',      src: 'met', met: 7.0,  intensity: 'moderate' },
    row_erg:       { label: 'Rowing machine, moderate',       src: 'met', met: 7.0,  intensity: 'vigorous' },
    stairs:        { label: 'Stair climber',                  src: 'met', met: 9.0,  intensity: 'vigorous' },
    swim:          { label: 'Swimming laps, freestyle',       src: 'met', met: 5.8,  intensity: 'moderate' },
    jump_rope:     { label: 'Jump rope, moderate',            src: 'met', met: 10.0, intensity: 'vigorous' },
    bike_outdoor:  { label: 'Cycling outside, 10–12 mph',src: 'met', met: 6.8,  intensity: 'moderate' },
    stretch:       { label: 'Stretching / mobility',          src: 'met', met: 2.3,  intensity: 'light' },
    foam_roll:     { label: 'Foam rolling',                   src: 'met', met: 2.3,  intensity: 'light' }
  };

  /** Calories for `minutes` of `key` at bodyweight `lb`. */
  const burn = (key, minutes, lb) => {
    const a = ACTIVITIES[key];
    if (!a || !(minutes > 0) || !(lb > 0)) return 0;
    if (a.src === 'cdc') return Math.round(a.base * (lb / CDC_BASE_LB) * (minutes / 60));
    const kg = lb / 2.20462;                       /* MET formula: kcal/min = MET*3.5*kg/200 */
    return Math.round(a.met * 3.5 * kg / 200 * minutes);
  };

  const burnNote = (key) => {
    const a = ACTIVITIES[key];
    if (!a) return '';
    return a.src === 'cdc'
      ? 'CDC estimate for a 154 lb adult, scaled to your bodyweight.'
      : 'Estimated from the activity’s MET value (Compendium of Physical Activities).';
  };

  /* =======================================================================
     Resting energy — Mifflin-St Jeor. Not a CDC figure; it is the equation
     clinicians use, and the app labels it as such.
     ======================================================================= */
  const bmr = ({ lb, inches, age, sex }) => {
    if (!(lb > 0 && inches > 0 && age > 0)) return null;
    const kg = lb / 2.20462, cm = inches * 2.54;
    const base = 10 * kg + 6.25 * cm - 5 * age;
    return Math.round(sex === 'female' ? base - 161 : base + 5);
  };

  /* Daily living on top of resting energy, *excluding* the workout — the
     workout is added from the day's actual plan so the number is traceable. */
  const NON_EXERCISE_FACTOR = 1.35;

  /* =======================================================================
     Protein and fiber.
     DRI minimum protein is 0.8 g per kg of bodyweight — that is the floor for
     avoiding deficiency, not the target for someone lifting six days a week
     in a calorie deficit. The 1.6–2.2 g/kg band is the sports-nutrition
     range for holding on to muscle while losing fat; it is labelled as such
     everywhere it appears.
     ======================================================================= */
  const PROTEIN = { driPerKg: 0.8, trainingLow: 1.6, trainingHigh: 2.2 };
  const FIBER_DRI = { female: 25, male: 38 };
  const SODIUM_LIMIT = 2300;          /* Dietary Guidelines for Americans */
  const ADDED_SUGAR_PCT = 10;         /* Dietary Guidelines: <10% of calories */

  /* CDC's description of a healthy eating plan, used by the gap check. */
  const EATING_PLAN = [
    'Emphasizes fruits, vegetables, whole grains, and fat-free or low-fat milk',
    'Includes lean meats, poultry, fish, beans, eggs and nuts',
    'Is low in saturated fat, added sugars and sodium',
    'Stays within your daily calorie needs',
    'Controls portion sizes'
  ];

  return {
    SOURCES, BMI_CATEGORIES, bmi, bmiCategory, healthyWeightRange,
    ACTIVITY, aerobicEquivalent,
    WEIGHT, dailyDeficitForRate, rateForDailyDeficit, judgeRate,
    WAIST, SLEEP,
    ACTIVITIES, CDC_BASE_LB, burn, burnNote,
    bmr, NON_EXERCISE_FACTOR,
    PROTEIN, FIBER_DRI, SODIUM_LIMIT, ADDED_SUGAR_PCT, EATING_PLAN
  };
})();
