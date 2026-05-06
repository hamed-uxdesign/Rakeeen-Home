// Initial Data for a fresh start
export const POMODORO_WEEKLY_MOCK = [
  { day: 'Mon', sessions: 0 },
  { day: 'Tue', sessions: 0 },
  { day: 'Wed', sessions: 0 },
  { day: 'Thu', sessions: 0 },
  { day: 'Fri', sessions: 0 },
  { day: 'Sat', sessions: 0 },
  { day: 'Sun', sessions: 0 },
];

export const POMODORO_MONTHLY_MOCK = [
  { week: 'W1', sessions: 0 },
  { week: 'W2', sessions: 0 },
  { week: 'W3', sessions: 0 },
  { week: 'W4', sessions: 0 },
];

export const WEEKLY_CALORIES_MOCK = [
  { day: 'Mon', consumed: 0 },
  { day: 'Tue', consumed: 0 },
  { day: 'Wed', consumed: 0 },
  { day: 'Thu', consumed: 0 },
  { day: 'Fri', consumed: 0 },
  { day: 'Sat', consumed: 0 },
  { day: 'Sun', consumed: 0 },
];

export const CALORIE_GOAL = 2400;

export const FOOD_DB: Record<string, { kcal_per_g: number, protein: number, carbs: number, fat: number }> = {
  'Oats': { kcal_per_g: 3.8, protein: 0.17, carbs: 0.66, fat: 0.07 },
  'Chicken Breast': { kcal_per_g: 1.6, protein: 0.31, carbs: 0, fat: 0.036 },
  'Rice': { kcal_per_g: 1.3, protein: 0.027, carbs: 0.28, fat: 0.003 },
  'Egg': { kcal_per_g: 1.5, protein: 0.13, carbs: 0.01, fat: 0.11 },
  'Peanut Butter': { kcal_per_g: 5.9, protein: 0.25, carbs: 0.2, fat: 0.5 },
  'Banana': { kcal_per_g: 0.89, protein: 0.011, carbs: 0.23, fat: 0.003 },
};

export const MOCK_CALENDAR = [
  { id: 1, time: '09:00', duration: 30, title: 'Morning Setup', type: 'admin' },
];

export const MOCK_PRAYER_TIMES = {
  Fajr: "04:30",
  Dhuhr: "12:00",
  Asr: "15:30",
  Maghrib: "18:30",
  Isha: "20:00"
};
