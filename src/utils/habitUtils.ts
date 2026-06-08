import type { Routine, HistoryRecord } from '../types';

export const getTodayStr = () => {
  const date = new Date();
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
};

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
    const dateStr = d.toISOString().split('T')[0];
    
    if (history[dateStr]) {
      data.push(history[dateStr].level);
    } else {
      data.push(0); // No data means level 0
    }
  }
  
  return data;
};

// Resets routines if a new day has started
export const checkAndResetRoutines = (routines: Routine[]): Routine[] => {
  const today = getTodayStr();
  let hasChanges = false;

  const updatedRoutines = routines.map(routine => {
    // If it was completed, but not today, reset it
    if (routine.completed && routine.lastCompletedDate !== today) {
      hasChanges = true;
      return { ...routine, completed: false };
    }
    return routine;
  });

  return hasChanges ? updatedRoutines : routines;
};
