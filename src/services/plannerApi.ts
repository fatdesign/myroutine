import type { Routine, OneTimeTask, HistoryRecord, WorkoutHistoryRecord, WorkoutSession, WorkoutSessionRecord } from '../types';

const WORKER_URL = 'https://planner-ai.f-klavun.workers.dev';

interface WireTask {
  id: number;
  text: string;
  time: string;
  completed: number;
  is_routine: number;
  weekdays: string | null;
  last_completed_date: string | null;
  type: 'morning' | 'evening' | null;
  media_url: string | null;
}

interface WireHistory {
  date: string;
  completed_count: number;
  total_count: number;
  level: number;
  journal: string | null;
}

interface HistoryUpsert {
  completedCount: number;
  totalCount: number;
  level: number;
  journal?: string;
}

const toRoutine = (t: WireTask): Routine => ({
  id: String(t.id),
  title: t.text,
  time: t.time,
  completed: !!t.completed,
  type: t.type === 'evening' ? 'evening' : 'morning',
  lastCompletedDate: t.last_completed_date || undefined,
  mediaUrl: t.media_url || undefined,
  weekdays: t.weekdays || undefined,
});

const toOneTimeTask = (t: WireTask): OneTimeTask => ({
  id: String(t.id),
  title: t.text,
  time: t.time,
  completed: !!t.completed,
  lastCompletedDate: t.last_completed_date || undefined,
});

const DEFAULT_ROUTINES: Routine[] = [
  { id: 'm1', title: 'Meditation', time: '07:45', completed: false, type: 'morning', weekdays: '1,3' },
  { id: 'm2', title: 'Journal schreiben', time: '08:00', completed: false, type: 'morning', weekdays: '' },
  { id: 'm3', title: 'Workout', time: '08:00', completed: false, type: 'morning', weekdays: '1,2,3,4,5,6' },
  { id: 'e1', title: 'Abendritual Stretching', time: '19:00', completed: false, type: 'evening', weekdays: '1,3,5,6,7' },
  { id: 'e2', title: 'Journaling', time: '20:00', completed: false, type: 'evening', weekdays: '' },
];

const DEFAULT_TASKS: OneTimeTask[] = [
  { id: 't1', title: 'Spazieren gehen', time: '07:30', completed: false },
  { id: 't2', title: 'eine Liste machen mit 10 Ziele für dieses Jahr, die ich erreichen will', time: '20:00', completed: false },
];

export async function fetchAllTasks(): Promise<{ routines: Routine[]; oneTimeTasks: OneTimeTask[] }> {
  try {
    const res = await fetch(`${WORKER_URL}/tasks`);
    if (!res.ok) throw new Error('Worker response not ok');
    const data: WireTask[] = await res.json();
    const fetchedRoutines = data.filter(t => t.is_routine == 1).map(toRoutine);
    const fetchedOneTimeTasks = data.filter(t => t.is_routine == 0).map(toOneTimeTask);
    
    if (fetchedRoutines.length > 0 || fetchedOneTimeTasks.length > 0) {
      localStorage.setItem('sanktum_routines', JSON.stringify(fetchedRoutines));
      localStorage.setItem('sanktum_tasks', JSON.stringify(fetchedOneTimeTasks));
      return { routines: fetchedRoutines, oneTimeTasks: fetchedOneTimeTasks };
    }
  } catch (err) {
    console.warn('Backend offline or error, falling back to local storage:', err);
  }

  const localRoutines = localStorage.getItem('sanktum_routines');
  const localTasks = localStorage.getItem('sanktum_tasks');

  const routines: Routine[] = localRoutines ? JSON.parse(localRoutines) : DEFAULT_ROUTINES;
  const oneTimeTasks: OneTimeTask[] = localTasks ? JSON.parse(localTasks) : DEFAULT_TASKS;

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

  const activeRoutines = routines.map(r => {
    if (r.completed && r.lastCompletedDate && r.lastCompletedDate < todayStr) {
      return { ...r, completed: false };
    }
    return r;
  });

  const activeOneTimeTasks = oneTimeTasks.filter(t => {
    if (t.completed && t.lastCompletedDate && t.lastCompletedDate < todayStr) {
      return false;
    }
    return true;
  });

  return { routines: activeRoutines, oneTimeTasks: activeOneTimeTasks };
}

export async function createRoutine(routine: Omit<Routine, 'id' | 'completed'>): Promise<void> {
  const newRoutine: Routine = { ...routine, id: String(Date.now()), completed: false };
  try {
    await fetch(`${WORKER_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: routine.title,
        time: routine.time,
        is_routine: true,
        type: routine.type,
        mediaUrl: routine.mediaUrl || null,
        weekdays: routine.weekdays || null,
      }),
    });
  } catch (e) {
    console.warn('Worker create error:', e);
  }

  const current = localStorage.getItem('sanktum_routines');
  const list: Routine[] = current ? JSON.parse(current) : DEFAULT_ROUTINES;
  localStorage.setItem('sanktum_routines', JSON.stringify([...list, newRoutine]));
}

export async function updateRoutine(id: string, routine: Omit<Routine, 'id'>): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: routine.title,
        time: routine.time,
        is_routine: true,
        completed: routine.completed,
        type: routine.type,
        mediaUrl: routine.mediaUrl || null,
        weekdays: routine.weekdays || null,
      }),
    });
  } catch (e) {
    console.warn('Worker update error:', e);
  }

  const current = localStorage.getItem('sanktum_routines');
  const list: Routine[] = current ? JSON.parse(current) : DEFAULT_ROUTINES;
  const updated = list.map(r => r.id === id ? { ...routine, id } : r);
  localStorage.setItem('sanktum_routines', JSON.stringify(updated));
}

export async function updateOneTimeTask(id: string, task: Omit<OneTimeTask, 'id'>): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: task.title,
        time: task.time,
        is_routine: false,
        completed: task.completed,
        weekdays: null,
      }),
    });
  } catch (e) {
    console.warn('Worker task update error:', e);
  }

  const current = localStorage.getItem('sanktum_tasks');
  const list: OneTimeTask[] = current ? JSON.parse(current) : DEFAULT_TASKS;
  const updated = list.map(t => t.id === id ? { ...task, id } : t);
  localStorage.setItem('sanktum_tasks', JSON.stringify(updated));
}

export async function createOneTimeTask(task: Omit<OneTimeTask, 'id' | 'completed'>): Promise<void> {
  const newTask: OneTimeTask = { ...task, id: String(Date.now()), completed: false };
  try {
    await fetch(`${WORKER_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: task.title,
        time: task.time,
        is_routine: false,
        weekdays: null,
      }),
    });
  } catch (e) {
    console.warn('Worker create task error:', e);
  }

  const current = localStorage.getItem('sanktum_tasks');
  const list: OneTimeTask[] = current ? JSON.parse(current) : DEFAULT_TASKS;
  localStorage.setItem('sanktum_tasks', JSON.stringify([...list, newTask]));
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
  } catch (e) {
    console.warn('Worker toggle error:', e);
  }

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

  const currentR = localStorage.getItem('sanktum_routines');
  if (currentR) {
    const list: Routine[] = JSON.parse(currentR);
    if (list.some(r => r.id === id)) {
      const updated = list.map(r => r.id === id ? { ...r, completed, lastCompletedDate: completed ? todayStr : r.lastCompletedDate } : r);
      localStorage.setItem('sanktum_routines', JSON.stringify(updated));
      return;
    }
  }

  const currentT = localStorage.getItem('sanktum_tasks');
  if (currentT) {
    const list: OneTimeTask[] = JSON.parse(currentT);
    if (list.some(t => t.id === id)) {
      const updated = list.map(t => t.id === id ? { ...t, completed, lastCompletedDate: completed ? todayStr : t.lastCompletedDate } : t);
      localStorage.setItem('sanktum_tasks', JSON.stringify(updated));
    }
  }
}

export async function deleteTask(id: string): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/tasks/${id}`, { method: 'DELETE' });
  } catch (e) {
    console.warn('Worker delete error:', e);
  }

  const currentR = localStorage.getItem('sanktum_routines');
  if (currentR) {
    const list: Routine[] = JSON.parse(currentR);
    localStorage.setItem('sanktum_routines', JSON.stringify(list.filter(r => r.id !== id)));
  }
  const currentT = localStorage.getItem('sanktum_tasks');
  if (currentT) {
    const list: OneTimeTask[] = JSON.parse(currentT);
    localStorage.setItem('sanktum_tasks', JSON.stringify(list.filter(t => t.id !== id)));
  }
}

export async function fetchHistory(): Promise<HistoryRecord> {
  try {
    const res = await fetch(`${WORKER_URL}/history`);
    if (!res.ok) throw new Error('Failed to fetch history');
    const data: WireHistory[] = await res.json();
    const record: HistoryRecord = {};
    for (const row of data) {
      record[row.date] = {
        date: row.date,
        completedCount: row.completed_count,
        totalCount: row.total_count,
        level: row.level,
        journal: row.journal || undefined,
      };
    }
    localStorage.setItem('sanktum_history', JSON.stringify(record));
    return record;
  } catch (e) {
    console.warn('Worker history error:', e);
    const local = localStorage.getItem('sanktum_history');
    return local ? JSON.parse(local) : {};
  }
}

export async function upsertHistory(date: string, entry: HistoryUpsert): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/history/${date}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch (e) {
    console.warn('Worker history upsert error:', e);
  }

  const local = localStorage.getItem('sanktum_history');
  const record: HistoryRecord = local ? JSON.parse(local) : {};
  record[date] = {
    date,
    completedCount: entry.completedCount,
    totalCount: entry.totalCount,
    level: entry.level,
    journal: entry.journal,
  };
  localStorage.setItem('sanktum_history', JSON.stringify(record));
}

export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const res = await fetch(`${WORKER_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated) return true;
    }
  } catch (e) {
    console.warn('Worker auth unavailable, checking local fallback:', e);
  }

  // Fallback: check stored local password or default fallback
  const stored = localStorage.getItem('myroutine_pass') || 'sanktum2026';
  return password.trim() === stored.trim() || password.trim() === 'sanktum2026';
}

export async function fetchWorkoutHistory(): Promise<WorkoutHistoryRecord> {
  try {
    const res = await fetch(`${WORKER_URL}/workout-history`);
    if (!res.ok) throw new Error('Failed to fetch workout history');
    const data: { date: string, exercise_id: string, completed_sets: number }[] = await res.json();
    const record: WorkoutHistoryRecord = {};
    for (const row of data) {
      if (!record[row.date]) record[row.date] = {};
      record[row.date][row.exercise_id] = row.completed_sets;
    }
    localStorage.setItem('sanktum_workout_history', JSON.stringify(record));
    return record;
  } catch (e) {
    console.warn('Worker workout history error:', e);
    const local = localStorage.getItem('sanktum_workout_history');
    return local ? JSON.parse(local) : {};
  }
}

export async function upsertWorkoutHistory(date: string, exercises: Record<string, number>): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/workout-history/${date}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercises }),
    });
  } catch (e) {
    console.warn('Worker workout history upsert error:', e);
  }

  const local = localStorage.getItem('sanktum_workout_history');
  const record: WorkoutHistoryRecord = local ? JSON.parse(local) : {};
  record[date] = exercises;
  localStorage.setItem('sanktum_workout_history', JSON.stringify(record));
}

export type ExerciseOverrideRecord = Record<string, { sets?: number; reps?: number; weight?: number }>;

export async function fetchExerciseOverrides(): Promise<ExerciseOverrideRecord> {
  try {
    const res = await fetch(`${WORKER_URL}/exercise-overrides`);
    if (!res.ok) throw new Error('Failed to fetch exercise overrides');
    const data: { exercise_id: string; sets?: number; reps?: number; weight?: number }[] = await res.json();
    const record: ExerciseOverrideRecord = {};
    for (const row of data) {
      record[row.exercise_id] = { sets: row.sets ?? undefined, reps: row.reps ?? undefined, weight: row.weight ?? undefined };
    }
    localStorage.setItem('sanktum_exercise_overrides', JSON.stringify(record));
    return record;
  } catch (e) {
    console.warn('Worker exercise overrides error:', e);
    const local = localStorage.getItem('sanktum_exercise_overrides');
    return local ? JSON.parse(local) : {};
  }
}

export async function upsertExerciseOverride(exerciseId: string, override: Partial<{ sets: number; reps: number; weight: number }>): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/exercise-overrides/${exerciseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(override),
    });
  } catch (e) {
    console.warn('Worker exercise override upsert error:', e);
  }

  const local = localStorage.getItem('sanktum_exercise_overrides');
  const record: ExerciseOverrideRecord = local ? JSON.parse(local) : {};
  record[exerciseId] = { ...record[exerciseId], ...override };
  localStorage.setItem('sanktum_exercise_overrides', JSON.stringify(record));
}

export async function uploadImage(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const res = await fetch(`${WORKER_URL}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'image/jpeg' },
      body: arrayBuffer,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) return data.url;
    }
  } catch (e) {
    console.warn('R2 Upload error:', e);
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export async function fetchWorkoutSessions(): Promise<WorkoutSessionRecord> {
  try {
    const res = await fetch(`${WORKER_URL}/workout-sessions`);
    if (!res.ok) throw new Error('Failed to fetch workout sessions');
    const data: { date: string; duration_seconds: number; body_weight?: number; body_fat?: number; neck?: number; waist?: number; hip?: number; photo_url?: string }[] = await res.json();
    const record: WorkoutSessionRecord = {};
    for (const row of data) {
      record[row.date] = {
        date: row.date,
        durationSeconds: row.duration_seconds,
        bodyWeight: row.body_weight,
        bodyFat: row.body_fat,
        neck: row.neck,
        waist: row.waist,
        hip: row.hip,
        photoUrl: row.photo_url,
      };
    }
    localStorage.setItem('sanktum_workout_sessions', JSON.stringify(record));
    return record;
  } catch (e) {
    console.warn('Worker workout sessions error:', e);
    const local = localStorage.getItem('sanktum_workout_sessions');
    return local ? JSON.parse(local) : {};
  }
}

export async function upsertWorkoutSession(date: string, session: Partial<WorkoutSession>): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/workout-sessions/${date}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        durationSeconds: session.durationSeconds,
        bodyWeight: session.bodyWeight,
        bodyFat: session.bodyFat,
        neck: session.neck,
        waist: session.waist,
        hip: session.hip,
        photoUrl: session.photoUrl,
      }),
    });
  } catch (e) {
    console.warn('Worker workout session upsert error:', e);
  }

  const local = localStorage.getItem('sanktum_workout_sessions');
  const record: WorkoutSessionRecord = local ? JSON.parse(local) : {};
  record[date] = { ...record[date], ...session, date };
  localStorage.setItem('sanktum_workout_sessions', JSON.stringify(record));
}

// --- Nutrition API Methods ---
import type { NutritionProfile, NutritionPlan, LoggedMeal, WeeklyCoachReport } from '../types';

export async function fetchNutritionProfile(): Promise<NutritionProfile> {
  try {
    const res = await fetch(`${WORKER_URL}/nutrition-profile`);
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('sanktum_nutrition_profile', JSON.stringify(data));
      return data;
    }
  } catch (e) {
    console.warn('Fetch nutrition profile error:', e);
  }
  const local = localStorage.getItem('sanktum_nutrition_profile');
  return local ? JSON.parse(local) : {
    meals_per_day: 3,
    breakfast_type: 'normal',
    diet_focus: 'high_protein',
    preferences: '',
    allergies: ''
  };
}

export async function upsertNutritionProfile(profile: NutritionProfile): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/nutrition-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
  } catch (e) {
    console.warn('Upsert nutrition profile error:', e);
  }
  localStorage.setItem('sanktum_nutrition_profile', JSON.stringify(profile));
}

export async function fetchNutritionPlan(): Promise<NutritionPlan | null> {
  try {
    const res = await fetch(`${WORKER_URL}/nutrition-plans`);
    if (res.ok) {
      const data = await res.json();
      if (data.plan) {
        localStorage.setItem('sanktum_nutrition_plan', JSON.stringify(data.plan));
        return data.plan;
      }
    }
  } catch (e) {
    console.warn('Fetch nutrition plan error:', e);
  }
  const local = localStorage.getItem('sanktum_nutrition_plan');
  return local ? JSON.parse(local) : null;
}

export async function generateAiNutritionPlan(
  profile: NutritionProfile,
  metrics: { targetCalories: number; proteinGrams: number; fatGrams: number; carbsGrams: number },
  dayFocus: string
): Promise<NutritionPlan> {
  try {
    const res = await fetch(`${WORKER_URL}/generate-nutrition-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, metrics, dayFocus })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.plan) {
        localStorage.setItem('sanktum_nutrition_plan', JSON.stringify(data.plan));
        return data.plan;
      }
    }
  } catch (e) {
    console.warn('Generate AI plan error:', e);
  }
  throw new Error('Fehler bei der KI-Ernährungsplan Generierung');
}

export async function sendTelegramNutritionPlan(plan: NutritionPlan): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${WORKER_URL}/send-telegram-nutrition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan })
    });
    const data = await res.json();
    return data;
  } catch (e: any) {
    return { success: false, error: e.message || 'Verbindungsfehler zum Telegram Server' };
  }
}

export interface BodyMetricsCalculatorInputs {
  gender: 'male' | 'female';
  age: number;
  weight: number;
  height: number;
  neck: number;
  waist: number;
  hip: number;
  targetKfa: number;
  activityLevel: number;
  targetDeficitMode: number;
  visionImageUrl?: string;
}

export async function fetchBodyMetricsInputs(): Promise<BodyMetricsCalculatorInputs> {
  try {
    const res = await fetch(`${WORKER_URL}/body-metrics-inputs`);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        localStorage.setItem('myroutine_calc_gender', data.gender || 'male');
        localStorage.setItem('myroutine_calc_age', String(data.age || 27));
        localStorage.setItem('myroutine_calc_weight', String(data.weight || 90));
        localStorage.setItem('myroutine_calc_height', String(data.height || 186));
        localStorage.setItem('myroutine_calc_neck', String(data.neck || 44));
        localStorage.setItem('myroutine_calc_waist', String(data.waist || 100));
        localStorage.setItem('myroutine_calc_hip', String(data.hip || 100));
        localStorage.setItem('myroutine_calc_target_kfa', String(data.targetKfa || 7.0));
        localStorage.setItem('myroutine_calc_activity', String(data.activityLevel || 1.55));
        localStorage.setItem('myroutine_calc_deficit', String(data.targetDeficitMode || 500));
        if (data.visionImageUrl) {
          localStorage.setItem('myroutine_vision_image', data.visionImageUrl);
        }
        window.dispatchEvent(new Event('myroutine_body_metrics_updated'));
        return {
          gender: data.gender || 'male',
          age: Number(data.age) || 27,
          weight: Number(data.weight) || 90,
          height: Number(data.height) || 186,
          neck: Number(data.neck) || 44,
          waist: Number(data.waist) || 100,
          hip: Number(data.hip) || 100,
          targetKfa: Number(data.targetKfa) || 7.0,
          activityLevel: Number(data.activityLevel) || 1.55,
          targetDeficitMode: Number(data.targetDeficitMode) || 500,
          visionImageUrl: data.visionImageUrl || localStorage.getItem('myroutine_vision_image') || undefined
        };
      }
    }
  } catch (e) {
    console.warn('Fetch body metrics inputs error:', e);
  }
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
    targetDeficitMode: Number(localStorage.getItem('myroutine_calc_deficit')) || 500,
    visionImageUrl: localStorage.getItem('myroutine_vision_image') || undefined
  };
}

export async function upsertBodyMetricsInputs(inputs: BodyMetricsCalculatorInputs): Promise<void> {
  localStorage.setItem('myroutine_calc_gender', inputs.gender);
  localStorage.setItem('myroutine_calc_age', String(inputs.age));
  localStorage.setItem('myroutine_calc_weight', String(inputs.weight));
  localStorage.setItem('myroutine_calc_height', String(inputs.height));
  localStorage.setItem('myroutine_calc_neck', String(inputs.neck));
  localStorage.setItem('myroutine_calc_waist', String(inputs.waist));
  localStorage.setItem('myroutine_calc_hip', String(inputs.hip));
  localStorage.setItem('myroutine_calc_target_kfa', String(inputs.targetKfa));
  localStorage.setItem('myroutine_calc_activity', String(inputs.activityLevel));
  localStorage.setItem('myroutine_calc_deficit', String(inputs.targetDeficitMode));
  if (inputs.visionImageUrl) {
    localStorage.setItem('myroutine_vision_image', inputs.visionImageUrl);
  }
  window.dispatchEvent(new Event('myroutine_body_metrics_updated'));

  try {
    await fetch(`${WORKER_URL}/body-metrics-inputs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs)
    });
  } catch (e) {
    console.warn('Upsert body metrics inputs error:', e);
  }
}

export async function fetchDailyMacroLogs(dateStr?: string): Promise<LoggedMeal[]> {
  try {
    const today = dateStr || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
    const res = await fetch(`${WORKER_URL}/macro-logs?date=${today}`);
    if (res.ok) {
      const data = await res.json();
      return data || [];
    }
  } catch (e) {
    console.warn('Fetch macro logs error:', e);
  }
  return [];
}

export async function fetchMonthlyMacroLogs(monthStr: string): Promise<LoggedMeal[]> {
  try {
    const res = await fetch(`${WORKER_URL}/macro-logs?month=${monthStr}`);
    if (res.ok) {
      const data = await res.json();
      return data || [];
    }
  } catch (e) {
    console.warn('Fetch monthly macro logs error:', e);
  }
  return [];
}

export async function fetchMacroLogMonths(): Promise<string[]> {
  try {
    const res = await fetch(`${WORKER_URL}/macro-logs/months`);
    if (res.ok) {
      const data = await res.json();
      return data || [];
    }
  } catch (e) {
    console.warn('Fetch macro log months error:', e);
  }
  return [];
}

export async function deleteLoggedMeal(id: string): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/macro-logs/${id}`, { method: 'DELETE' });
  } catch (e) {
    console.warn('Delete logged meal error:', e);
  }
}

export async function updateLoggedMeal(id: string, updates: Partial<{ meal_name: string; calories: number; protein: number; fat: number; carbs: number }>): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/macro-logs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch (e) {
    console.warn('Update logged meal error:', e);
  }
}

export async function fetchWeeklyCoachReport(): Promise<WeeklyCoachReport | null> {
  try {
    const res = await fetch(`${WORKER_URL}/weekly-coach-report`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Fetch weekly coach report error:', e);
  }
  return null;
}

export async function generateWeeklyCoachReport(): Promise<WeeklyCoachReport> {
  const res = await fetch(`${WORKER_URL}/weekly-coach-report`, { method: 'POST' });
  if (res.ok) {
    return await res.json();
  }
  throw new Error('Fehler bei der Generierung des Wochen-Coach Reports');
}

// --- Water Log & Hydration Guard API ---
export interface WaterLog {
  id: string;
  date: string;
  time: string;
  amount_ml: number;
}

export async function fetchDailyWaterLogs(): Promise<{ logs: WaterLog[]; totalMl: number }> {
  try {
    const res = await fetch(`${WORKER_URL}/water-logs`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Fetch water logs error:', e);
  }
  return { logs: [], totalMl: 0 };
}

export async function addWaterLog(amountMl: number): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/water-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_ml: amountMl })
    });
  } catch (e) {
    console.warn('Add water log error:', e);
  }
}

export async function deleteWaterLog(id: string): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/water-logs`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  } catch (e) {
    console.warn('Delete water log error:', e);
  }
}

// --- Progress Photos Vault API ---
export interface ProgressPhoto {
  date: string;
  body_weight?: number;
  body_fat?: number;
  neck?: number;
  waist?: number;
  photo_url?: string;
}

export async function fetchProgressPhotos(): Promise<ProgressPhoto[]> {
  try {
    const res = await fetch(`${WORKER_URL}/progress-photos`);
    if (res.ok) {
      const data = await res.json();
      return data.photos || [];
    }
  } catch (e) {
    console.warn('Fetch progress photos error:', e);
  }
  return [];
}

// --- Trigger Telegram Briefings API ---
export async function triggerMorningBriefing(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${WORKER_URL}/trigger-morning-briefing`, { method: 'POST' });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function triggerEveningRecap(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${WORKER_URL}/trigger-evening-recap`, { method: 'POST' });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export interface AppSettings {
  morning_briefing_time?: string;
  evening_recap_time?: string;
  [key: string]: string | undefined;
}

export async function fetchAppSettings(): Promise<AppSettings> {
  try {
    const res = await fetch(`${WORKER_URL}/settings`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Fetch settings error:', e);
  }
  return {
    morning_briefing_time: '07:00',
    evening_recap_time: '21:00'
  };
}

export async function updateAppSettings(settings: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(`${WORKER_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return res.ok;
  } catch (e) {
    console.warn('Update settings error:', e);
    return false;
  }
}


