import { useState, useEffect } from 'react';
import { WORKOUT_PLAN } from '../data/workouts';
import { getTodayStr } from '../utils/habitUtils';
import { Check, Dumbbell, Timer, Flame } from 'lucide-react';

export function WorkoutDashboard() {
  const [selectedDay, setSelectedDay] = useState<string>('1');
  // Record<exerciseId, number of completed sets>
  const [completedSets, setCompletedSets] = useState<Record<string, number>>({});
  const todayStr = getTodayStr();

  useEffect(() => {
    // Set default tab to current weekday
    const jsDay = new Date().getDay(); // 0 = Sunday, 1 = Monday
    const currentDayStr = jsDay === 0 ? '7' : String(jsDay);
    
    // Only select it if we have a workout for it, otherwise keep '1' (or whatever default)
    if (WORKOUT_PLAN.find(d => d.dayId === currentDayStr)) {
      setSelectedDay(currentDayStr);
    } else {
      setSelectedDay('1'); // fallback to Monday if Sunday has no workout
    }

    // Load today's progress
    const saved = localStorage.getItem(`myroutine_workout_${todayStr}`);
    if (saved) {
      setCompletedSets(JSON.parse(saved));
    }
  }, [todayStr]);

  const toggleSet = (exerciseId: string, setIndex: number) => {
    setCompletedSets(prev => {
      const currentCount = prev[exerciseId] || 0;
      // If clicking the next available set, we check it.
      // If clicking a checked set, we uncheck it.
      // Simplest UX: We just track the absolute number of completed sets for simplicity, 
      // but if the user clicks a specific box, we can set the count exactly.
      // Actually, let's treat the checkboxes as a sequence: if clicking box 2, and count is 2, it becomes 1 (uncheck).
      // If clicking box 2 and count is 1, it becomes 2.
      let newCount = currentCount;
      if (setIndex < currentCount) {
        newCount = setIndex; // uncheck this and subsequent
      } else if (setIndex === currentCount) {
        newCount = setIndex + 1; // check this one
      } else {
        newCount = setIndex + 1; // check all up to this one
      }

      const next = { ...prev, [exerciseId]: newCount };
      localStorage.setItem(`myroutine_workout_${todayStr}`, JSON.stringify(next));
      return next;
    });
  };

  const activeWorkout = WORKOUT_PLAN.find(d => d.dayId === selectedDay);

  return (
    <div className="workout-dashboard">
      {/* Day Selector */}
      <div className="day-picker" style={{ marginBottom: '24px', flexWrap: 'wrap' }}>
        {WORKOUT_PLAN.map(day => (
          <button
            key={day.dayId}
            className={`day-btn ${selectedDay === day.dayId ? 'active' : ''}`}
            onClick={() => setSelectedDay(day.dayId)}
            style={{ padding: '8px 16px', minWidth: '100px', display: 'flex', flexDirection: 'column', gap: '4px' }}
          >
            <span>{day.dayName}</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{day.focus}</span>
          </button>
        ))}
      </div>

      {activeWorkout ? (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--heroui-violet-light)', marginBottom: '8px' }}>
            <Dumbbell size={24} />
            {activeWorkout.dayName} Workout
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Fokus: {activeWorkout.focus}</p>

          <div className="workout-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activeWorkout.exercises.map((ex, idx) => {
              const completed = completedSets[ex.id] || 0;
              const isAllDone = completed === ex.sets;

              return (
                <div 
                  key={ex.id} 
                  className={`routine-item ${isAllDone ? 'completed' : ''}`}
                  style={{ 
                    padding: '16px', 
                    display: 'flex', 
                    gap: '16px', 
                    alignItems: 'center',
                    cursor: 'default',
                    height: 'auto'
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{ width: '80px', height: '80px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <img src={ex.imageUrl} alt={ex.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} loading="lazy" />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: isAllDone ? 'rgba(255,255,255,0.5)' : '#fff' }}>
                      {idx + 1}. {ex.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span className="badge-pill time" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Flame size={12} /> {ex.sets} Sets × {ex.reps} Reps
                      </span>
                      <span className="badge-pill days" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Timer size={12} /> {ex.restTime} Pause
                      </span>
                    </div>
                  </div>

                  {/* Tracking Checks */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {Array.from({ length: ex.sets }).map((_, setIdx) => {
                      const isChecked = setIdx < completed;
                      return (
                        <div 
                          key={setIdx}
                          onClick={() => toggleSet(ex.id, setIdx)}
                          className="checkbox"
                          style={{ 
                            width: '24px', 
                            height: '24px', 
                            cursor: 'pointer',
                            borderColor: isChecked ? 'var(--heroui-violet)' : 'var(--border-light)'
                          }}
                        >
                          {isChecked && <Check size={14} className="check-icon" color="#ffffff" strokeWidth={3} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'var(--text-muted)' }}>Kein Workout für diesen Tag geplant. Erhole dich gut!</p>
        </div>
      )}
    </div>
  );
}
