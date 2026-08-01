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
      { id: 'u1_1', name: 'Liegestütze (Push-ups)', sets: 3, reps: 15, restTime: '60s', equipment: 'Körpergewicht', imageUrl: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=300&q=80' },
      { id: 'u1_2', name: 'Langhantel Rudern vorgebeugt', sets: 3, reps: 12, restTime: '60s', equipment: '23kg Langhantel', imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=300&q=80' },
      { id: 'u1_3', name: 'Kurzhantel Schulterdrücken stehend', sets: 3, reps: 10, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=300&q=80' },
      { id: 'u1_4', name: 'Kurzhantel Floor Press', sets: 3, reps: 12, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=300&q=80' },
      { id: 'u1_5', name: 'Langhantel Bizeps Curls', sets: 3, reps: 12, restTime: '45s', equipment: '23kg Langhantel', imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=300&q=80' },
      { id: 'u1_6', name: 'Kurzhantel Trizeps-Strecken über Kopf', sets: 3, reps: 12, restTime: '45s', equipment: '1x 13kg Kurzhantel', imageUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=300&q=80' }
    ]
  },
  {
    dayId: '2',
    dayName: 'Dienstag',
    focus: 'Unterkörper & Core',
    exercises: [
      { id: 'l1_1', name: 'Langhantel Front-Kniebeugen', sets: 3, reps: 12, restTime: '60s', equipment: '23kg Langhantel', imageUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=300&q=80' },
      { id: 'l1_2', name: 'Kurzhantel Ausfallschritte (Lunges)', sets: 3, reps: 10, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?auto=format&fit=crop&w=300&q=80' },
      { id: 'l1_3', name: 'Langhantel Rumänisches Kreuzheben', sets: 3, reps: 15, restTime: '60s', equipment: '23kg Langhantel', imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=300&q=80' },
      { id: 'l1_4', name: 'Kurzhantel Wadenheben stehend', sets: 3, reps: 20, restTime: '45s', equipment: '2x 13kg Kurzhanteln', imageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=300&q=80' },
      { id: 'l1_5', name: 'Plank (Unterarmstütz)', sets: 3, reps: 60, restTime: '45s', equipment: 'Körpergewicht (Sekunden)', imageUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=300&q=80' },
      { id: 'l1_6', name: 'Leg Raises (Beinheben liegend)', sets: 3, reps: 15, restTime: '45s', equipment: 'Körpergewicht', imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=300&q=80' }
    ]
  },
  {
    dayId: '3',
    dayName: 'Mittwoch',
    focus: 'Oberkörper (Push & Pull)',
    exercises: [
      { id: 'u2_1', name: 'Liegestütze (Push-ups)', sets: 3, reps: 15, restTime: '60s', equipment: 'Körpergewicht', imageUrl: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=300&q=80' },
      { id: 'u2_2', name: 'Langhantel Rudern vorgebeugt', sets: 3, reps: 12, restTime: '60s', equipment: '23kg Langhantel', imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=300&q=80' },
      { id: 'u2_3', name: 'Kurzhantel Schulterdrücken stehend', sets: 3, reps: 10, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=300&q=80' },
      { id: 'u2_4', name: 'Kurzhantel Floor Press', sets: 3, reps: 12, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=300&q=80' },
      { id: 'u2_5', name: 'Langhantel Bizeps Curls', sets: 3, reps: 12, restTime: '45s', equipment: '23kg Langhantel', imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=300&q=80' },
      { id: 'u2_6', name: 'Kurzhantel Trizeps-Strecken über Kopf', sets: 3, reps: 12, restTime: '45s', equipment: '1x 13kg Kurzhantel', imageUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=300&q=80' }
    ]
  },
  {
    dayId: '4',
    dayName: 'Donnerstag',
    focus: 'Unterkörper & Core',
    exercises: [
      { id: 'l2_1', name: 'Langhantel Front-Kniebeugen', sets: 3, reps: 12, restTime: '60s', equipment: '23kg Langhantel', imageUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=300&q=80' },
      { id: 'l2_2', name: 'Kurzhantel Ausfallschritte (Lunges)', sets: 3, reps: 10, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?auto=format&fit=crop&w=300&q=80' },
      { id: 'l2_3', name: 'Langhantel Rumänisches Kreuzheben', sets: 3, reps: 15, restTime: '60s', equipment: '23kg Langhantel', imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=300&q=80' },
      { id: 'l2_4', name: 'Kurzhantel Wadenheben stehend', sets: 3, reps: 20, restTime: '45s', equipment: '2x 13kg Kurzhanteln', imageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=300&q=80' },
      { id: 'l2_5', name: 'Plank (Unterarmstütz)', sets: 3, reps: 60, restTime: '45s', equipment: 'Körpergewicht (Sekunden)', imageUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=300&q=80' },
      { id: 'l2_6', name: 'Leg Raises (Beinheben liegend)', sets: 3, reps: 15, restTime: '45s', equipment: 'Körpergewicht', imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=300&q=80' }
    ]
  },
  {
    dayId: '5',
    dayName: 'Freitag',
    focus: 'Oberkörper (Push & Pull)',
    exercises: [
      { id: 'u3_1', name: 'Liegestütze (Push-ups)', sets: 3, reps: 15, restTime: '60s', equipment: 'Körpergewicht', imageUrl: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=300&q=80' },
      { id: 'u3_2', name: 'Langhantel Rudern vorgebeugt', sets: 3, reps: 12, restTime: '60s', equipment: '23kg Langhantel', imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=300&q=80' },
      { id: 'u3_3', name: 'Kurzhantel Schulterdrücken stehend', sets: 3, reps: 10, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=300&q=80' },
      { id: 'u3_4', name: 'Kurzhantel Floor Press', sets: 3, reps: 12, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=300&q=80' },
      { id: 'u3_5', name: 'Langhantel Bizeps Curls', sets: 3, reps: 12, restTime: '45s', equipment: '23kg Langhantel', imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=300&q=80' },
      { id: 'u3_6', name: 'Kurzhantel Trizeps-Strecken über Kopf', sets: 3, reps: 12, restTime: '45s', equipment: '1x 13kg Kurzhantel', imageUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=300&q=80' }
    ]
  },
  {
    dayId: '6',
    dayName: 'Samstag',
    focus: 'Unterkörper & Core',
    exercises: [
      { id: 'l3_1', name: 'Langhantel Front-Kniebeugen', sets: 3, reps: 12, restTime: '60s', equipment: '23kg Langhantel', imageUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=300&q=80' },
      { id: 'l3_2', name: 'Kurzhantel Ausfallschritte (Lunges)', sets: 3, reps: 10, restTime: '60s', equipment: '2x 13kg Kurzhanteln', imageUrl: 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?auto=format&fit=crop&w=300&q=80' },
      { id: 'l3_3', name: 'Langhantel Rumänisches Kreuzheben', sets: 3, reps: 15, restTime: '60s', equipment: '23kg Langhantel', imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=300&q=80' },
      { id: 'l3_4', name: 'Kurzhantel Wadenheben stehend', sets: 3, reps: 20, restTime: '45s', equipment: '2x 13kg Kurzhanteln', imageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=300&q=80' },
      { id: 'l3_5', name: 'Plank (Unterarmstütz)', sets: 3, reps: 60, restTime: '45s', equipment: 'Körpergewicht (Sekunden)', imageUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=300&q=80' },
      { id: 'l3_6', name: 'Leg Raises (Beinheben liegend)', sets: 3, reps: 15, restTime: '45s', equipment: 'Körpergewicht', imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=300&q=80' }
    ]
  }
];
