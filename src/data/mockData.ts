import type { Routine } from '../types';

export const initialRoutines: Routine[] = [
  { id: '1', title: 'Drink 500ml Water', time: '07:00', completed: false, type: 'morning' },
  { id: '2', title: 'Meditation (10 min)', time: '07:10', completed: false, type: 'morning' },
  { id: '3', title: 'Journaling', time: '21:00', completed: false, type: 'evening' },
  { id: '4', title: 'Plan tomorrow', time: '21:30', completed: false, type: 'evening' },
];
