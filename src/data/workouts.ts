export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  restTime: string;
  equipment: string;
  imageUrl: string;
}

export interface WorkoutDay {
  dayId: string; // "1" .. "6"
  dayName: string;
  focus: string;
  exercises: Exercise[];
}

export const WORKOUT_PLAN: WorkoutDay[] = [
  {
    dayId: '1',
    dayName: 'Montag',
    focus: 'Oberkörper (Push & Pull)',
    exercises: [
      { id: 'u1_1', name: 'Liegestütze (Push-ups)', sets: 3, reps: 15, restTime: '60s', equipment: 'Körpergewicht', imageUrl: './exercises/pushups.png' },
      { id: 'u1_2', name: 'Langhantel Rudern vorgebeugt', sets: 3, reps: 12, restTime: '60s', equipment: '23kg Langhantel', imageUrl: './exercises/barbell_rows.png' },
      { id: 'u1_3', name: 'Kurzhantel Schulterdrücken stehend', sets: 3, reps: 10, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: './exercises/dumbbell_shoulder_press.png' },
      { id: 'u1_4', name: 'Kurzhantel Floor Press', sets: 3, reps: 12, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: './exercises/dumbbell_floor_press.png' },
      { id: 'u1_5', name: 'Langhantel Bizeps Curls', sets: 3, reps: 12, restTime: '45s', equipment: '23kg Langhantel', imageUrl: './exercises/barbell_biceps_curls.png' },
      { id: 'u1_6', name: 'Kurzhantel Trizeps-Strecken über Kopf', sets: 3, reps: 12, restTime: '45s', equipment: '1x 13kg Kurzhantel', imageUrl: './exercises/dumbbell_overhead_triceps.png' }
    ]
  },
  {
    dayId: '2',
    dayName: 'Dienstag',
    focus: 'Unterkörper & Core',
    exercises: [
      { id: 'l1_1', name: 'Langhantel Front-Kniebeugen', sets: 3, reps: 12, restTime: '60s', equipment: '23kg Langhantel', imageUrl: './exercises/barbell_front_squat.png' },
      { id: 'l1_2', name: 'Kurzhantel Ausfallschritte (Lunges)', sets: 3, reps: 10, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: './exercises/dumbbell_lunges.png' },
      { id: 'l1_3', name: 'Langhantel Rumänisches Kreuzheben', sets: 3, reps: 15, restTime: '60s', equipment: '23kg Langhantel', imageUrl: './exercises/barbell_rdl.png' },
      { id: 'l1_4', name: 'Kurzhantel Wadenheben stehend', sets: 3, reps: 20, restTime: '45s', equipment: '2x 13kg Kurzhanteln', imageUrl: './exercises/dumbbell_calf_raises.png' },
      { id: 'l1_5', name: 'Plank (Unterarmstütz)', sets: 3, reps: 60, restTime: '45s', equipment: 'Körpergewicht (Sekunden)', imageUrl: './exercises/plank.png' },
      { id: 'l1_6', name: 'Leg Raises (Beinheben liegend)', sets: 3, reps: 15, restTime: '45s', equipment: 'Körpergewicht', imageUrl: './exercises/leg_raises.png' }
    ]
  },
  {
    dayId: '3',
    dayName: 'Mittwoch',
    focus: 'Oberkörper (Push & Pull)',
    exercises: [
      { id: 'u2_1', name: 'Liegestütze (Push-ups)', sets: 3, reps: 15, restTime: '60s', equipment: 'Körpergewicht', imageUrl: './exercises/pushups.png' },
      { id: 'u2_2', name: 'Langhantel Rudern vorgebeugt', sets: 3, reps: 12, restTime: '60s', equipment: '23kg Langhantel', imageUrl: './exercises/barbell_rows.png' },
      { id: 'u2_3', name: 'Kurzhantel Schulterdrücken stehend', sets: 3, reps: 10, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: './exercises/dumbbell_shoulder_press.png' },
      { id: 'u2_4', name: 'Kurzhantel Floor Press', sets: 3, reps: 12, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: './exercises/dumbbell_floor_press.png' },
      { id: 'u2_5', name: 'Langhantel Bizeps Curls', sets: 3, reps: 12, restTime: '45s', equipment: '23kg Langhantel', imageUrl: './exercises/barbell_biceps_curls.png' },
      { id: 'u2_6', name: 'Kurzhantel Trizeps-Strecken über Kopf', sets: 3, reps: 12, restTime: '45s', equipment: '1x 13kg Kurzhantel', imageUrl: './exercises/dumbbell_overhead_triceps.png' }
    ]
  },
  {
    dayId: '4',
    dayName: 'Donnerstag',
    focus: 'Unterkörper & Core',
    exercises: [
      { id: 'l2_1', name: 'Langhantel Front-Kniebeugen', sets: 3, reps: 12, restTime: '60s', equipment: '23kg Langhantel', imageUrl: './exercises/barbell_front_squat.png' },
      { id: 'l2_2', name: 'Kurzhantel Ausfallschritte (Lunges)', sets: 3, reps: 10, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: './exercises/dumbbell_lunges.png' },
      { id: 'l2_3', name: 'Langhantel Rumänisches Kreuzheben', sets: 3, reps: 15, restTime: '60s', equipment: '23kg Langhantel', imageUrl: './exercises/barbell_rdl.png' },
      { id: 'l2_4', name: 'Kurzhantel Wadenheben stehend', sets: 3, reps: 20, restTime: '45s', equipment: '2x 13kg Kurzhanteln', imageUrl: './exercises/dumbbell_calf_raises.png' },
      { id: 'l2_5', name: 'Plank (Unterarmstütz)', sets: 3, reps: 60, restTime: '45s', equipment: 'Körpergewicht (Sekunden)', imageUrl: './exercises/plank.png' },
      { id: 'l2_6', name: 'Leg Raises (Beinheben liegend)', sets: 3, reps: 15, restTime: '45s', equipment: 'Körpergewicht', imageUrl: './exercises/leg_raises.png' }
    ]
  },
  {
    dayId: '5',
    dayName: 'Freitag',
    focus: 'Oberkörper (Push & Pull)',
    exercises: [
      { id: 'u3_1', name: 'Liegestütze (Push-ups)', sets: 3, reps: 15, restTime: '60s', equipment: 'Körpergewicht', imageUrl: './exercises/pushups.png' },
      { id: 'u3_2', name: 'Langhantel Rudern vorgebeugt', sets: 3, reps: 12, restTime: '60s', equipment: '23kg Langhantel', imageUrl: './exercises/barbell_rows.png' },
      { id: 'u3_3', name: 'Kurzhantel Schulterdrücken stehend', sets: 3, reps: 10, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: './exercises/dumbbell_shoulder_press.png' },
      { id: 'u3_4', name: 'Kurzhantel Floor Press', sets: 3, reps: 12, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: './exercises/dumbbell_floor_press.png' },
      { id: 'u3_5', name: 'Langhantel Bizeps Curls', sets: 3, reps: 12, restTime: '45s', equipment: '23kg Langhantel', imageUrl: './exercises/barbell_biceps_curls.png' },
      { id: 'u3_6', name: 'Kurzhantel Trizeps-Strecken über Kopf', sets: 3, reps: 12, restTime: '45s', equipment: '1x 13kg Kurzhantel', imageUrl: './exercises/dumbbell_overhead_triceps.png' }
    ]
  },
  {
    dayId: '6',
    dayName: 'Samstag',
    focus: 'Unterkörper & Core',
    exercises: [
      { id: 'l3_1', name: 'Langhantel Front-Kniebeugen', sets: 3, reps: 12, restTime: '60s', equipment: '23kg Langhantel', imageUrl: './exercises/barbell_front_squat.png' },
      { id: 'l3_2', name: 'Kurzhantel Ausfallschritte (Lunges)', sets: 3, reps: 10, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: './exercises/dumbbell_lunges.png' },
      { id: 'l3_3', name: 'Langhantel Rumänisches Kreuzheben', sets: 3, reps: 15, restTime: '60s', equipment: '23kg Langhantel', imageUrl: './exercises/barbell_rdl.png' },
      { id: 'l3_4', name: 'Kurzhantel Wadenheben stehend', sets: 3, reps: 20, restTime: '45s', equipment: '2x 13kg Kurzhanteln', imageUrl: './exercises/dumbbell_calf_raises.png' },
      { id: 'l3_5', name: 'Plank (Unterarmstütz)', sets: 3, reps: 60, restTime: '45s', equipment: 'Körpergewicht (Sekunden)', imageUrl: './exercises/plank.png' },
      { id: 'l3_6', name: 'Leg Raises (Beinheben liegend)', sets: 3, reps: 15, restTime: '45s', equipment: 'Körpergewicht', imageUrl: './exercises/leg_raises.png' }
    ]
  }
];
