export interface Routine {
  id: string;
  title: string;
  time: string;
  completed: boolean;
  type: 'morning' | 'evening';
  lastCompletedDate?: string;
  mediaUrl?: string;
  weekdays?: string; // e.g. "1,2,3,4,5" (1=Mo..7=So), empty/undefined = every day
}

export interface OneTimeTask {
  id: string;
  title: string;
  time: string;
  completed: boolean;
  lastCompletedDate?: string;
}

export interface DayHistory {
  date: string; // YYYY-MM-DD
  completedCount: number;
  totalCount: number;
  level: number; // 0-4 for GitHub style graph
  journal?: string; // Daily Grimoire entry
}

export type HistoryRecord = Record<string, DayHistory>;

export type WorkoutHistoryRecord = Record<string, Record<string, number>>;

export interface WorkoutSession {
  date: string;
  durationSeconds: number;
  bodyWeight?: number;
  bodyFat?: number;
  photoUrl?: string;
}

export type WorkoutSessionRecord = Record<string, WorkoutSession>;

export interface NutritionProfile {
  meals_per_day: number;
  breakfast_type: 'normal' | 'intermittent_fasting' | 'shake_only' | 'high_protein';
  diet_focus: 'high_protein' | 'v_shape_shred' | 'balanced' | 'low_carb';
  preferences: string;
  allergies: string;
}

export interface Meal {
  time: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  estimatedPriceEur?: number;
  ingredients: string[];
  instructions: string;
}

export interface ShoppingItem {
  category: string;
  item: string;
}

export interface NutritionPlan {
  dayName: string;
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  estimatedTotalPriceEur?: number;
  estimatedSupermarketReceiptEur?: number;
  meals: Meal[];
  shoppingList: ShoppingItem[];
}


