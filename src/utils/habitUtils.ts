import type { HistoryRecord } from '../types';

// The worker stamps dates in Europe/Berlin (see worker/worker.js); the client must
// agree on "today" or routine resets / history entries land on the wrong date.
export const getDateStr = (date: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(date);

export const getTodayStr = () => getDateStr(new Date());

export const calculateLevel = (completed: number, total: number): number => {
  if (total === 0) return 0;
  const ratio = completed / total;
  if (ratio === 0) return 0;
  if (ratio < 0.33) return 1;
  if (ratio < 0.66) return 2;
  if (ratio < 1) return 3;
  return 4; // 100% completed
};

// Generates an array of levels for the last 90 days for the graph
export const getHistoryGraphData = (history: HistoryRecord, days = 90): number[] => {
  const data: number[] = [];
  const today = new Date();
  
  // Go back `days` days
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = getDateStr(d);

    if (history[dateStr]) {
      data.push(history[dateStr].level);
    } else {
      data.push(0); // No data means level 0
    }
  }
  
  return data;
};

export const checkIsGridBroken = (history: HistoryRecord): boolean => {
  const dates = Object.keys(history).sort();
  if (dates.length === 0) return false;
  
  const today = new Date();
  const todayStr = getDateStr(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getDateStr(yesterday);

  const pastDates = dates.filter(d => d < todayStr);
  if (pastDates.length === 0) return false;
  
  const lastActiveDate = pastDates[pastDates.length - 1];
  
  // Missed yesterday completely
  if (lastActiveDate < yesterdayStr) return true;
  
  // Yesterday had 0 completed routines
  if (lastActiveDate === yesterdayStr && history[yesterdayStr].completedCount === 0) return true;

  return false;
};
