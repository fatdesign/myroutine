export interface Routine {
  id: string;
  title: string;
  time: string;
  completed: boolean;
  type: 'morning' | 'evening';
  lastCompletedDate?: string;
  mediaUrl?: string;
}

export interface OneTimeTask {
  id: string;
  title: string;
  time: string;
  completed: boolean;
}

export interface DayHistory {
  date: string; // YYYY-MM-DD
  completedCount: number;
  totalCount: number;
  level: number; // 0-4 for GitHub style graph
  journal?: string; // Daily Grimoire entry
}

export type HistoryRecord = Record<string, DayHistory>;
