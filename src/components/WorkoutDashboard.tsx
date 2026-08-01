import { useState, useEffect } from 'react';
import { WORKOUT_PLAN } from '../data/workouts';
import { getTodayStr, getDateStr } from '../utils/habitUtils';
import { fetchWorkoutHistory, upsertWorkoutHistory, fetchWorkoutSessions, upsertWorkoutSession, uploadImage } from '../services/plannerApi';
import type { WorkoutHistoryRecord, WorkoutSessionRecord, WorkoutSession } from '../types';
import { Check, Dumbbell, Timer, Flame, CalendarDays, Activity, Play, StopCircle, Upload, Weight, Camera, X, Save } from 'lucide-react';

export function WorkoutDashboard() {
  const [viewMode, setViewMode] = useState<'today' | 'calendar'>('today');
  const [selectedDay, setSelectedDay] = useState<string>('1');
  const [history, setHistory] = useState<WorkoutHistoryRecord>({});
  const [sessions, setSessions] = useState<WorkoutSessionRecord>({});
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Vision / Motivations-Ziel Photo State
  const [visionImageUrl, setVisionImageUrl] = useState<string | null>(() => {
    return localStorage.getItem('myroutine_vision_image') || null;
  });
  const [isUploadingVision, setIsUploadingVision] = useState(false);

  const handleVisionPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingVision(true);
    try {
      const url = await uploadImage(file);
      if (url) {
        setVisionImageUrl(url);
        localStorage.setItem('myroutine_vision_image', url);
      }
    } catch (err) {
      console.error("Vision upload error:", err);
    } finally {
      setIsUploadingVision(false);
    }
  };

  // Session & Timer State
  const [isPreModalOpen, setIsPreModalOpen] = useState(false);
  const [bodyWeightInput, setBodyWeightInput] = useState<string>('');
  const [bodyFatInput, setBodyFatInput] = useState<string>('');
  const [showKfaCalc, setShowKfaCalc] = useState(false);
  const [modalCalcHeight, setModalCalcHeight] = useState<string>('');
  const [modalCalcNeck, setModalCalcNeck] = useState<string>('');
  const [modalCalcWaist, setModalCalcWaist] = useState<string>('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const calculateNavyKfa = () => {
    const h = parseFloat(modalCalcHeight);
    const n = parseFloat(modalCalcNeck);
    const w = parseFloat(modalCalcWaist);
    if (h > 0 && n > 0 && w > n) {
      const density = 1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h);
      const kfa = (495 / density) - 450;
      if (kfa > 2 && kfa < 50) {
        setBodyFatInput(kfa.toFixed(1));
        setShowKfaCalc(false);
      }
    }
  };

  // Body Fat Calculator Card State
  const [isCalcCardOpen, setIsCalcCardOpen] = useState<boolean>(true);
  const [calcGender, setCalcGender] = useState<'male' | 'female'>('male');
  const [calcAge, setCalcAge] = useState<number>(27);
  const [calcWeight, setCalcWeight] = useState<number>(90);
  const [calcHeight, setCalcHeight] = useState<number>(186);
  const [calcNeck, setCalcNeck] = useState<number>(44);
  const [calcWaist, setCalcWaist] = useState<number>(100);
  const [calcHip, setCalcHip] = useState<number>(100);
  const [calcTargetKfa, setCalcTargetKfa] = useState<number>(7.0);
  const [activityLevel, setActivityLevel] = useState<number>(1.55); // 1.55 = 3-5 Workouts/Woche
  const [targetDeficitMode, setTargetDeficitMode] = useState<number>(500); // 500 kcal Defizit/Tag

  const calculateBodyFatMetrics = () => {
    let navyKfa = 0;
    if (calcGender === 'male') {
      if (calcWaist > calcNeck && calcHeight > 0) {
        const density = 1.0324 - 0.19077 * Math.log10(calcWaist - calcNeck) + 0.15456 * Math.log10(calcHeight);
        navyKfa = (495 / density) - 450;
      }
    } else {
      if (calcWaist + calcHip > calcNeck && calcHeight > 0) {
        const density = 1.29579 - 0.35004 * Math.log10(calcWaist + calcHip - calcNeck) + 0.22100 * Math.log10(calcHeight);
        navyKfa = (495 / density) - 450;
      }
    }
    
    if (navyKfa < 2) navyKfa = 2;
    if (navyKfa > 50) navyKfa = 50;

    const fatMass = calcWeight * (navyKfa / 100);
    const leanMass = calcWeight - fatMass;

    // BMI method
    const bmi = calcWeight / Math.pow(calcHeight / 100, 2);
    const bmiKfa = 1.20 * bmi + 0.23 * calcAge - (calcGender === 'male' ? 16.2 : 5.4);

    // Target fat loss to reach target KFA
    const targetFatMass = calcWeight * (calcTargetKfa / 100);
    const fatToLose = Math.max(0, fatMass - targetFatMass);

    // BMR (Katch-McArdle using Lean Mass)
    const bmr = 370 + (21.6 * leanMass);
    const tdee = bmr * activityLevel;
    const targetCalories = Math.max(1200, Math.round(tdee - targetDeficitMode));

    // Fat Loss Physics (7700 kcal = 1 kg fat)
    const totalFatKcalToLose = fatToLose * 7700;
    const daysToTarget = targetDeficitMode > 0 ? Math.ceil(totalFatKcalToLose / targetDeficitMode) : 0;
    const weeksToTarget = (daysToTarget / 7).toFixed(1);
    const fatLossPerWeek = ((targetDeficitMode * 7) / 7700).toFixed(2);

    // Optimal V-Shape Macros
    const proteinGrams = Math.round(2.2 * leanMass);
    const fatGrams = Math.round(0.8 * calcWeight);
    const carbsKcal = Math.max(0, targetCalories - (proteinGrams * 4) - (fatGrams * 9));
    const carbsGrams = Math.round(carbsKcal / 4);

    // Category determination
    let category = 'Fitness';
    let categoryColor = '#06b6d4';
    if (navyKfa < 6) { category = 'Essentiell'; categoryColor = '#eab308'; }
    else if (navyKfa < 14) { category = 'Athlet (V-Shape Zone)'; categoryColor = '#22c55e'; }
    else if (navyKfa < 18) { category = 'Fitness'; categoryColor = '#06b6d4'; }
    else if (navyKfa < 25) { category = 'Durchschnitt'; categoryColor = '#f97316'; }
    else { category = 'Höherer KFA'; categoryColor = '#ef4444'; }

    return {
      kfa: Number(navyKfa.toFixed(1)),
      fatMass: Number(fatMass.toFixed(1)),
      leanMass: Number(leanMass.toFixed(1)),
      bmiKfa: Number(bmiKfa.toFixed(1)),
      fatToLose: Number(fatToLose.toFixed(1)),
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      targetCalories,
      daysToTarget,
      weeksToTarget,
      fatLossPerWeek,
      proteinGrams,
      fatGrams,
      carbsGrams,
      category,
      categoryColor
    };
  };

  const handleApplyCalcToToday = async () => {
    const metrics = calculateBodyFatMetrics();
    const sessionData: Partial<WorkoutSession> = {
      bodyWeight: calcWeight,
      bodyFat: metrics.kfa
    };

    setSessions(prev => ({
      ...prev,
      [todayStr]: { ...prev[todayStr], ...sessionData, date: todayStr, durationSeconds: prev[todayStr]?.durationSeconds || 0 }
    }));

    await upsertWorkoutSession(todayStr, sessionData);
    alert(`Übernommen! Gewicht: ${calcWeight} kg, KFA: ${metrics.kfa}% in heutigem Check-in gesichert.`);
  };

  const todayStr = getTodayStr();

  // Active Rest Timer State (Pause per Exercise)
  const [activeRestTimer, setActiveRestTimer] = useState<{ exerciseId: string; exerciseName: string; secondsLeft: number; totalSeconds: number } | null>(null);

  const playBeepSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      [0, 0.15, 0.3].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = idx === 2 ? 880 : 587.33; // D5 -> A5 tone
        gain.gain.setValueAtTime(0.55, now + delay); // +50-80% lauter & deutlicher im Gym
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.12);
      });
    } catch (e) {
      console.warn("Audio beep failed:", e);
    }
  };

  // Rest Timer Interval Countdown
  useEffect(() => {
    if (!activeRestTimer) return;

    const interval = setInterval(() => {
      setActiveRestTimer(prev => {
        if (!prev) return null;
        if (prev.secondsLeft <= 1) {
          playBeepSound();
          return null;
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeRestTimer?.exerciseId, activeRestTimer?.secondsLeft]);

  // Active Plank Hold Timer State
  const [activePlankTimer, setActivePlankTimer] = useState<{ exerciseId: string; secondsLeft: number; targetReps: number } | null>(null);

  // Plank Timer Interval
  useEffect(() => {
    if (!activePlankTimer) return;

    const interval = setInterval(() => {
      setActivePlankTimer(prev => {
        if (!prev) return null;
        if (prev.secondsLeft <= 1) {
          playBeepSound();
          // Automatically check set off when plank completes & trigger rest timer!
          setHistory(currentHistory => {
            const dayHist = currentHistory[todayStr] || {};
            const currentCount = dayHist[prev.exerciseId] || 0;
            const allEx = WORKOUT_PLAN.flatMap(d => d.exercises);
            const exercise = allEx.find(e => e.id === prev.exerciseId);
            if (exercise && currentCount < exercise.sets) {
              const newCount = currentCount + 1;
              const nextDaySets = { ...dayHist, [prev.exerciseId]: newCount };
              upsertWorkoutHistory(todayStr, nextDaySets);
              
              // Trigger Rest Timer
              const secs = parseInt(exercise.restTime.replace('s', '')) || 45;
              setActiveRestTimer({
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                secondsLeft: secs,
                totalSeconds: secs
              });

              return {
                ...currentHistory,
                [todayStr]: nextDaySets
              };
            }
            return currentHistory;
          });
          return null;
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activePlankTimer?.exerciseId, activePlankTimer?.secondsLeft, todayStr]);

  const startPlankTimer = (exerciseId: string, holdSeconds: number) => {
    setActivePlankTimer({
      exerciseId,
      secondsLeft: holdSeconds,
      targetReps: holdSeconds
    });
  };

  // Timer State
  const [isTimerActive, setIsTimerActive] = useState<boolean>(() => {
    return localStorage.getItem('myroutine_timer_active') === 'true';
  });
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(() => {
    const saved = localStorage.getItem('myroutine_timer_start');
    return saved ? Number(saved) : null;
  });
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Load History & Sessions
  useEffect(() => {
    const jsDay = new Date().getDay();
    const currentDayStr = jsDay === 0 ? '7' : String(jsDay);
    if (WORKOUT_PLAN.find(d => d.dayId === currentDayStr)) {
      setSelectedDay(currentDayStr);
    } else {
      setSelectedDay('1');
    }

    Promise.all([fetchWorkoutHistory(), fetchWorkoutSessions()]).then(([histData, sessData]) => {
      setHistory(histData);
      setSessions(sessData);
      if (sessData[todayStr]?.bodyWeight) {
        setBodyWeightInput(String(sessData[todayStr].bodyWeight));
      }
    });
  }, [todayStr]);

  // Live Timer Interval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isTimerActive && timerStartTimestamp) {
      interval = setInterval(() => {
        const secs = Math.floor((Date.now() - timerStartTimestamp) / 1000);
        setElapsedSeconds(secs);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timerStartTimestamp]);

  const completedSets = history[todayStr] || {};

  const toggleSet = (exerciseId: string, setIndex: number) => {
    const currentCount = completedSets[exerciseId] || 0;
    let newCount = currentCount;
    if (setIndex < currentCount) {
      newCount = setIndex;
    } else if (setIndex === currentCount) {
      newCount = setIndex + 1;
    } else {
      newCount = setIndex + 1;
    }

    const nextDaySets = { ...completedSets, [exerciseId]: newCount };
    
    setHistory(prev => ({
      ...prev,
      [todayStr]: nextDaySets
    }));

    upsertWorkoutHistory(todayStr, nextDaySets);

    // Trigger Rest Timer if a set was completed
    if (newCount > currentCount) {
      const exercise = allExercises.find(e => e.id === exerciseId);
      if (exercise) {
        const secs = parseInt(exercise.restTime.replace('s', '')) || 45;
        setActiveRestTimer({
          exerciseId,
          exerciseName: exercise.name,
          secondsLeft: secs,
          totalSeconds: secs
        });
      }
    }
  };

  const handleStartWorkoutClick = () => {
    setIsPreModalOpen(true);
  };

  const handleConfirmStartWorkout = async () => {
    setIsUploading(true);
    let uploadedPhotoUrl = sessions[todayStr]?.photoUrl || undefined;

    if (photoFile) {
      uploadedPhotoUrl = await uploadImage(photoFile);
    }

    const weightNum = bodyWeightInput ? parseFloat(bodyWeightInput) : undefined;
    const fatNum = bodyFatInput ? parseFloat(bodyFatInput) : undefined;
    const now = Date.now();

    setIsTimerActive(true);
    setTimerStartTimestamp(now);
    localStorage.setItem('myroutine_timer_active', 'true');
    localStorage.setItem('myroutine_timer_start', String(now));

    // Save initial session info
    const sessionData: Partial<WorkoutSession> = {
      bodyWeight: weightNum,
      bodyFat: fatNum,
      photoUrl: uploadedPhotoUrl,
    };

    setSessions(prev => ({
      ...prev,
      [todayStr]: { ...prev[todayStr], ...sessionData, date: todayStr, durationSeconds: prev[todayStr]?.durationSeconds || 0 }
    }));

    await upsertWorkoutSession(todayStr, sessionData);

    setIsUploading(false);
    setIsPreModalOpen(false);
  };

  const handleFinishWorkout = async () => {
    if (!timerStartTimestamp) return;

    const totalDuration = Math.floor((Date.now() - timerStartTimestamp) / 1000);
    
    setIsTimerActive(false);
    setTimerStartTimestamp(null);
    localStorage.removeItem('myroutine_timer_active');
    localStorage.removeItem('myroutine_timer_start');

    const updatedSession: Partial<WorkoutSession> = {
      durationSeconds: (sessions[todayStr]?.durationSeconds || 0) + totalDuration,
    };

    setSessions(prev => ({
      ...prev,
      [todayStr]: { ...prev[todayStr], ...updatedSession, date: todayStr }
    }));

    await upsertWorkoutSession(todayStr, updatedSession);
    alert(`Workout abgeschlossen! Zeit: ${formatTime(totalDuration)}`);
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const activeWorkout = WORKOUT_PLAN.find(d => d.dayId === selectedDay);
  const allExercises = WORKOUT_PLAN.flatMap(d => d.exercises);

  const renderCalendar = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;

    const days = [];
    for (let i = 0; i < startOffset; i++) {
      days.push(<div key={`empty-${i}`} style={{ opacity: 0 }} className="calendar-day" />);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = getDateStr(d);
      const dayHistory = history[dateStr];
      const daySession = sessions[dateStr];
      const hasWorkout = (dayHistory && Object.values(dayHistory).some(sets => sets > 0)) || (daySession && daySession.durationSeconds > 0);
      
      const isSelected = selectedHistoryDate === dateStr;

      days.push(
        <div 
          key={i} 
          onClick={() => setSelectedHistoryDate(dateStr)}
          style={{
            aspectRatio: '1/1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: isSelected ? 'var(--heroui-violet)' : (hasWorkout ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)'),
            border: hasWorkout && !isSelected ? '1px solid rgba(124,58,237,0.5)' : '1px solid transparent',
            color: isSelected ? '#fff' : (hasWorkout ? 'var(--heroui-violet-light)' : 'var(--text-muted)'),
            fontWeight: hasWorkout ? 'bold' : 'normal',
            transition: 'all 0.2s ease',
            position: 'relative',
            padding: '2px'
          }}
        >
          <span style={{ fontSize: '0.85rem' }}>{i}</span>
          {daySession && daySession.durationSeconds > 0 && (
            <span style={{ 
              fontSize: '0.65rem', 
              color: isSelected ? '#fff' : '#a855f7', 
              fontWeight: 'bold', 
              lineHeight: 1, 
              marginTop: '2px',
              background: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(168,85,247,0.15)',
              padding: '1px 4px',
              borderRadius: '4px'
            }}>
              {Math.round(daySession.durationSeconds / 60)}m
            </span>
          )}
          {daySession?.photoUrl && (
            <div style={{ position: 'absolute', top: '3px', right: '3px', width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8' }} title="Check-in Foto vorhanden" />
          )}
        </div>
      );
    }

    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const selectedSession = selectedHistoryDate ? sessions[selectedHistoryDate] : null;

    return (
      <div className="glass-panel" style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--heroui-violet-light)', marginBottom: '12px', fontSize: '1.1rem' }}>
              <CalendarDays size={20} />
              {monthNames[month]} {year}
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.75rem', fontWeight: 'bold' }}>
              <div>Mo</div><div>Di</div><div>Mi</div><div>Do</div><div>Fr</div><div>Sa</div><div>So</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {days}
            </div>
          </div>

          <div>
            {selectedHistoryDate ? (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', height: '100%' }}>
                <h3 style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '1rem' }}>
                  Training am {selectedHistoryDate.split('-').reverse().join('.')}
                </h3>

                {/* Session stats (Duration & Weight & KFA & Photo) */}
                {selectedSession && (selectedSession.durationSeconds > 0 || selectedSession.bodyWeight || selectedSession.bodyFat || selectedSession.photoUrl) && (
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(124,58,237,0.1)', padding: '10px', borderRadius: '8px' }}>
                    {selectedSession.photoUrl && (
                      <div 
                        onClick={() => setPreviewPhotoUrl(selectedSession.photoUrl!)}
                        title="Klicken für Vergrößerung"
                        style={{ width: '60px', height: '60px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: '2px solid var(--heroui-violet)' }}
                      >
                        <img src={selectedSession.photoUrl} alt="Checkin" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {selectedSession.durationSeconds > 0 && (
                        <span className="badge-pill time" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                          <Timer size={12} /> {formatTime(selectedSession.durationSeconds)}
                        </span>
                      )}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {selectedSession.bodyWeight && (
                          <span className="badge-pill days" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                            <Weight size={12} /> {selectedSession.bodyWeight} kg
                          </span>
                        )}
                        {selectedSession.bodyFat && (
                          <span className="badge-pill time" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', background: 'var(--heroui-violet)' }}>
                            <Flame size={12} /> {selectedSession.bodyFat}% KFA
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {(!history[selectedHistoryDate] || Object.values(history[selectedHistoryDate]).every(s => s === 0)) ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Keine Übungen an diesem Tag.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                    {Object.entries(history[selectedHistoryDate]).map(([exId, sets]) => {
                      if (sets === 0) return null;
                      const exercise = allExercises.find(e => e.id === exId);
                      if (!exercise) return null;
                      return (
                        <div key={exId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.85rem' }}>
                          <div>
                            <span style={{ display: 'block', fontWeight: '500' }}>{exercise.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{exercise.equipment}</span>
                          </div>
                          <span className="badge-pill time" style={{ background: 'var(--heroui-violet)', fontSize: '0.75rem' }}>{sets} / {exercise.sets} Sets</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px', border: '1px dashed var(--border-light)', borderRadius: '12px' }}>
                Klicke auf einen Tag im Kalender, um Details zu sehen.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="workout-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn-secondary" 
            onClick={() => setViewMode('today')}
            style={{ borderColor: viewMode === 'today' ? 'var(--heroui-violet)' : 'transparent', color: viewMode === 'today' ? 'var(--heroui-violet-light)' : '#fff' }}
          >
            <Activity size={16} /> Training
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => setViewMode('calendar')}
            style={{ borderColor: viewMode === 'calendar' ? 'var(--heroui-violet)' : 'transparent', color: viewMode === 'calendar' ? 'var(--heroui-violet-light)' : '#fff' }}
          >
            <CalendarDays size={16} /> Kalender
          </button>
        </div>

        {/* Timer Control Bar */}
        {viewMode === 'today' && (
          <div>
            {!isTimerActive ? (
              <button className="btn-primary" onClick={handleStartWorkoutClick} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Play size={18} /> Training starten
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(124,58,237,0.2)', border: '1px solid var(--heroui-violet)', padding: '8px 16px', borderRadius: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--heroui-violet-light)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                  <Timer className="animate-pulse" size={20} />
                  {formatTime(elapsedSeconds)}
                </div>
                <button className="btn-secondary" onClick={handleFinishWorkout} style={{ borderColor: '#ef4444', color: '#ef4444', padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <StopCircle size={16} /> Beenden
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {viewMode === 'calendar' ? renderCalendar() : (
        <>
          {/* Motivations-Ziel Card (Vision Physique) */}
          <div className="glass-panel" style={{ 
            marginBottom: '24px', 
            padding: '16px 20px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            gap: '16px', 
            flexWrap: 'wrap',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(18,18,22,0.85) 100%)',
            border: '1px solid rgba(124,58,237,0.4)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ flex: '1 1 240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="badge-pill time" style={{ background: 'var(--heroui-violet)', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Flame size={12} /> Target: ~7% KFA
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--heroui-violet-light)', fontWeight: '600' }}>Physique Goal</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>
                Dein KI Motivations-Ziel 🎯
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Lade dein KI-generiertes Ziel-Foto hoch – für tägliche Motivation beim Training!
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {visionImageUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div 
                    onClick={() => setPreviewPhotoUrl(visionImageUrl)}
                    title="Klicken für Vollbild"
                    style={{ width: '75px', height: '75px', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', border: '2px solid var(--heroui-violet)', boxShadow: '0 0 15px rgba(124,58,237,0.4)', flexShrink: 0 }}
                  >
                    <img src={visionImageUrl} alt="Physique Goal" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <label className="btn-secondary" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera size={14} /> {isUploadingVision ? 'Lädt...' : 'Ändern'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleVisionPhotoUpload} disabled={isUploadingVision} />
                  </label>
                </div>
              ) : (
                <label className="btn-primary" style={{ cursor: 'pointer', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--heroui-violet)', fontSize: '0.85rem' }}>
                  <Upload size={16} /> {isUploadingVision ? 'Speichere in R2...' : 'Ziel-Foto hochladen'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleVisionPhotoUpload} disabled={isUploadingVision} />
                </label>
              )}
            </div>
          </div>

          {/* Body Fat & Lean Mass Calculator Card */}
          {(() => {
            const metrics = calculateBodyFatMetrics();
            const barPercent = Math.min(100, Math.max(0, ((metrics.kfa - 2) / (35 - 2)) * 100));

            return (
              <div className="glass-panel" style={{
                marginBottom: '24px',
                padding: '20px 24px',
                background: 'linear-gradient(135deg, rgba(24, 24, 32, 0.95) 0%, rgba(18, 18, 22, 0.85) 100%)',
                border: '1px solid rgba(124, 58, 237, 0.3)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setIsCalcCardOpen(!isCalcCardOpen)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Activity size={20} style={{ color: 'var(--heroui-violet-light)' }} />
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontWeight: 'bold' }}>
                      Körperfett & Mager-Masse Rechner (US Navy Method)
                    </h3>
                    <span className="badge-pill time" style={{ background: metrics.categoryColor, color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      {metrics.category}
                    </span>
                  </div>
                  <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {isCalcCardOpen ? '▲ Einklappen' : '▼ Ausklappen'}
                  </button>
                </div>

                {isCalcCardOpen && (
                  <>
                    <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>
                    
                    {/* Left Inputs Column */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button 
                          type="button" 
                          className="btn-secondary" 
                          onClick={() => setCalcGender('male')}
                          style={{ flex: 1, padding: '6px', fontSize: '0.85rem', borderColor: calcGender === 'male' ? 'var(--heroui-violet)' : 'transparent', background: calcGender === 'male' ? 'rgba(124,58,237,0.2)' : 'transparent', color: calcGender === 'male' ? '#fff' : 'var(--text-muted)' }}
                        >
                          ♂️ Mann
                        </button>
                        <button 
                          type="button" 
                          className="btn-secondary" 
                          onClick={() => setCalcGender('female')}
                          style={{ flex: 1, padding: '6px', fontSize: '0.85rem', borderColor: calcGender === 'female' ? 'var(--heroui-violet)' : 'transparent', background: calcGender === 'female' ? 'rgba(124,58,237,0.2)' : 'transparent', color: calcGender === 'female' ? '#fff' : 'var(--text-muted)' }}
                        >
                          ♀️ Frau
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Alter (Jahre)</label>
                          <input type="number" className="form-input" style={{ width: '100%', padding: '6px 10px', fontSize: '0.9rem' }} value={calcAge} onChange={e => setCalcAge(Number(e.target.value))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Gewicht (kg)</label>
                          <input type="number" className="form-input" style={{ width: '100%', padding: '6px 10px', fontSize: '0.9rem' }} value={calcWeight} onChange={e => setCalcWeight(Number(e.target.value))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Größe (cm)</label>
                          <input type="number" className="form-input" style={{ width: '100%', padding: '6px 10px', fontSize: '0.9rem' }} value={calcHeight} onChange={e => setCalcHeight(Number(e.target.value))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Nacken (cm)</label>
                          <input type="number" className="form-input" style={{ width: '100%', padding: '6px 10px', fontSize: '0.9rem' }} value={calcNeck} onChange={e => setCalcNeck(Number(e.target.value))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Bauch / Taillenumfang (cm)</label>
                          <input type="number" className="form-input" style={{ width: '100%', padding: '6px 10px', fontSize: '0.9rem' }} value={calcWaist} onChange={e => setCalcWaist(Number(e.target.value))} />
                        </div>
                        {calcGender === 'female' && (
                          <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Hüftumfang (cm)</label>
                            <input type="number" className="form-input" style={{ width: '100%', padding: '6px 10px', fontSize: '0.9rem' }} value={calcHip} onChange={e => setCalcHip(Number(e.target.value))} />
                          </div>
                        )}
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--heroui-violet-light)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Ziel KFA (%)</label>
                          <input type="number" step="0.5" className="form-input" style={{ width: '100%', padding: '6px 10px', fontSize: '0.9rem', borderColor: 'var(--heroui-violet)' }} value={calcTargetKfa} onChange={e => setCalcTargetKfa(Number(e.target.value))} />
                        </div>
                      </div>
                    </div>

                    {/* Right Results & Visual Bar Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      
                      {/* Top Result Banner */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(124, 58, 237, 0.15)', border: '1px solid var(--heroui-violet)', padding: '12px 16px', borderRadius: '12px' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Berechneter Körperfettanteil</span>
                          <span style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff' }}>{metrics.kfa}% KFA</span>
                        </div>
                        <button 
                          type="button" 
                          className="btn-primary" 
                          onClick={handleApplyCalcToToday}
                          style={{ padding: '8px 14px', fontSize: '0.8rem', background: 'var(--heroui-violet)', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Save size={14} /> In Check-in übernehmen
                        </button>
                      </div>

                      {/* Visual KFA Color Bar */}
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 'bold' }}>
                          <span>2% Essentiell</span>
                          <span style={{ color: '#22c55e' }}>6% Athlet (V-Shape Target)</span>
                          <span style={{ color: '#06b6d4' }}>14% Fitness</span>
                          <span style={{ color: '#f97316' }}>18% Ø</span>
                          <span style={{ color: '#ef4444' }}>25%+</span>
                        </div>

                        {/* Multi-segment Color Bar */}
                        <div style={{ position: 'relative', height: '14px', borderRadius: '7px', overflow: 'hidden', display: 'flex', background: '#222' }}>
                          <div style={{ flex: '4', background: '#eab308' }} title="Essentiell (2-5%)" />
                          <div style={{ flex: '8', background: '#22c55e' }} title="Athlet (6-13%)" />
                          <div style={{ flex: '4', background: '#06b6d4' }} title="Fitness (14-17%)" />
                          <div style={{ flex: '7', background: '#f97316' }} title="Average (18-24%)" />
                          <div style={{ flex: '10', background: '#ef4444' }} title="Higher (25%+)" />

                          {/* Pointer Indicator Triangle */}
                          <div style={{
                            position: 'absolute',
                            left: `${barPercent}%`,
                            top: '0',
                            bottom: '0',
                            width: '4px',
                            background: '#fff',
                            boxShadow: '0 0 8px #fff, 0 0 12px var(--heroui-violet)',
                            transform: 'translateX(-50%)'
                          }} />
                        </div>
                      </div>

                      {/* Details Breakdown Table */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px' }}>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>🏋️ Mager- / Muskelmasse</span>
                          <strong style={{ fontSize: '1.1rem', color: '#22c55e' }}>{metrics.leanMass} kg</strong>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px' }}>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>🧈 Fettmasse</span>
                          <strong style={{ fontSize: '1.1rem', color: '#f97316' }}>{metrics.fatMass} kg</strong>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px' }}>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>🎯 Fettverlust bis {calcTargetKfa}% KFA</span>
                          <strong style={{ fontSize: '1.1rem', color: 'var(--heroui-violet-light)' }}>{metrics.fatToLose} kg</strong>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px' }}>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>📊 Alternativ (BMI KFA)</span>
                          <strong style={{ fontSize: '1.1rem', color: '#94a3b8' }}>{metrics.bmiKfa}%</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Calorie Deficit & V-Shape Nutrition Matrix Section */}
                  <div style={{
                    marginTop: '20px',
                    paddingTop: '20px',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '20px'
                  }}>
                    {/* Activity & Deficit Selectors */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--heroui-violet-light)', fontWeight: 'bold' }}>
                        ⚡ Aktivität & Ziel-Defizit
                      </h4>
                      
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Aktivitätslevel (PAL)</label>
                        <select 
                          className="form-input" 
                          value={activityLevel} 
                          onChange={e => setActivityLevel(Number(e.target.value))}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
                        >
                          <option value={1.2}>Sedentär (Büro / Wenig Bewegung)</option>
                          <option value={1.375}>Leicht aktiv (1-3 Workouts/Woche)</option>
                          <option value={1.55}>Moderat aktiv (3-5 Workouts/Woche - V-Shape)</option>
                          <option value={1.725}>Sehr aktiv (6-7 intensive Workouts)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Ziel-Defizit wählen</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                          <button 
                            type="button" 
                            className="btn-secondary" 
                            onClick={() => setTargetDeficitMode(300)}
                            style={{ padding: '6px 4px', fontSize: '0.75rem', borderColor: targetDeficitMode === 300 ? '#22c55e' : 'transparent', background: targetDeficitMode === 300 ? 'rgba(34,197,94,0.2)' : 'transparent', color: targetDeficitMode === 300 ? '#fff' : 'var(--text-muted)' }}
                          >
                            -300 kcal (Slow)
                          </button>
                          <button 
                            type="button" 
                            className="btn-secondary" 
                            onClick={() => setTargetDeficitMode(500)}
                            style={{ padding: '6px 4px', fontSize: '0.75rem', borderColor: targetDeficitMode === 500 ? 'var(--heroui-violet)' : 'transparent', background: targetDeficitMode === 500 ? 'rgba(124,58,237,0.2)' : 'transparent', color: targetDeficitMode === 500 ? '#fff' : 'var(--text-muted)' }}
                          >
                            -500 kcal (Shred)
                          </button>
                          <button 
                            type="button" 
                            className="btn-secondary" 
                            onClick={() => setTargetDeficitMode(750)}
                            style={{ padding: '6px 4px', fontSize: '0.75rem', borderColor: targetDeficitMode === 750 ? '#f97316' : 'transparent', background: targetDeficitMode === 750 ? 'rgba(249,115,22,0.2)' : 'transparent', color: targetDeficitMode === 750 ? '#fff' : 'var(--text-muted)' }}
                          >
                            -750 kcal (Fast)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Calorie Results */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#22c55e', fontWeight: 'bold' }}>
                        🔥 Kalorien-Tagesziel & Fatloss Prognose
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Gesamtumsatz (TDEE)</span>
                          <strong style={{ fontSize: '1.1rem', color: '#fff' }}>{metrics.tdee} kcal</strong>
                        </div>
                        <div style={{ background: 'rgba(124,58,237,0.2)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--heroui-violet)' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--heroui-violet-light)', display: 'block', fontWeight: 'bold' }}>Ziel-Kalorien/Tag</span>
                          <strong style={{ fontSize: '1.2rem', color: '#fff' }}>{metrics.targetCalories} kcal</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem' }}>
                        <span>Fettverlust/Woche: <strong style={{ color: '#22c55e' }}>~{metrics.fatLossPerWeek} kg</strong></span>
                        <span>Dauer bis {calcTargetKfa}% KFA: <strong style={{ color: 'var(--heroui-violet-light)' }}>~{metrics.weeksToTarget} W.</strong></span>
                      </div>
                    </div>

                    {/* V-Shape Optimal Macro Distribution */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#38bdf8', fontWeight: 'bold' }}>
                        🥩 V-Shape Makro-Protokoll
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.8rem', textAlign: 'center' }}>
                        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '8px 4px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#fca5a5', display: 'block' }}>🥩 Protein</span>
                          <strong style={{ fontSize: '1.1rem', color: '#fff' }}>{metrics.proteinGrams}g</strong>
                        </div>
                        <div style={{ background: 'rgba(234, 179, 8, 0.15)', border: '1px solid #eab308', padding: '8px 4px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#fde047', display: 'block' }}>🥑 Fett</span>
                          <strong style={{ fontSize: '1.1rem', color: '#fff' }}>{metrics.fatGrams}g</strong>
                        </div>
                        <div style={{ background: 'rgba(14, 165, 233, 0.15)', border: '1px solid #0ea5e9', padding: '8px 4px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#7dd3fc', display: 'block' }}>🍚 Carbs</span>
                          <strong style={{ fontSize: '1.1rem', color: '#fff' }}>{metrics.carbsGrams}g</strong>
                        </div>
                      </div>
                    </div>

                  </div>
                </>
              )}
            </div>
            );
          })()}

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
                        padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', cursor: 'default', height: 'auto'
                      }}
                    >
                      <div style={{ width: '80px', height: '80px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                        <img src={ex.imageUrl} alt={ex.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      </div>

                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '6px', color: isAllDone ? 'rgba(255,255,255,0.5)' : '#fff' }}>
                          {idx + 1}. {ex.name}
                        </h3>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="badge-pill time" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Flame size={12} /> {ex.sets} Sets × {ex.reps} Reps
                          </span>
                          <span className="badge-pill days" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Timer size={12} /> {ex.restTime} Pause
                          </span>
                          <span className="badge-pill days" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                            {ex.equipment}
                          </span>
                        </div>
                      </div>

                      {/* Dedicated Plank Hold Timer Widget */}
                      {(ex.name.toLowerCase().includes('plank') || ex.equipment.includes('Sekunden')) && (
                        <div style={{ marginRight: '12px' }}>
                          {activePlankTimer?.exerciseId === ex.id ? (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.35), rgba(245, 158, 11, 0.15))',
                              border: '1px solid #f59e0b',
                              padding: '6px 14px',
                              borderRadius: '20px',
                              boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)'
                            }}>
                              <Timer size={16} className="animate-spin" style={{ color: '#f59e0b' }} />
                              <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#fff', fontFamily: 'monospace' }}>
                                Plank: {activePlankTimer.secondsLeft}s
                              </span>
                              <button 
                                onClick={() => setActivePlankTimer(null)}
                                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: '4px' }}
                                title="Stoppen"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => startPlankTimer(ex.id, ex.reps)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                borderColor: '#f59e0b',
                                color: '#fbbf24',
                                borderRadius: '20px',
                                background: 'rgba(245, 158, 11, 0.1)'
                              }}
                            >
                              <Play size={14} /> Plank ({ex.reps}s) halten
                            </button>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {Array.from({ length: ex.sets }).map((_, setIdx) => {
                          const isChecked = setIdx < completed;
                          return (
                            <div 
                              key={setIdx}
                              onClick={() => toggleSet(ex.id, setIdx)}
                              className="checkbox"
                              style={{ 
                                width: '24px', height: '24px', cursor: 'pointer',
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
        </>
      )}

      {/* Pre-Workout Modal (Weight & Photo) */}
      {isPreModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPreModalOpen(false)}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: 'var(--heroui-violet-light)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={20} /> Pre-Workout Check-in
              </h2>
              <button className="action-btn" onClick={() => setIsPreModalOpen(false)}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Weight size={16} /> Gewicht (kg)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  className="form-input" 
                  placeholder="z. B. 78.5" 
                  value={bodyWeightInput} 
                  onChange={e => setBodyWeightInput(e.target.value)} 
                  autoFocus 
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Flame size={16} /> KFA (%)</label>
                  <button 
                    type="button"
                    onClick={() => setShowKfaCalc(!showKfaCalc)}
                    style={{ background: 'none', border: 'none', color: 'var(--heroui-violet-light)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {showKfaCalc ? 'Schließen' : 'Rechner'}
                  </button>
                </div>
                <input 
                  type="number" 
                  step="0.1" 
                  className="form-input" 
                  placeholder="z. B. 14.5" 
                  value={bodyFatInput} 
                  onChange={e => setBodyFatInput(e.target.value)} 
                />
              </div>
            </div>

            {/* US Navy KFA Rechner Pop-Down */}
            {showKfaCalc && (
              <div style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid var(--heroui-violet)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--heroui-violet-light)', marginBottom: '8px' }}>
                  US Navy KFA-Schätzer
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
                  <input type="number" placeholder="Größe cm" className="form-input" style={{ fontSize: '0.75rem', padding: '6px' }} value={modalCalcHeight} onChange={e => setModalCalcHeight(e.target.value)} />
                  <input type="number" placeholder="Nacken cm" className="form-input" style={{ fontSize: '0.75rem', padding: '6px' }} value={modalCalcNeck} onChange={e => setModalCalcNeck(e.target.value)} />
                  <input type="number" placeholder="Bauch cm" className="form-input" style={{ fontSize: '0.75rem', padding: '6px' }} value={modalCalcWaist} onChange={e => setModalCalcWaist(e.target.value)} />
                </div>
                <button 
                  type="button"
                  className="btn-secondary" 
                  onClick={calculateNavyKfa}
                  style={{ width: '100%', padding: '6px', fontSize: '0.75rem', borderColor: 'var(--heroui-violet)' }}
                >
                  Berechnen & Übernehmen
                </button>
              </div>
            )}

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Upload size={16} /> Check-in Foto</label>
              <input 
                type="file" 
                accept="image/*" 
                className="form-input" 
                onChange={e => setPhotoFile(e.target.files ? e.target.files[0] : null)} 
              />
            </div>

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="btn-secondary" onClick={() => setIsPreModalOpen(false)}>Abbrechen</button>
              <button className="btn-primary" onClick={handleConfirmStartWorkout} disabled={isUploading}>
                {isUploading ? 'Speichere...' : 'Jetzt starten'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {previewPhotoUrl && (
        <div className="modal-overlay" onClick={() => setPreviewPhotoUrl(null)} style={{ zIndex: 1000 }}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', width: '90%', padding: '16px', borderRadius: '16px', background: 'rgba(18, 18, 22, 0.95)', backdropFilter: 'blur(20px)', border: '1px solid var(--heroui-violet)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ color: 'var(--heroui-violet-light)', fontSize: '1.1rem', margin: 0, fontWeight: 'bold' }}>Check-in Foto Vorschau</h3>
              <button className="action-btn" onClick={() => setPreviewPhotoUrl(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', padding: '6px', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ borderRadius: '12px', overflow: 'hidden', maxHeight: '75vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000' }}>
              <img src={previewPhotoUrl} alt="Vorschau" style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block' }} />
            </div>
          </div>
        </div>
      )}

      {/* Floating Rest Timer Overlay Window */}
      {activeRestTimer && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          zIndex: 9999,
          background: 'rgba(18, 18, 26, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '2px solid var(--heroui-violet)',
          boxShadow: '0 12px 40px rgba(124, 58, 237, 0.5), 0 0 20px rgba(168, 85, 247, 0.3)',
          borderRadius: '24px',
          padding: '20px 24px',
          minWidth: '280px',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span className="badge-pill time" style={{ background: 'var(--heroui-violet)', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Timer size={12} className="animate-spin" /> Satzpause
            </span>
            <button 
              onClick={() => setActiveRestTimer(null)}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', padding: '4px', cursor: 'pointer', display: 'flex' }}
              title="Schließen"
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
            {activeRestTimer.exerciseName}
          </div>

          <div style={{
            fontSize: '3rem',
            fontWeight: '900',
            color: '#fff',
            fontFamily: 'monospace',
            lineHeight: 1,
            marginBottom: '16px',
            textShadow: '0 0 15px rgba(168, 85, 247, 0.6)'
          }}>
            {activeRestTimer.secondsLeft}<span style={{ fontSize: '1.5rem', color: 'var(--heroui-violet-light)' }}>s</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button 
              className="btn-secondary" 
              onClick={() => setActiveRestTimer(prev => prev ? { ...prev, secondsLeft: prev.secondsLeft + 10 } : null)}
              style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '12px', borderColor: 'var(--heroui-violet)' }}
            >
              +10s
            </button>
            <button 
              className="btn-primary" 
              onClick={() => setActiveRestTimer(null)}
              style={{ padding: '6px 18px', fontSize: '0.8rem', borderRadius: '12px', background: 'var(--heroui-violet)' }}
            >
              Weiter
            </button>
          </div>
        </div>
      )}
    </div>
  );

}
