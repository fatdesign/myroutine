import { useState, useEffect } from 'react';
import { WORKOUT_PLAN } from '../data/workouts';
import type { Exercise } from '../data/workouts';
import { getTodayStr, getDateStr } from '../utils/habitUtils';
import { getStoredCalculatorInputs, calculateMetricsFromInputs } from '../utils/bodyMetrics';
import { fetchWorkoutHistory, upsertWorkoutHistory, fetchWorkoutSessions, upsertWorkoutSession, uploadImage, fetchBodyMetricsInputs, upsertBodyMetricsInputs, fetchExerciseOverrides, upsertExerciseOverride, type ExerciseOverrideRecord } from '../services/plannerApi';
import type { WorkoutHistoryRecord, WorkoutSessionRecord, WorkoutSession } from '../types';
import { Check, Dumbbell, Timer, Flame, CalendarDays, Activity, Play, StopCircle, Upload, Weight, Camera, X, Save, Trophy, Sparkles, TrendingDown, Info } from 'lucide-react';

export function WorkoutDashboard() {
  const [viewMode, setViewMode] = useState<'today' | 'calendar'>('today');
  const [selectedDay, setSelectedDay] = useState<string>('1');
  const [history, setHistory] = useState<WorkoutHistoryRecord>({});
  const [sessions, setSessions] = useState<WorkoutSessionRecord>({});
  const [exerciseOverrides, setExerciseOverrides] = useState<ExerciseOverrideRecord>({});
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [showKfaLevelsModal, setShowKfaLevelsModal] = useState(false);

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

  // Body Fat Calculator Card State (persisted in localStorage)
  const initialCalcInputs = getStoredCalculatorInputs();
  const [isCalcCardOpen, setIsCalcCardOpen] = useState<boolean>(true);
  const [calcGender, setCalcGender] = useState<'male' | 'female'>(initialCalcInputs.gender);
  const [calcAge, setCalcAge] = useState<number>(initialCalcInputs.age);
  const [calcWeight, setCalcWeight] = useState<number>(initialCalcInputs.weight);
  const [calcHeight, setCalcHeight] = useState<number>(initialCalcInputs.height);
  const [calcNeck, setCalcNeck] = useState<number>(initialCalcInputs.neck);
  const [calcWaist, setCalcWaist] = useState<number>(initialCalcInputs.waist);
  const [calcHip, setCalcHip] = useState<number>(initialCalcInputs.hip);
  const [calcTargetKfa, setCalcTargetKfa] = useState<number>(initialCalcInputs.targetKfa);
  const [activityLevel, setActivityLevel] = useState<number>(initialCalcInputs.activityLevel);
  const [targetDeficitMode, setTargetDeficitMode] = useState<number>(initialCalcInputs.targetDeficitMode);

  // Fetch persisted calculator inputs from Cloudflare D1 Database on mount
  useEffect(() => {
    fetchBodyMetricsInputs().then(inputs => {
      setCalcGender(inputs.gender);
      setCalcAge(inputs.age);
      setCalcWeight(inputs.weight);
      setCalcHeight(inputs.height);
      setCalcNeck(inputs.neck);
      setCalcWaist(inputs.waist);
      setCalcHip(inputs.hip);
      setCalcTargetKfa(inputs.targetKfa);
      setActivityLevel(inputs.activityLevel);
      setTargetDeficitMode(inputs.targetDeficitMode);
    });
  }, []);

  // Auto-save calculator inputs to D1 & localStorage whenever user modifies any field
  useEffect(() => {
    upsertBodyMetricsInputs({
      gender: calcGender,
      age: calcAge,
      weight: calcWeight,
      height: calcHeight,
      neck: calcNeck,
      waist: calcWaist,
      hip: calcHip,
      targetKfa: calcTargetKfa,
      activityLevel,
      targetDeficitMode
    });
  }, [calcGender, calcAge, calcWeight, calcHeight, calcNeck, calcWaist, calcHip, calcTargetKfa, activityLevel, targetDeficitMode]);

  const calculateBodyFatMetrics = () => {
    return calculateMetricsFromInputs({
      gender: calcGender,
      age: calcAge,
      weight: calcWeight,
      height: calcHeight,
      neck: calcNeck,
      waist: calcWaist,
      hip: calcHip,
      targetKfa: calcTargetKfa,
      activityLevel,
      targetDeficitMode
    });
  };

  const handleApplyCalcToToday = async () => {
    const metrics = calculateBodyFatMetrics();
    const sessionData: Partial<WorkoutSession> = {
      bodyWeight: calcWeight,
      bodyFat: metrics.kfa,
      neck: calcNeck,
      waist: calcWaist,
      ...(calcGender === 'female' ? { hip: calcHip } : {})
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

  // Workout Completion Modal State
  const [showCompletionModal, setShowCompletionModal] = useState<boolean>(false);
  const [completionStats, setCompletionStats] = useState<{ durationStr: string; totalSetsDone: number; totalSetsTarget: number } | null>(null);

  const playVictorySound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5 -> E5 -> G5 -> C6
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.6, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.38);
      });
    } catch (e) {
      console.warn("Victory sound failed:", e);
    }
  };

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
            const allEx = WORKOUT_PLAN.flatMap(d => d.exercises).map(withOverrides);
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

    Promise.all([fetchWorkoutHistory(), fetchWorkoutSessions(), fetchExerciseOverrides()]).then(([histData, sessData, overridesData]) => {
      setHistory(histData);
      setSessions(sessData);
      setExerciseOverrides(overridesData);
      if (sessData[todayStr]?.bodyWeight) {
        setBodyWeightInput(String(sessData[todayStr].bodyWeight));
      }
    });
  }, [todayStr]);

  // Parses equipment strings like "23kg Langhantel" or "2x 13kg Kurzhanteln" into an
  // editable weight number. Bodyweight exercises ("Körpergewicht"...) return null.
  const parseEquipmentWeight = (equipment: string): { multiplierPrefix: string; weight: number; label: string } | null => {
    const match = equipment.match(/^(\d+x\s+)?(\d+(?:[.,]\d+)?)kg\s+(.+)$/i);
    if (!match) return null;
    return { multiplierPrefix: match[1] || '', weight: parseFloat(match[2].replace(',', '.')), label: match[3] };
  };

  const formatEquipmentWeight = (parsed: { multiplierPrefix: string; weight: number; label: string }): string =>
    `${parsed.multiplierPrefix}${parsed.weight}kg ${parsed.label}`;

  // Merge a persisted Sets/Reps/Weight override into an exercise from the static plan
  const withOverrides = (ex: Exercise): Exercise => {
    const o = exerciseOverrides[ex.id];
    if (!o) return ex;
    let equipment = ex.equipment;
    if (o.weight !== undefined) {
      const parsed = parseEquipmentWeight(ex.equipment);
      if (parsed) equipment = formatEquipmentWeight({ ...parsed, weight: o.weight });
    }
    return { ...ex, sets: o.sets ?? ex.sets, reps: o.reps ?? ex.reps, equipment };
  };

  const adjustExercise = (ex: Exercise, field: 'sets' | 'reps', delta: number) => {
    const minValue = 1;
    const nextSets = field === 'sets' ? Math.max(minValue, ex.sets + delta) : ex.sets;
    const nextReps = field === 'reps' ? Math.max(minValue, ex.reps + delta) : ex.reps;
    const updated = { sets: nextSets, reps: nextReps };

    setExerciseOverrides(prev => ({ ...prev, [ex.id]: { ...prev[ex.id], ...updated } }));
    upsertExerciseOverride(ex.id, updated);
  };

  const adjustWeight = (ex: Exercise, delta: number) => {
    const parsed = parseEquipmentWeight(ex.equipment);
    if (!parsed) return;
    const nextWeight = Math.max(1, parsed.weight + delta);
    const updated = { weight: nextWeight };

    setExerciseOverrides(prev => ({ ...prev, [ex.id]: { ...prev[ex.id], ...updated } }));
    upsertExerciseOverride(ex.id, updated);
  };

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

    const activeWorkout = WORKOUT_PLAN.find(d => d.dayId === selectedDay);
    const isWorkoutFullyCompleted = activeWorkout && activeWorkout.exercises.every(ex => {
      const done = nextDaySets[ex.id] || 0;
      return done >= (exerciseOverrides[ex.id]?.sets ?? ex.sets);
    });

    if (isWorkoutFullyCompleted && newCount > currentCount) {
      // 1. Stop Rest Timer if active
      setActiveRestTimer(null);

      // 2. Stop Workout Timer if active
      let totalDurationSecs = elapsedSeconds;
      if (isTimerActive && timerStartTimestamp) {
        totalDurationSecs = Math.floor((Date.now() - timerStartTimestamp) / 1000);
        setIsTimerActive(false);
        setTimerStartTimestamp(null);
        localStorage.removeItem('myroutine_timer_active');
        localStorage.removeItem('myroutine_timer_start');

        const updatedSession: Partial<WorkoutSession> = {
          durationSeconds: (sessions[todayStr]?.durationSeconds || 0) + totalDurationSecs,
        };

        setSessions(prev => ({
          ...prev,
          [todayStr]: { ...prev[todayStr], ...updatedSession, date: todayStr }
        }));

        upsertWorkoutSession(todayStr, updatedSession);
      }

      // 3. Play triumphant victory chime sound
      playVictorySound();

      // 4. Calculate stats & show completion modal
      const totalSetsTarget = activeWorkout ? activeWorkout.exercises.reduce((acc, e) => acc + e.sets, 0) : 0;
      const totalSetsDone = activeWorkout ? activeWorkout.exercises.reduce((acc, e) => acc + (nextDaySets[e.id] || 0), 0) : 0;

      setCompletionStats({
        durationStr: formatTime(totalDurationSecs),
        totalSetsDone,
        totalSetsTarget
      });
      setShowCompletionModal(true);

    } else if (newCount > currentCount) {
      // Trigger Rest Timer for normal set completion
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

  const rawActiveWorkout = WORKOUT_PLAN.find(d => d.dayId === selectedDay);
  const activeWorkout = rawActiveWorkout ? { ...rawActiveWorkout, exercises: rawActiveWorkout.exercises.map(withOverrides) } : undefined;
  const allExercises = WORKOUT_PLAN.flatMap(d => d.exercises).map(withOverrides);

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

    // Process logged body weight & KFA history chronologically to compute deltas
    const bodyMetricsHistory = Object.values(sessions)
      .filter(s => s.bodyWeight || s.bodyFat)
      .sort((a, b) => a.date.localeCompare(b.date));

    const progressLogs = bodyMetricsHistory.map((s, idx) => {
      const prev = idx > 0 ? bodyMetricsHistory[idx - 1] : null;
      const weightDelta = prev && s.bodyWeight && prev.bodyWeight ? (s.bodyWeight - prev.bodyWeight).toFixed(1) : null;
      const kfaDelta = prev && s.bodyFat && prev.bodyFat ? (s.bodyFat - prev.bodyFat).toFixed(1) : null;

      return {
        ...s,
        weightDeltaStr: weightDelta ? (Number(weightDelta) > 0 ? `+${weightDelta}` : `${weightDelta}`) : null,
        kfaDeltaStr: kfaDelta ? (Number(kfaDelta) > 0 ? `+${kfaDelta}` : `${kfaDelta}`) : null
      };
    }).reverse();

    return (
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          
          {/* Panel 1: Calendar Grid */}
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

          {/* Panel 2: Selected Day Exercises */}
          <div>
            {selectedHistoryDate ? (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '12px', height: '100%', border: '1px solid rgba(255,255,255,0.05)' }}>
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
                        style={{ width: '50px', height: '50px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: '2px solid var(--heroui-violet)' }}
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
                          <span className="badge-pill days" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            <Weight size={12} /> {selectedSession.bodyWeight} kg
                          </span>
                        )}
                        {selectedSession.bodyFat && (
                          <span className="badge-pill time" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', background: 'var(--heroui-violet)', whiteSpace: 'nowrap' }}>
                            <Flame size={12} /> {selectedSession.bodyFat}% KFA
                          </span>
                        )}
                        {selectedSession.neck && (
                          <span className="badge-pill days" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                            👔 Nacken: {selectedSession.neck} cm
                          </span>
                        )}
                        {selectedSession.waist && (
                          <span className="badge-pill days" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                            📏 Bauch: {selectedSession.waist} cm
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {(!history[selectedHistoryDate] || Object.values(history[selectedHistoryDate]).every(s => s === 0)) ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Keine Übungen an diesem Tag.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                          <span className="badge-pill time" style={{ background: 'var(--heroui-violet)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{sets} / {exercise.sets} Sets × {exercise.reps} Reps</span>
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

          {/* Panel 3: Body Weight & KFA Progress History Dashboard */}
          <div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '12px', height: '100%', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, color: '#22c55e', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingDown size={18} />
                Körper-Entwicklung & KFA
              </h3>

              {progressLogs.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontStyle: 'italic' }}>
                  Noch keine Gewichts- oder KFA-Einträge vorhanden. Klicke im Rechner auf "Stand für heute speichern", um deinen Fortschritt zu tracken!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {progressLogs.map(log => (
                    <div 
                      key={log.date}
                      onClick={() => setSelectedHistoryDate(log.date)}
                      style={{
                        background: selectedHistoryDate === log.date ? 'rgba(124, 58, 237, 0.15)' : 'rgba(0,0,0,0.3)',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: selectedHistoryDate === log.date ? '1px solid var(--heroui-violet)' : '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: selectedHistoryDate === log.date ? '0 0 15px rgba(124, 58, 237, 0.25)' : 'none'
                      }}
                    >
                      {/* Top Header Row: Date & Main Stats + Delta Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 'bold' }}>
                            📅 {log.date.split('-').reverse().join('.')}
                          </span>
                          <div style={{ display: 'flex', gap: '10px', marginTop: '3px', alignItems: 'center' }}>
                            {log.bodyWeight && (
                              <span style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '800', whiteSpace: 'nowrap' }}>
                                {log.bodyWeight} kg
                              </span>
                            )}
                            {log.bodyFat && (
                              <span style={{ fontSize: '0.88rem', color: '#22c55e', fontWeight: '800', whiteSpace: 'nowrap' }}>
                                {log.bodyFat}% KFA
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right Delta Badges - Single Line */}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                          {log.weightDeltaStr && (
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: log.weightDeltaStr.startsWith('-') ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                              border: log.weightDeltaStr.startsWith('-') ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                              color: log.weightDeltaStr.startsWith('-') ? '#22c55e' : '#ef4444',
                              fontWeight: 'bold',
                              whiteSpace: 'nowrap'
                            }}>
                              {log.weightDeltaStr} kg
                            </span>
                          )}
                          {log.kfaDeltaStr && (
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: log.kfaDeltaStr.startsWith('-') ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                              border: log.kfaDeltaStr.startsWith('-') ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                              color: log.kfaDeltaStr.startsWith('-') ? '#22c55e' : '#ef4444',
                              fontWeight: 'bold',
                              whiteSpace: 'nowrap'
                            }}>
                              {log.kfaDeltaStr}% KFA
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Body Measurement Micro-Chips */}
                      {(log.neck || log.waist || log.hip || (log.date === todayStr && (calcNeck || calcWaist))) && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '2px' }}>
                          {(log.neck || (log.date === todayStr ? calcNeck : null)) && (
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(124, 58, 237, 0.14)',
                              border: '1px solid rgba(168, 85, 247, 0.25)',
                              color: '#c084fc',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              👔 Nacken: {log.neck || calcNeck} cm
                            </span>
                          )}
                          {(log.waist || (log.date === todayStr ? calcWaist : null)) && (
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(124, 58, 237, 0.14)',
                              border: '1px solid rgba(168, 85, 247, 0.25)',
                              color: '#c084fc',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              📏 Bauch: {log.waist || calcWaist} cm
                            </span>
                          )}
                          {log.hip && calcGender === 'female' && (
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(124, 58, 237, 0.14)',
                              border: '1px solid rgba(168, 85, 247, 0.25)',
                              color: '#c084fc',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              📐 Hüfte: {log.hip} cm
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                <div className="calc-card-header" onClick={() => setIsCalcCardOpen(!isCalcCardOpen)}>
                  <div className="calc-header-text-container">
                    <div className="calc-header-title-row">
                      <Activity size={20} style={{ color: 'var(--heroui-violet-light)', flexShrink: 0 }} />
                      <h3 className="calc-header-title">
                        Körperfett & Mager-Masse Rechner (US Navy Method)
                      </h3>
                    </div>
                    <div className="calc-header-subtitle-row">
                      <span className="badge-pill time" style={{ background: metrics.categoryColor, color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {metrics.category}
                      </span>
                    </div>
                  </div>
                  
                  <button type="button" className="calc-toggle-btn" onClick={(e) => { e.stopPropagation(); setIsCalcCardOpen(!isCalcCardOpen); }}>
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

                      {/* Minimalist Interactive Visual KFA Color Bar */}
                      <div style={{
                        background: 'rgba(0,0,0,0.35)',
                        padding: '16px',
                        borderRadius: '14px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        {/* Header & Status Pill + Info Modal Trigger */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            KFA Levels & Einordnung
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => setShowKfaLevelsModal(true)}
                              style={{
                                background: 'rgba(124, 58, 237, 0.15)',
                                border: '1px solid var(--heroui-violet)',
                                color: '#c084fc',
                                fontSize: '0.72rem',
                                fontWeight: 'bold',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <Info size={13} /> Level Details
                            </button>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 'bold',
                              padding: '3px 10px',
                              borderRadius: '20px',
                              background: `${metrics.categoryColor}20`,
                              color: metrics.categoryColor,
                              border: `1px solid ${metrics.categoryColor}50`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              whiteSpace: 'nowrap'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: metrics.categoryColor, boxShadow: `0 0 6px ${metrics.categoryColor}` }} />
                              Stand: {metrics.category}
                            </span>
                          </div>
                        </div>

                        {/* Interactive Progress Bar Container with Floating Marker & Ticks */}
                        <div 
                          onClick={() => setShowKfaLevelsModal(true)}
                          title="Klicken für KFA Level Übersicht"
                          style={{ position: 'relative', marginTop: '18px', marginBottom: '4px', cursor: 'pointer' }}
                        >
                          {/* Floating Pointer Pill */}
                          <div style={{
                            position: 'absolute',
                            left: `${barPercent}%`,
                            bottom: '100%',
                            marginBottom: '4px',
                            transform: 'translateX(-50%)',
                            zIndex: 10,
                            pointerEvents: 'none'
                          }}>
                            <div style={{
                              background: '#18181b',
                              border: `1.5px solid ${metrics.categoryColor}`,
                              color: '#fff',
                              fontSize: '0.7rem',
                              fontWeight: '800',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              whiteSpace: 'nowrap',
                              boxShadow: `0 4px 12px rgba(0,0,0,0.6), 0 0 8px ${metrics.categoryColor}50`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span>{metrics.kfa}% KFA</span>
                            </div>
                            <div style={{
                              width: 0,
                              height: 0,
                              borderLeft: '4px solid transparent',
                              borderRight: '4px solid transparent',
                              borderTop: `4px solid ${metrics.categoryColor}`,
                              margin: '0 auto'
                            }} />
                          </div>

                          {/* Multi-segment Color Bar */}
                          <div style={{
                            position: 'relative',
                            height: '14px',
                            borderRadius: '7px',
                            overflow: 'hidden',
                            display: 'flex',
                            background: '#222',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)'
                          }}>
                            <div style={{ flex: '4', background: '#eab308' }} title="Essentiell (2-5%) - Tippen für Info" />
                            <div style={{ flex: '8', background: '#22c55e' }} title="Athlet (6-13%) - Tippen für Info" />
                            <div style={{ flex: '4', background: '#06b6d4' }} title="Fitness (14-17%) - Tippen für Info" />
                            <div style={{ flex: '7', background: '#f97316' }} title="Durchschnitt (18-24%) - Tippen für Info" />
                            <div style={{ flex: '10', background: '#ef4444' }} title="Höherer KFA (25%+) - Tippen für Info" />

                            {/* Pointer Line */}
                            <div style={{
                              position: 'absolute',
                              left: `${barPercent}%`,
                              top: '-2px',
                              bottom: '-2px',
                              width: '4px',
                              background: '#fff',
                              boxShadow: '0 0 8px #fff, 0 0 12px var(--heroui-violet)',
                              transform: 'translateX(-50%)',
                              zIndex: 5,
                              borderRadius: '2px'
                            }} />
                          </div>

                          {/* Percentage Ticks - Non-overlapping numeric marks */}
                          <div style={{
                            position: 'relative',
                            height: '16px',
                            fontSize: '0.68rem',
                            color: 'var(--text-muted)',
                            marginTop: '4px',
                            fontWeight: '600'
                          }}>
                            <span style={{ position: 'absolute', left: '0%' }}>2%</span>
                            <span style={{ position: 'absolute', left: '12.1%', transform: 'translateX(-50%)' }}>6%</span>
                            <span style={{ position: 'absolute', left: '36.4%', transform: 'translateX(-50%)' }}>14%</span>
                            <span style={{ position: 'absolute', left: '48.5%', transform: 'translateX(-50%)' }}>18%</span>
                            <span style={{ position: 'absolute', left: '69.7%', transform: 'translateX(-50%)' }}>25%</span>
                            <span style={{ position: 'absolute', right: '0%' }}>35%+</span>
                          </div>
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

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Grundumsatz (BMR)</span>
                          <strong style={{ fontSize: '1.05rem', color: '#94a3b8' }}>{metrics.bmr} kcal</strong>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Gesamtumsatz (TDEE)</span>
                          <strong style={{ fontSize: '1.05rem', color: '#fff' }}>{metrics.tdee} kcal</strong>
                        </div>
                        <div style={{ background: 'rgba(124,58,237,0.2)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--heroui-violet)' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--heroui-violet-light)', display: 'block', fontWeight: 'bold' }}>Ziel-Kalorien/Tag</span>
                          <strong style={{ fontSize: '1.1rem', color: '#fff' }}>{metrics.targetCalories} kcal</strong>
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
                      className={`exercise-card-item ${isAllDone ? 'completed' : ''}`}
                    >
                      <div className="exercise-card-top">
                        <div className="exercise-thumb">
                          <img src={ex.imageUrl} alt={ex.name} loading="lazy" />
                        </div>

                        <div className="exercise-content">
                          <h3 className="exercise-title">
                            {idx + 1}. {ex.name}
                          </h3>

                          <div className="exercise-badges-row">
                            <span className="badge-pill time" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Flame size={12} />
                              <button type="button" className="stepper-btn" onClick={() => adjustExercise(ex, 'sets', -1)} title="Weniger Sets">−</button>
                              {ex.sets} Sets
                              <button type="button" className="stepper-btn" onClick={() => adjustExercise(ex, 'sets', 1)} title="Mehr Sets">+</button>
                              ×
                              <button type="button" className="stepper-btn" onClick={() => adjustExercise(ex, 'reps', -1)} title="Weniger Reps">−</button>
                              {ex.reps} Reps
                              <button type="button" className="stepper-btn" onClick={() => adjustExercise(ex, 'reps', 1)} title="Mehr Reps">+</button>
                            </span>
                            <span className="badge-pill days" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Timer size={12} /> {ex.restTime} Pause
                            </span>
                            <span className="badge-pill equipment" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              {parseEquipmentWeight(ex.equipment) ? (
                                <>
                                  <button type="button" className="stepper-btn" onClick={() => adjustWeight(ex, -1)} title="Weniger Gewicht">−</button>
                                  {ex.equipment}
                                  <button type="button" className="stepper-btn" onClick={() => adjustWeight(ex, 1)} title="Mehr Gewicht">+</button>
                                </>
                              ) : ex.equipment}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="exercise-card-bottom">
                        {/* Dedicated Plank Hold Timer Widget */}
                        {(ex.name.toLowerCase().includes('plank') || ex.equipment.includes('Sekunden')) && (
                          <div className="plank-timer-box">
                            {activePlankTimer?.exerciseId === ex.id ? (
                              <div className="plank-timer-active">
                                <Timer size={16} className="animate-spin" style={{ color: '#f59e0b' }} />
                                <span className="plank-time-text">
                                  Plank: {activePlankTimer.secondsLeft}s
                                </span>
                                <button 
                                  onClick={() => setActivePlankTimer(null)}
                                  className="plank-close-btn"
                                  title="Stoppen"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="plank-start-btn"
                                onClick={() => startPlankTimer(ex.id, ex.reps)}
                              >
                                <Play size={14} /> Plank ({ex.reps}s) halten
                              </button>
                            )}
                          </div>
                        )}

                        {/* Set Checkboxes Row */}
                        <div className="sets-row">
                          <span className="sets-label">Sätze:</span>
                          <div className="sets-checkbox-group">
                            {Array.from({ length: ex.sets }).map((_, setIdx) => {
                              const isChecked = setIdx < completed;
                              return (
                                <button
                                  key={setIdx}
                                  type="button"
                                  onClick={() => toggleSet(ex.id, setIdx)}
                                  className={`set-box ${isChecked ? 'checked' : ''}`}
                                  title={`Satz ${setIdx + 1} markieren`}
                                >
                                  <span className="set-box-num">{setIdx + 1}</span>
                                  {isChecked && <Check size={12} className="check-icon" strokeWidth={3} color="#ffffff" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
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

      {/* Motivations Workout Completed Popup Modal */}
      {showCompletionModal && (
        <div className="modal-overlay" onClick={() => setShowCompletionModal(false)} style={{ zIndex: 10000 }}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{
            maxWidth: '500px',
            width: '90%',
            padding: '32px 24px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(24, 24, 32, 0.98) 0%, rgba(18, 18, 22, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            border: '2px solid #22c55e',
            boxShadow: '0 0 50px rgba(34, 197, 94, 0.4)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.2)',
              border: '2px solid #22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: '#22c55e',
              boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)'
            }}>
              <Trophy size={36} />
            </div>

            <h2 style={{ color: '#fff', fontSize: '1.6rem', fontWeight: '900', margin: '0 0 8px 0', textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>
              WORKOUT VOLLENDET! 🎉
            </h2>
            <p style={{ color: '#22c55e', fontSize: '0.95rem', fontWeight: 'bold', margin: '0 0 20px 0' }}>
              V-Shape Disziplin bewiesen! 🦾🔥
            </p>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              background: 'rgba(0,0,0,0.4)',
              padding: '16px',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.08)',
              marginBottom: '20px'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Trainingszeit</span>
                <strong style={{ fontSize: '1.2rem', color: '#fff' }}>{completionStats?.durationStr || '0:00'}</strong>
              </div>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '20px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Absolvierte Sätze</span>
                <strong style={{ fontSize: '1.2rem', color: '#22c55e' }}>{completionStats?.totalSetsDone} / {completionStats?.totalSetsTarget}</strong>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: '24px', lineHeight: '1.5' }}>
              "Der Schmerz von heute ist die Stärke von morgen. Dein V-Shape Ziel ist wieder ein Stück näher gerückt!"
            </p>

            <button
              className="btn-primary"
              onClick={() => setShowCompletionModal(false)}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Sparkles size={18} /> STARK AMIGO! 🚀
            </button>
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

      {/* KFA Levels Pop-Up Modal */}
      {showKfaLevelsModal && (
        <div className="modal-overlay" onClick={() => setShowKfaLevelsModal(false)} style={{ zIndex: 10000 }}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{
            maxWidth: '480px',
            width: '90%',
            padding: '24px',
            borderRadius: '20px',
            background: 'rgba(18, 18, 26, 0.96)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--heroui-violet)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame size={22} style={{ color: 'var(--heroui-violet-light)' }} />
                <h3 style={{ color: '#fff', fontSize: '1.2rem', margin: 0, fontWeight: 'bold' }}>
                  KFA Zonen & Einordnung 🎯
                </h3>
              </div>
              <button 
                className="action-btn" 
                onClick={() => setShowKfaLevelsModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', padding: '6px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Tippe auf eine beliebige Farbe der Skala, um deine Einordnung einzusehen:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {[
                { label: 'Essentiell', range: '2–5%', color: '#eab308', desc: 'Überlebenswichtiges Grundfett' },
                { label: 'Athlet (V-Shape)', range: '6–13%', color: '#22c55e', desc: 'Optimaler Bereich für V-Shape & Bauchmuskeln' },
                { label: 'Fitness', range: '14–17%', color: '#06b6d4', desc: 'Gute sportliche Definition' },
                { label: 'Durchschnitt', range: '18–24%', color: '#f97316', desc: 'Normaler, gesunder Bereich' },
                { label: 'Höher', range: '25%+', color: '#ef4444', desc: 'Reduktion empfohlen' },
              ].map((level) => {
                const metrics = calculateBodyFatMetrics();
                const isCurrent = (
                  (level.range === '2–5%' && metrics.kfa >= 2 && metrics.kfa < 6) ||
                  (level.range === '6–13%' && metrics.kfa >= 6 && metrics.kfa < 14) ||
                  (level.range === '14–17%' && metrics.kfa >= 14 && metrics.kfa < 18) ||
                  (level.range === '18–24%' && metrics.kfa >= 18 && metrics.kfa < 25) ||
                  (level.range === '25%+' && metrics.kfa >= 25)
                );

                return (
                  <div
                    key={level.label}
                    style={{
                      background: isCurrent ? `${level.color}20` : 'rgba(255, 255, 255, 0.03)',
                      border: isCurrent ? `1.5px solid ${level.color}` : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxShadow: isCurrent ? `0 0 15px ${level.color}30` : 'none'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'nowrap', marginBottom: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', minWidth: 0 }}>
                          <span style={{ fontSize: '0.85rem', color: level.color, fontWeight: '800', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {level.range}
                          </span>
                          <span style={{ fontSize: '0.88rem', color: '#fff', fontWeight: '700', whiteSpace: 'nowrap' }}>
                            {level.label}
                          </span>
                        </div>
                        {isCurrent && (
                          <span style={{
                            fontSize: '0.62rem',
                            background: level.color,
                            color: '#000',
                            fontWeight: '900',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            boxShadow: `0 2px 8px ${level.color}50`
                          }}>
                            DEIN STAND ({metrics.kfa}%)
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>
                        {level.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              className="btn-primary"
              onClick={() => setShowKfaLevelsModal(false)}
              style={{ width: '100%', padding: '12px', fontSize: '0.9rem', background: 'var(--heroui-violet)', borderRadius: '12px', fontWeight: 'bold' }}
            >
              Verstanden & Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );

}
