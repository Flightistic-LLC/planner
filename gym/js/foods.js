/* ===========================================================================
   foods.js — the food catalogue and the meal templates built from it.

   Macros are per the unit named in each row, rounded from USDA FoodData
   Central entries for the ordinary supermarket version of the food. Sodium
   (mg) and fiber (g) are carried for every item, because they are the two
   numbers that explain most "why did the scale jump" moments and most of the
   gap between a nuggets-and-fries week and CDC's healthy eating plan.
   =========================================================================== */
window.FIT = window.FIT || {};
FIT.FOODS = (() => {
  'use strict';

  /* unit: what "1" means.  g: grams in one unit (for display only). */
  const F = {
    /* ---- the four foods this plan is actually built around ---- */
    nuggets_frozen: { name: 'Chicken nuggets (frozen, oven-baked)', unit: 'nugget', g: 18, kcal: 54, p: 2.8, c: 3.2, f: 3.4, na: 120, fib: 0.2, int: true, tags: ['protein', 'processed'] },
    fries_oven:     { name: 'French fries (frozen, oven-baked)',    unit: 'g', g: 1, kcal: 1.70, p: 0.025, c: 0.26, f: 0.060, na: 3.0, fib: 0.025, step: 10, tags: ['carb'] },
    rice_white:     { name: 'White rice, cooked',                   unit: 'g', g: 1, kcal: 1.30, p: 0.027, c: 0.28, f: 0.003, na: 0.01, fib: 0.004, step: 10, tags: ['carb'] },
    beans_black:    { name: 'Black beans, canned, drained',         unit: 'g', g: 1, kcal: 0.91, p: 0.060, c: 0.16, f: 0.003, na: 2.3, fib: 0.070, step: 10, tags: ['protein', 'fiber'] },

    /* ---- the small upgrades the coach can offer her ---- */
    chicken_strips_baked: { name: 'Breaded chicken strips, baked (homemade)', unit: 'g', g: 1, kcal: 1.95, p: 0.240, c: 0.12, f: 0.050, na: 3.2, fib: 0.006, step: 10, tags: ['protein'], note: 'Chicken breast, egg, panko, 400°F for 18 min. Tastes like a nugget, nearly double the protein.' },
    fries_airfry:   { name: 'Air-fryer fries (fresh potato, 1 tsp oil)', unit: 'g', g: 1, kcal: 1.20, p: 0.024, c: 0.22, f: 0.028, na: 1.5, fib: 0.022, step: 10, tags: ['carb'] },
    protein_shake:  { name: 'Protein shake (1 scoop whey, water)',  unit: 'scoop', g: 30, kcal: 120, p: 24, c: 3, f: 1.5, na: 130, fib: 1, tags: ['protein'] },
    rice_brown:     { name: 'Brown rice, cooked',                   unit: 'g', g: 1, kcal: 1.23, p: 0.027, c: 0.256, f: 0.010, na: 0.04, fib: 0.016, step: 10, tags: ['carb', 'wholegrain'] },
    beans_pinto:    { name: 'Pinto beans, cooked',                  unit: 'g', g: 1, kcal: 1.43, p: 0.090, c: 0.26, f: 0.006, na: 0.01, fib: 0.090, step: 10, tags: ['protein', 'fiber'] },
    beans_refried:  { name: 'Refried beans',                        unit: 'g', g: 1, kcal: 0.90, p: 0.050, c: 0.14, f: 0.015, na: 4.5, fib: 0.050, step: 10, tags: ['protein'] },

    /* ---- everyday staples ---- */
    chicken_breast: { name: 'Chicken breast, grilled',              unit: 'g', g: 1, kcal: 1.65, p: 0.310, c: 0, f: 0.036, na: 0.74, fib: 0, step: 10, tags: ['protein'] },
    chicken_thigh:  { name: 'Chicken thigh, roasted',               unit: 'g', g: 1, kcal: 2.09, p: 0.260, c: 0, f: 0.110, na: 0.86, fib: 0, step: 10, tags: ['protein'] },
    steak_sirloin:  { name: 'Sirloin steak, lean, grilled',         unit: 'g', g: 1, kcal: 2.12, p: 0.290, c: 0, f: 0.100, na: 0.55, fib: 0, step: 10, tags: ['protein'] },
    steak_ribeye:   { name: 'Ribeye steak, grilled',                unit: 'g', g: 1, kcal: 2.91, p: 0.240, c: 0, f: 0.220, na: 0.60, fib: 0, step: 10, tags: ['protein'] },
    beef_ground_93: { name: 'Ground beef 93/7, cooked',             unit: 'g', g: 1, kcal: 1.82, p: 0.250, c: 0, f: 0.080, na: 0.75, fib: 0, step: 10, tags: ['protein'] },
    salmon:         { name: 'Salmon, baked',                        unit: 'g', g: 1, kcal: 2.06, p: 0.220, c: 0, f: 0.120, na: 0.61, fib: 0, step: 10, tags: ['protein'] },
    tuna_water:     { name: 'Tuna, canned in water',                unit: 'g', g: 1, kcal: 1.16, p: 0.260, c: 0, f: 0.010, na: 3.2, fib: 0, step: 10, tags: ['protein'] },
    egg:            { name: 'Egg, large',                           unit: 'egg', g: 50, kcal: 72, p: 6.3, c: 0.4, f: 4.8, na: 71, fib: 0, int: true, tags: ['protein'] },
    egg_white:      { name: 'Egg whites',                           unit: 'g', g: 1, kcal: 0.52, p: 0.110, c: 0.007, f: 0.002, na: 1.66, fib: 0, step: 10, tags: ['protein'] },
    yogurt_greek:   { name: 'Greek yogurt, nonfat, plain',          unit: 'g', g: 1, kcal: 0.59, p: 0.100, c: 0.036, f: 0.004, na: 0.36, fib: 0, step: 10, tags: ['protein', 'dairy'] },
    cottage_cheese: { name: 'Cottage cheese, 2%',                   unit: 'g', g: 1, kcal: 0.84, p: 0.110, c: 0.043, f: 0.023, na: 3.3, fib: 0, step: 10, tags: ['protein', 'dairy'] },
    milk_1pct:      { name: 'Milk, 1%',                             unit: 'cup', g: 244, kcal: 102, p: 8, c: 12, f: 2.4, na: 107, fib: 0, half: true, tags: ['dairy'] },
    milk_whole:     { name: 'Milk, whole',                          unit: 'cup', g: 244, kcal: 149, p: 8, c: 12, f: 8, na: 105, fib: 0, half: true, tags: ['dairy'] },
    cheddar:        { name: 'Cheddar cheese, shredded',             unit: 'oz', g: 28, kcal: 115, p: 7, c: 0.9, f: 9.5, na: 185, fib: 0, half: true, tags: ['dairy'] },
    mozzarella:     { name: 'Mozzarella, shredded',                 unit: 'oz', g: 28, kcal: 85, p: 6.3, c: 0.6, f: 6.3, na: 175, fib: 0, half: true, tags: ['dairy'] },

    oats_dry:       { name: 'Oats, dry',                            unit: 'g', g: 1, kcal: 3.75, p: 0.125, c: 0.675, f: 0.075, na: 0.05, fib: 0.100, step: 5, tags: ['carb', 'wholegrain'] },
    bread_ww:       { name: 'Whole-wheat bread',                    unit: 'slice', g: 43, kcal: 80, p: 4, c: 14, f: 1.1, na: 150, fib: 2, int: true, tags: ['carb', 'wholegrain'] },
    tortilla:       { name: 'Flour tortilla',                       unit: 'tortilla', g: 45, kcal: 140, p: 4, c: 23, f: 3.5, na: 350, fib: 1.5, int: true, tags: ['carb'] },
    pasta_cooked:   { name: 'Pasta, cooked',                        unit: 'g', g: 1, kcal: 1.58, p: 0.058, c: 0.31, f: 0.009, na: 0.01, fib: 0.018, step: 10, tags: ['carb'] },
    potato_baked:   { name: 'Baked potato, medium',                 unit: 'potato', g: 173, kcal: 161, p: 4.3, c: 37, f: 0.2, na: 17, fib: 3.8, half: true, tags: ['carb'] },
    sweet_potato:   { name: 'Sweet potato, baked',                  unit: 'g', g: 1, kcal: 0.86, p: 0.016, c: 0.20, f: 0.001, na: 0.55, fib: 0.030, step: 10, tags: ['carb'] },

    broccoli:       { name: 'Broccoli, steamed',                    unit: 'g', g: 1, kcal: 0.35, p: 0.024, c: 0.07, f: 0.004, na: 0.41, fib: 0.033, step: 10, tags: ['veg'] },
    green_beans:    { name: 'Green beans',                          unit: 'g', g: 1, kcal: 0.35, p: 0.019, c: 0.08, f: 0.002, na: 0.02, fib: 0.034, step: 10, tags: ['veg'] },
    corn:           { name: 'Corn kernels',                         unit: 'g', g: 1, kcal: 0.96, p: 0.034, c: 0.21, f: 0.015, na: 0.15, fib: 0.024, step: 10, tags: ['veg'] },
    mixed_veg:      { name: 'Mixed vegetables',                     unit: 'g', g: 1, kcal: 0.60, p: 0.030, c: 0.12, f: 0.003, na: 0.35, fib: 0.040, step: 10, tags: ['veg'] },
    salad_greens:   { name: 'Salad greens',                         unit: 'g', g: 1, kcal: 0.17, p: 0.012, c: 0.033, f: 0.002, na: 0.28, fib: 0.021, step: 10, tags: ['veg'] },
    banana:         { name: 'Banana, medium',                       unit: 'banana', g: 118, kcal: 105, p: 1.3, c: 27, f: 0.4, na: 1, fib: 3.1, half: true, tags: ['fruit'] },
    apple:          { name: 'Apple, medium',                        unit: 'apple', g: 182, kcal: 95, p: 0.5, c: 25, f: 0.3, na: 2, fib: 4.4, half: true, tags: ['fruit'] },
    strawberries:   { name: 'Strawberries',                         unit: 'g', g: 1, kcal: 0.32, p: 0.007, c: 0.077, f: 0.003, na: 0.01, fib: 0.020, step: 10, tags: ['fruit'] },
    grapes:         { name: 'Grapes',                               unit: 'g', g: 1, kcal: 0.69, p: 0.007, c: 0.18, f: 0.002, na: 0.02, fib: 0.009, step: 10, tags: ['fruit'] },

    avocado_half:   { name: 'Avocado, half',                        unit: 'half', g: 68, kcal: 120, p: 1.5, c: 6, f: 11, na: 5, fib: 5, half: true, tags: ['fat'] },
    olive_oil:      { name: 'Olive oil',                            unit: 'tbsp', g: 14, kcal: 119, p: 0, c: 0, f: 13.5, na: 0, fib: 0, half: true, tags: ['fat'] },
    butter:         { name: 'Butter',                               unit: 'tbsp', g: 14, kcal: 102, p: 0.1, c: 0, f: 11.5, na: 91, fib: 0, half: true, tags: ['fat'] },
    peanut_butter:  { name: 'Peanut butter',                        unit: 'tbsp', g: 16, kcal: 94, p: 4, c: 3, f: 8, na: 76, fib: 0.9, half: true, tags: ['fat', 'protein'] },
    almonds:        { name: 'Almonds',                              unit: 'oz', g: 28, kcal: 164, p: 6, c: 6, f: 14, na: 0, fib: 3.5, half: true, tags: ['fat'] },

    ketchup:        { name: 'Ketchup',                              unit: 'tbsp', g: 17, kcal: 19, p: 0.2, c: 5, f: 0, na: 154, fib: 0.1, int: true, tags: ['sauce'] },
    bbq_sauce:      { name: 'BBQ sauce',                            unit: 'tbsp', g: 17, kcal: 29, p: 0.2, c: 7, f: 0.1, na: 175, fib: 0.1, int: true, tags: ['sauce'] },
    ranch:          { name: 'Ranch dressing',                       unit: 'tbsp', g: 15, kcal: 64, p: 0.2, c: 1, f: 6.5, na: 135, fib: 0, int: true, tags: ['sauce', 'fat'] },
    salsa:          { name: 'Salsa',                                unit: 'tbsp', g: 16, kcal: 5, p: 0.25, c: 1, f: 0.05, na: 115, fib: 0.2, int: true, tags: ['sauce', 'veg'] },
    hot_sauce:      { name: 'Hot sauce',                            unit: 'tsp', g: 5, kcal: 1, p: 0, c: 0.1, f: 0, na: 125, fib: 0, int: true, tags: ['sauce'] },

    mac_cheese:     { name: 'Macaroni & cheese, prepared',          unit: 'cup', g: 198, kcal: 310, p: 11, c: 44, f: 10, na: 560, fib: 2, half: true, tags: ['carb'] },
    pizza_slice:    { name: 'Cheese pizza, slice',                  unit: 'slice', g: 107, kcal: 285, p: 12, c: 36, f: 10, na: 640, fib: 2.5, int: true, tags: ['carb'] }
  };

  /* Towne's four. Pre-checked, nothing else assumed. */
  const TOWNE_CORE = ['nuggets_frozen', 'fries_oven', 'rice_white', 'beans_black', 'ketchup'];

  /* Offered to her as opt-ins, roughly easiest-first. Nothing is ever added
     to her plan without her ticking it. */
  const TOWNE_OPTIONAL = [
    'chicken_strips_baked', 'protein_shake', 'fries_airfry', 'cheddar', 'mozzarella',
    'bbq_sauce', 'ranch', 'hot_sauce', 'salsa', 'mac_cheese', 'pizza_slice',
    'rice_brown', 'beans_pinto', 'beans_refried', 'tortilla', 'pasta_cooked',
    'potato_baked', 'chicken_breast', 'chicken_thigh', 'egg', 'milk_1pct',
    'yogurt_greek', 'cottage_cheese', 'bread_ww', 'peanut_butter', 'oats_dry',
    'banana', 'apple', 'strawberries', 'grapes', 'corn', 'green_beans',
    'broccoli', 'mixed_veg'
  ];

  const ALL_IDS = Object.keys(F);

  /* =======================================================================
     Meal templates. `needs` must all be in the eater's allowed list or the
     template is skipped, so a picky list simply yields fewer templates
     rather than food nobody will eat.
     ======================================================================= */
  const T = [
    /* ---------------- Towne ---------------- */
    { id: 't_b_nug_rice',    who: 'towne', meal: 'b', name: 'Nuggets & rice bowl',
      items: [{ id: 'nuggets_frozen', q: 5, min: 3, max: 9 }, { id: 'rice_white', q: 150, min: 100, max: 260 }, { id: 'ketchup', q: 1, fixed: true }],
      prep: 'Nuggets in the air fryer or oven (not fried) — 15 min at 400°F. Rice from the rice cooker or a microwave pouch.' },
    { id: 't_b_rice_beans',  who: 'towne', meal: 'b', name: 'Rice & beans bowl',
      items: [{ id: 'rice_white', q: 160, min: 110, max: 280 }, { id: 'beans_black', q: 130, min: 90, max: 220 }],
      prep: 'Rinse the beans before heating — it washes off a chunk of the can’s sodium.' },
    { id: 't_b_shake_nug',   who: 'towne', meal: 'b', name: 'Shake + a few nuggets', needs: ['protein_shake'],
      items: [{ id: 'protein_shake', q: 1, fixed: true }, { id: 'nuggets_frozen', q: 4, min: 3, max: 8 }],
      prep: 'Shake first, nuggets while it settles. Easiest 30 g of protein of the day.' },
    { id: 't_b_strips_rice', who: 'towne', meal: 'b', name: 'Chicken strips & rice', needs: ['chicken_strips_baked'],
      items: [{ id: 'chicken_strips_baked', q: 120, min: 90, max: 200 }, { id: 'rice_white', q: 130, min: 90, max: 230 }],
      prep: 'Make a tray of strips on Sunday, keep them in the fridge, reheat in the air fryer for 4 min.' },
    { id: 't_b_yog_fruit',   who: 'towne', meal: 'b', name: 'Yogurt & strawberries', needs: ['yogurt_greek', 'strawberries'],
      items: [{ id: 'yogurt_greek', q: 170, min: 130, max: 260 }, { id: 'strawberries', q: 100, min: 60, max: 180 }],
      prep: 'If plain is too sour, a teaspoon of honey is 21 calories — not a problem.' },

    { id: 't_l_nug_fries',   who: 'towne', meal: 'l', name: 'Nuggets & fries',
      items: [{ id: 'nuggets_frozen', q: 6, min: 4, max: 11 }, { id: 'fries_oven', q: 120, min: 80, max: 220 }, { id: 'ketchup', q: 1, fixed: true }],
      prep: 'Both in the oven on one tray. Baked, not fried — same food, roughly a third less fat.' },
    { id: 't_l_nug_rice_beans', who: 'towne', meal: 'l', name: 'Nuggets, rice & beans',
      items: [{ id: 'nuggets_frozen', q: 5, min: 4, max: 10 }, { id: 'rice_white', q: 150, min: 100, max: 260 }, { id: 'beans_black', q: 110, min: 80, max: 190 }],
      prep: 'The beans are doing real work here — 7 g of fiber per 100 g, which is what keeps you full until dinner.' },
    { id: 't_l_loaded_fries', who: 'towne', meal: 'l', name: 'Loaded fries', needs: ['cheddar'],
      items: [{ id: 'fries_oven', q: 150, min: 100, max: 240 }, { id: 'beans_black', q: 120, min: 80, max: 190 }, { id: 'cheddar', q: 1, min: 0.5, max: 2 }],
      prep: 'Fries first, beans and cheese on top, back in for 3 min to melt.' },
    { id: 't_l_strips_fries', who: 'towne', meal: 'l', name: 'Chicken strips & fries', needs: ['chicken_strips_baked'],
      items: [{ id: 'chicken_strips_baked', q: 150, min: 110, max: 240 }, { id: 'fries_oven', q: 120, min: 80, max: 200 }, { id: 'ketchup', q: 1, fixed: true }],
      prep: 'Exactly the meal you like, with the protein of a chicken breast.' },
    { id: 't_l_quesadilla',  who: 'towne', meal: 'l', name: 'Bean & cheese quesadilla', needs: ['tortilla', 'cheddar'],
      items: [{ id: 'tortilla', q: 1, min: 1, max: 2 }, { id: 'beans_refried', q: 90, min: 60, max: 150 }, { id: 'cheddar', q: 1, min: 0.5, max: 1.5 }],
      prep: 'Dry pan, 2 min a side.' },

    { id: 't_d_nug_rice_beans', who: 'towne', meal: 'd', name: 'Nuggets, rice & beans',
      items: [{ id: 'nuggets_frozen', q: 6, min: 4, max: 12 }, { id: 'rice_white', q: 170, min: 110, max: 300 }, { id: 'beans_black', q: 130, min: 90, max: 220 }],
      prep: 'The dinner that does the most for you out of your four foods.' },
    { id: 't_d_nug_fries',   who: 'towne', meal: 'd', name: 'Nuggets & fries',
      items: [{ id: 'nuggets_frozen', q: 7, min: 5, max: 13 }, { id: 'fries_oven', q: 140, min: 90, max: 240 }, { id: 'ketchup', q: 1, fixed: true }],
      prep: 'Yes, this is allowed. It is in the plan on purpose.' },
    { id: 't_d_strips_rice_beans', who: 'towne', meal: 'd', name: 'Chicken strips, rice & beans', needs: ['chicken_strips_baked'],
      items: [{ id: 'chicken_strips_baked', q: 170, min: 120, max: 270 }, { id: 'rice_white', q: 150, min: 100, max: 260 }, { id: 'beans_black', q: 120, min: 80, max: 200 }],
      prep: 'The single best dinner on your list for the abs goal.' },
    { id: 't_d_rice_beans_cheese', who: 'towne', meal: 'd', name: 'Cheesy rice & beans', needs: ['cheddar'],
      items: [{ id: 'rice_white', q: 180, min: 120, max: 300 }, { id: 'beans_black', q: 150, min: 100, max: 240 }, { id: 'cheddar', q: 1, min: 0.5, max: 2 }],
      prep: 'Stir the cheese through while the rice is hot.' },
    { id: 't_d_mac_nug',     who: 'towne', meal: 'd', name: 'Mac & cheese + nuggets', needs: ['mac_cheese'],
      items: [{ id: 'mac_cheese', q: 1, min: 0.5, max: 1.5 }, { id: 'nuggets_frozen', q: 5, min: 3, max: 9 }],
      prep: 'A big-appetite day meal. Fits best after a long gym day.' },

    /* ---------------- Danil ---------------- */
    { id: 'd_b_eggs_oats',   who: 'danil', meal: 'b', name: 'Eggs, oats & a banana',
      items: [{ id: 'egg', q: 3, min: 2, max: 6 }, { id: 'oats_dry', q: 45, min: 30, max: 90 }, { id: 'banana', q: 1, min: 0.5, max: 1 }],
      prep: 'Oats with water and a scoop of the chocolate powder if plain oats are grim.' },
    { id: 'd_b_shake_oats',  who: 'danil', meal: 'b', name: 'Shake, oats & peanut butter',
      items: [{ id: 'protein_shake', q: 1, fixed: true }, { id: 'oats_dry', q: 50, min: 35, max: 90 }, { id: 'peanut_butter', q: 1, min: 0.5, max: 2 }],
      prep: 'Ninety seconds. For the mornings you are running late.' },
    { id: 'd_b_eggs_toast',  who: 'danil', meal: 'b', name: 'Eggs, toast & avocado',
      items: [{ id: 'egg', q: 4, min: 3, max: 6 }, { id: 'bread_ww', q: 2, min: 1, max: 3 }, { id: 'avocado_half', q: 1, min: 0.5, max: 1 }],
      prep: '' },
    { id: 'd_b_yogurt',      who: 'danil', meal: 'b', name: 'Greek yogurt, berries & almonds',
      items: [{ id: 'yogurt_greek', q: 220, min: 150, max: 330 }, { id: 'strawberries', q: 110, min: 70, max: 180 }, { id: 'almonds', q: 1, min: 0.5, max: 1.5 }],
      prep: '' },

    { id: 'd_l_chicken_rice', who: 'danil', meal: 'l', name: 'Chicken, rice & broccoli',
      items: [{ id: 'chicken_breast', q: 180, min: 130, max: 280 }, { id: 'rice_white', q: 200, min: 140, max: 340 }, { id: 'broccoli', q: 150, min: 100, max: 250 }],
      prep: 'The unglamorous one that works. Cook three days of it at once.' },
    { id: 'd_l_beef_bowl',   who: 'danil', meal: 'l', name: 'Beef & bean bowl',
      items: [{ id: 'beef_ground_93', q: 150, min: 110, max: 230 }, { id: 'rice_white', q: 180, min: 130, max: 300 }, { id: 'beans_black', q: 120, min: 80, max: 200 }, { id: 'salsa', q: 2, fixed: true }],
      prep: '' },
    { id: 'd_l_tuna_pasta',  who: 'danil', meal: 'l', name: 'Tuna pasta',
      items: [{ id: 'tuna_water', q: 150, min: 110, max: 220 }, { id: 'pasta_cooked', q: 200, min: 140, max: 320 }, { id: 'olive_oil', q: 1, min: 0.5, max: 1.5 }],
      prep: '' },
    { id: 'd_l_same_as_hers', who: 'danil', meal: 'l', name: 'Nuggets & rice (same as Towne)',
      items: [{ id: 'nuggets_frozen', q: 8, min: 5, max: 14 }, { id: 'rice_white', q: 200, min: 140, max: 330 }, { id: 'ketchup', q: 1, fixed: true }],
      prep: 'Eating the same lunch is worth more for her sticking to this than the macros cost you.' },
    { id: 'd_l_chicken_wrap', who: 'danil', meal: 'l', name: 'Chicken wraps',
      items: [{ id: 'tortilla', q: 2, min: 1, max: 3 }, { id: 'chicken_breast', q: 160, min: 120, max: 240 }, { id: 'salad_greens', q: 60, min: 40, max: 120 }, { id: 'salsa', q: 2, fixed: true }],
      prep: '' },

    { id: 'd_d_steak_potato', who: 'danil', meal: 'd', name: 'Steak, baked potato & green beans',
      items: [{ id: 'steak_sirloin', q: 200, min: 150, max: 300 }, { id: 'potato_baked', q: 1, min: 0.5, max: 2 }, { id: 'green_beans', q: 150, min: 100, max: 250 }],
      prep: 'Full steak. This is the goal-compatible version of the thing you already want.' },
    { id: 'd_d_steak_rice_beans', who: 'danil', meal: 'd', name: 'Steak, rice & beans',
      items: [{ id: 'steak_sirloin', q: 180, min: 140, max: 270 }, { id: 'rice_white', q: 180, min: 130, max: 300 }, { id: 'beans_black', q: 120, min: 80, max: 200 }],
      prep: 'Her dinner with a steak on it — one pot of rice and beans feeds you both.' },
    { id: 'd_d_salmon_rice', who: 'danil', meal: 'd', name: 'Salmon, brown rice & broccoli',
      items: [{ id: 'salmon', q: 180, min: 130, max: 250 }, { id: 'rice_brown', q: 180, min: 130, max: 300 }, { id: 'broccoli', q: 150, min: 100, max: 250 }],
      prep: '' },
    { id: 'd_d_ribeye',      who: 'danil', meal: 'd', name: 'Ribeye & potato',
      items: [{ id: 'steak_ribeye', q: 200, min: 150, max: 260 }, { id: 'potato_baked', q: 1, min: 0.5, max: 1.5 }, { id: 'mixed_veg', q: 150, min: 100, max: 220 }],
      prep: 'Ribeye is the fattiest cut on your list — best on a 2 hour gym day.' },
    { id: 'd_d_chicken_fries', who: 'danil', meal: 'd', name: 'Chicken & fries',
      items: [{ id: 'chicken_breast', q: 200, min: 150, max: 300 }, { id: 'fries_oven', q: 150, min: 100, max: 240 }, { id: 'ketchup', q: 1, fixed: true }],
      prep: 'Eat the same dinner as her without blowing the day.' }
  ];

  /* ---- helpers ---- */
  const get = (id) => F[id] || null;
  const name = (id) => (F[id] ? F[id].name : id);

  /** Macros for `q` units of `id`. */
  function macros(id, q) {
    const f = F[id];
    if (!f) return { kcal: 0, p: 0, c: 0, fat: 0, na: 0, fib: 0 };
    return {
      kcal: f.kcal * q, p: f.p * q, c: f.c * q, fat: f.f * q,
      na: f.na * q, fib: f.fib * q
    };
  }

  /** Protein calories per total calories — how protein-efficient a food is. */
  const proteinDensity = (id) => {
    const f = F[id];
    return f && f.kcal > 0 ? (f.p * 4) / f.kcal : 0;
  };

  /** Round a quantity to something a human would actually measure. */
  function roundQty(id, q) {
    const f = F[id];
    if (!f) return q;
    if (f.int) return Math.max(1, Math.round(q));
    if (f.half) return Math.max(0.5, Math.round(q * 2) / 2);
    const step = f.step || 1;
    return Math.max(step, Math.round(q / step) * step);
  }

  /** "6 nuggets", "150 g rice", "1.5 cups milk" */
  function qtyLabel(id, q) {
    const f = F[id];
    if (!f) return String(q);
    if (f.unit === 'g') return `${Math.round(q)} g`;
    const n = f.int ? Math.round(q) : (Math.round(q * 2) / 2);
    const plural = n === 1 ? f.unit : (f.unit === 'half' ? 'halves' : f.unit + 's');
    return `${n} ${plural}`;
  }

  return {
    items: F, ALL_IDS, TOWNE_CORE, TOWNE_OPTIONAL, templates: T,
    get, name, macros, proteinDensity, roundQty, qtyLabel
  };
})();
