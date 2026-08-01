export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  restTime: string; // z.B. "30s"
  imageUrl: string;
}

export interface WorkoutDay {
  dayId: string; // "1" für Montag, "2" für Dienstag, etc.
  dayName: string;
  focus: string;
  exercises: Exercise[];
}

export const WORKOUT_PLAN: WorkoutDay[] = [
  {
    dayId: '1',
    dayName: 'Montag',
    focus: 'Brust',
    exercises: [
      { id: 'm1', name: 'Barbell Bench Press with Band Suspended Kettlebell', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/4414.png' },
      { id: 'm2', name: 'Seated Decline Chest Press on a Chair', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/8620.png' },
      { id: 'm3', name: 'Dumbbell Fly (knees at 90 degrees)', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/3175.png' },
      { id: 'm4', name: 'Dumbbell Rotational Grip Bench Press', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/4835.png' },
      { id: 'm5', name: 'Dumbbell One Arm Press (on stability ball)', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/0357.png' }
    ]
  },
  {
    dayId: '2',
    dayName: 'Dienstag',
    focus: 'Rücken',
    exercises: [
      { id: 'tu1', name: 'Top Pull-up Hold', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/4983.png' },
      { id: 'tu2', name: 'Barbell Pullover', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/0073.png' },
      { id: 'tu3', name: 'Inverted Shrug', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/4049.png' },
      { id: 'tu4', name: 'Lying Prone T', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/5041.png' },
      { id: 'tu5', name: 'Dumbbell Lying Row on Rack', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/5697.png' }
    ]
  },
  {
    dayId: '3',
    dayName: 'Mittwoch',
    focus: 'Beine & Po',
    exercises: [
      { id: 'w1', name: 'Barbell Olympic Squat', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/1527.png' },
      { id: 'w2', name: 'Barbell Bench Squat', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/0026.png' },
      { id: 'w3', name: 'Side Squat', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/4789.png' },
      { id: 'w4', name: 'Lying Single Straight Leg Hip Extension', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/1776.png' },
      { id: 'w5', name: 'Dumbbell Stiff Leg Deadlift', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/3340.png' },
      { id: 'w6', name: 'Barbell Hook grip Deadlift', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/7237.png' },
      { id: 'w7', name: 'Alternate Leg Raise', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/4826.png' }
    ]
  },
  {
    dayId: '4',
    dayName: 'Donnerstag',
    focus: 'Schultern',
    exercises: [
      { id: 'th1', name: 'Dumbbell Incline Front Raise with Chest Support', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/3980.png' },
      { id: 'th2', name: 'Dumbbell Alternate Shoulder Press', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/3972.png' },
      { id: 'th3', name: 'Dumbbell Arnold Press', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/0287.png' },
      { id: 'th4', name: 'Barbell Standing Front Raise Over Head', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/0107.png' },
      { id: 'th5', name: 'Dumbbell Standing Lateral Raise', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/2234.png' }
    ]
  },
  {
    dayId: '5',
    dayName: 'Freitag',
    focus: 'Bizeps & Trizeps',
    exercises: [
      { id: 'f1', name: 'Cross Arms Push up', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/3784.png' },
      { id: 'f2', name: 'Dumbbell Lying One Arm Pronated Triceps Extension', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/0344.png' },
      { id: 'f3', name: 'Dumbbell Alternate Hammer Strict Curl', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/6147.png' },
      { id: 'f4', name: 'Dumbbell Reverse Spider Curl', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/1675.png' },
      { id: 'f5', name: 'Dumbbell One Arm Kickback', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/0354.png' },
      { id: 'f6', name: 'Overhead Triceps Extension with Bed Sheet', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/3745.png' },
      { id: 'f7', name: 'Dumbbell Biceps Curl (with arm blaster)', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/2401.png' }
    ]
  },
  {
    dayId: '6',
    dayName: 'Samstag',
    focus: 'Taille & Waden',
    exercises: [
      { id: 'sa1', name: 'Dumbbell Military Press Russian Twist with Legs Floor Off', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/6806.png' },
      { id: 'sa2', name: 'Dumbbell Side Plank with Rear Fly', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/3664.png' },
      { id: 'sa3', name: 'Half Sit-up', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/3202.png' },
      { id: 'sa4', name: 'Lying Leg Raise', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/1163.png' },
      { id: 'sa5', name: 'Dumbbell Seated One Leg Calf Raise - Hammer Grip', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/1380.png' },
      { id: 'sa6', name: 'Exercise Ball on the Wall Calf Raise', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/1382.png' },
      { id: 'sa7', name: 'Standing Single Leg Calf Raise with Support', sets: 3, reps: 8, restTime: '30s', imageUrl: 'https://exercises.loadmuscle.com/thumbnails/3712.png' }
    ]
  }
];
