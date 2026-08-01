export interface BodyMetrics {
  kfa: number;
  fatMass: number;
  leanMass: number;
  bmiKfa: number;
  fatToLose: number;
  bmr: number;
  tdee: number;
  targetCalories: number;
  daysToTarget: number;
  weeksToTarget: string;
  fatLossPerWeek: string;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  category: string;
  categoryColor: string;
}

export function getStoredCalculatorInputs() {
  return {
    gender: (localStorage.getItem('myroutine_calc_gender') as 'male' | 'female') || 'male',
    age: Number(localStorage.getItem('myroutine_calc_age')) || 27,
    weight: Number(localStorage.getItem('myroutine_calc_weight')) || 90,
    height: Number(localStorage.getItem('myroutine_calc_height')) || 186,
    neck: Number(localStorage.getItem('myroutine_calc_neck')) || 44,
    waist: Number(localStorage.getItem('myroutine_calc_waist')) || 100,
    hip: Number(localStorage.getItem('myroutine_calc_hip')) || 100,
    targetKfa: Number(localStorage.getItem('myroutine_calc_target_kfa')) || 7.0,
    activityLevel: Number(localStorage.getItem('myroutine_calc_activity')) || 1.55,
    targetDeficitMode: Number(localStorage.getItem('myroutine_calc_deficit')) || 500
  };
}

export function calculateMetricsFromInputs(inputs: ReturnType<typeof getStoredCalculatorInputs>): BodyMetrics {
  const { gender, age, weight, height, neck, waist, hip, targetKfa, activityLevel, targetDeficitMode } = inputs;
  
  let navyKfa = 0;
  if (gender === 'male') {
    if (waist > neck && height > 0) {
      const density = 1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height);
      navyKfa = (495 / density) - 450;
    }
  } else {
    if (waist + hip > neck && height > 0) {
      const density = 1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(height);
      navyKfa = (495 / density) - 450;
    }
  }
  
  if (navyKfa < 2) navyKfa = 2;
  if (navyKfa > 50) navyKfa = 50;

  const fatMass = weight * (navyKfa / 100);
  const leanMass = weight - fatMass;

  // BMI method
  const bmi = weight / Math.pow(height / 100, 2);
  const bmiKfa = 1.20 * bmi + 0.23 * age - (gender === 'male' ? 16.2 : 5.4);

  // Target fat loss to reach target KFA
  const targetFatMass = weight * (targetKfa / 100);
  const fatToLose = Math.max(0, fatMass - targetFatMass);

  // BMR (Katch-McArdle using Lean Mass)
  const bmr = 370 + (21.6 * leanMass);
  const tdee = bmr * activityLevel;
  const targetCalories = Math.max(1200, Math.round(tdee - targetDeficitMode));

  // Fat Loss Physics (7700 kcal = 1 kg fat)
  const totalFatKcalToLose = fatToLose * 7700;
  const daysToTarget = targetDeficitMode > 0 ? Math.ceil(totalFatKcalToLose / targetDeficitMode) : 0;
  const weeksToTarget = (daysToTarget / 7).toFixed(1);
  const fatLossPerWeek = ((targetDeficitMode * 7) / 7700).toFixed(2);

  // Optimal V-Shape Macros
  const proteinGrams = Math.round(2.2 * leanMass);
  const fatGrams = Math.round(0.8 * weight);
  const carbsKcal = Math.max(0, targetCalories - (proteinGrams * 4) - (fatGrams * 9));
  const carbsGrams = Math.round(carbsKcal / 4);

  // Category determination
  let category = 'Fitness';
  let categoryColor = '#06b6d4';
  if (navyKfa < 6) { category = 'Essentiell'; categoryColor = '#eab308'; }
  else if (navyKfa < 14) { category = 'Athlet (V-Shape Zone)'; categoryColor = '#22c55e'; }
  else if (navyKfa < 18) { category = 'Fitness'; categoryColor = '#06b6d4'; }
  else if (navyKfa < 25) { category = 'Durchschnitt'; categoryColor = '#f97316'; }
  else { category = 'Höherer KFA'; categoryColor = '#ef4444'; }

  return {
    kfa: Number(navyKfa.toFixed(1)),
    fatMass: Number(fatMass.toFixed(1)),
    leanMass: Number(leanMass.toFixed(1)),
    bmiKfa: Number(bmiKfa.toFixed(1)),
    fatToLose: Number(fatToLose.toFixed(1)),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    daysToTarget,
    weeksToTarget,
    fatLossPerWeek,
    proteinGrams,
    fatGrams,
    carbsGrams,
    category,
    categoryColor
  };
}

export function getLiveBodyMetrics(): BodyMetrics {
  return calculateMetricsFromInputs(getStoredCalculatorInputs());
}
