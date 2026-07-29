import type { Routine, HistoryRecord } from '../types';

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
});

// myroutine only manages daily rituals (is_routine=1); one-time tasks added via Telegram are left alone
export async function fetchRoutines(): Promise<Routine[]> {
  const res = await fetch(`${WORKER_URL}/tasks`);
  if (!res.ok) throw new Error('Failed to fetch routines');
  const data: WireTask[] = await res.json();
  return data.filter(t => t.is_routine == 1).map(toRoutine);
}

export async function createRoutine(routine: Omit<Routine, 'id' | 'completed'>): Promise<void> {
  const res = await fetch(`${WORKER_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: routine.title,
      time: routine.time,
      is_routine: true,
      type: routine.type,
      mediaUrl: routine.mediaUrl || null,
    }),
  });
  if (!res.ok) throw new Error('Failed to create routine');
}

export async function updateRoutine(id: string, routine: Omit<Routine, 'id'>): Promise<void> {
  const res = await fetch(`${WORKER_URL}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: routine.title,
      time: routine.time,
      is_routine: true,
      completed: routine.completed,
      type: routine.type,
      mediaUrl: routine.mediaUrl || null,
    }),
  });
  if (!res.ok) throw new Error('Failed to update routine');
}

export async function setRoutineCompleted(id: string, completed: boolean): Promise<void> {
  const res = await fetch(`${WORKER_URL}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) throw new Error('Failed to update routine');
}

export async function deleteRoutine(id: string): Promise<void> {
  const res = await fetch(`${WORKER_URL}/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete routine');
}

export async function fetchHistory(): Promise<HistoryRecord> {
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
  return record;
}

export async function upsertHistory(date: string, entry: HistoryUpsert): Promise<void> {
  const res = await fetch(`${WORKER_URL}/history/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error('Failed to save history');
}
