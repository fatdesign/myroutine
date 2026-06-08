export interface Routine {
  id: string;
  title: string;
  time: string;
  completed: boolean;
  type: 'morning' | 'evening';
}

export const initialRoutines: Routine[] = [
  { id: '1', title: 'Drink 500ml Water', time: '07:00 AM', completed: true, type: 'morning' },
  { id: '2', title: 'Meditation (10 min)', time: '07:10 AM', completed: false, type: 'morning' },
  { id: '3', title: 'Read 10 pages', time: '07:30 AM', completed: false, type: 'morning' },
  { id: '4', title: 'Review Daily Goals', time: '08:00 AM', completed: false, type: 'morning' },
  { id: '5', title: 'Journaling', time: '09:00 PM', completed: false, type: 'evening' },
  { id: '6', title: 'Plan tomorrow', time: '09:30 PM', completed: false, type: 'evening' },
];

export const generateHabitData = () => {
  const data = [];
  for (let i = 0; i < 90; i++) {
    // Random level 0-4
    data.push(Math.floor(Math.random() * 5));
  }
  return data;
};
