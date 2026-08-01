import { useState, useEffect } from 'react';
import { WORKOUT_PLAN } from '../data/workouts';
import { getTodayStr, getDateStr } from '../utils/habitUtils';
import { fetchWorkoutHistory, upsertWorkoutHistory, fetchWorkoutSessions, upsertWorkoutSession, uploadImage } from '../services/plannerApi';
import type { WorkoutHistoryRecord, WorkoutSessionRecord, WorkoutSession } from '../types';
import { Check, Dumbbell, Timer, Flame, CalendarDays, Activity, Play, StopCircle, Upload, Weight, Camera, X } from 'lucide-react';

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
  const [calcHeight, setCalcHeight] = useState<string>('');
  const [calcNeck, setCalcNeck] = useState<string>('');
  const [calcWaist, setCalcWaist] = useState<string>('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const calculateNavyKfa = () => {
    const h = parseFloat(calcHeight);
    const n = parseFloat(calcNeck);
    const w = parseFloat(calcWaist);
    if (h > 0 && n > 0 && w > n) {
      const kfa = 86.010 * Math.log10(w - n) - 70.041 * Math.log10(h) + 36.76;
      if (kfa > 2 && kfa < 50) {
        setBodyFatInput(kfa.toFixed(1));
        setShowKfaCalc(false);
      }
    }
  };

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
        gain.gain.setValueAtTime(0.3, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);
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

  // Timer State
  const [isTimerActive, setIsTimerActive] = useState<boolean>(() => {
    return localStorage.getItem('myroutine_timer_active') === 'true';
  });
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(() => {
    const saved = localStorage.getItem('myroutine_timer_start');
    return saved ? Number(saved) : null;
  });
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const todayStr = getTodayStr();

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
                  <input type="number" placeholder="Größe cm" className="form-input" style={{ fontSize: '0.75rem', padding: '6px' }} value={calcHeight} onChange={e => setCalcHeight(e.target.value)} />
                  <input type="number" placeholder="Nacken cm" className="form-input" style={{ fontSize: '0.75rem', padding: '6px' }} value={calcNeck} onChange={e => setCalcNeck(e.target.value)} />
                  <input type="number" placeholder="Bauch cm" className="form-input" style={{ fontSize: '0.75rem', padding: '6px' }} value={calcWaist} onChange={e => setCalcWaist(e.target.value)} />
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
