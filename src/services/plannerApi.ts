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
    const data: { date: string; duration_seconds: number; body_weight?: number; photo_url?: string }[] = await res.json();
    const record: WorkoutSessionRecord = {};
    for (const row of data) {
      record[row.date] = {
        date: row.date,
        durationSeconds: row.duration_seconds,
        bodyWeight: row.body_weight,
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

