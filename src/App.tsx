import { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, Edit2, Trash2, X, Hexagon, CircleDot, Shield, Waves, BookOpen, ListChecks, Lock, LogOut } from 'lucide-react';
import type { Routine, OneTimeTask, HistoryRecord } from './types';
import * as plannerApi from './services/plannerApi';
import { getTodayStr, getDateStr, calculateLevel, getHistoryGraphData, checkIsGridBroken, formatWeekdays } from './utils/habitUtils';
import { getDailyQuote } from './data/quotes';
import { useAudioDrone } from './hooks/useAudioDrone';
import { EmotionalScale } from './components/EmotionalScale';
import { WorkoutDashboard } from './components/WorkoutDashboard';
import { NutritionDashboard } from './components/NutritionDashboard';
import './index.css';

const WEEKDAYS = [
  { label: 'Mo', value: '1' },
  { label: 'Di', value: '2' },
  { label: 'Mi', value: '3' },
  { label: 'Do', value: '4' },
  { label: 'Fr', value: '5' },
  { label: 'Sa', value: '6' },
  { label: 'So', value: '7' },
];

const OATH_PHRASE = 'ich bin der disziplin verpflichtet';

// Helper to convert standard video URLs to embeddable Iframe URLs
const getEmbedUrl = (url: string) => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      let videoId = '';
      if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1);
      } else {
        videoId = urlObj.searchParams.get('v') || '';
      }
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    if (urlObj.hostname.includes('instagram.com')) {
      const baseUrl = url.split('?')[0].replace(/\/$/, '');
      return `${baseUrl}/embed`;
    }
    return url;
  } catch {
    return url;
  }
};

function App() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [oneTimeTasks, setOneTimeTasks] = useState<OneTimeTask[]>([]);
  const [history, setHistory] = useState<HistoryRecord>({});
  const { isPlaying: isDronePlaying, toggleDrone } = useAudioDrone();
  
  const [activeTab, setActiveTab] = useState<'habits' | 'workouts' | 'nutrition'>('habits');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<'routine' | 'task'>('routine');
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [editingTask, setEditingTask] = useState<OneTimeTask | null>(null);

  // Video Modal State
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);
  const [playingVideoTitle, setPlayingVideoTitle] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState<'morning' | 'evening'>('morning');
  const [mediaUrl, setMediaUrl] = useState('');
  const [weekdays, setWeekdays] = useState<string[]>([]);

  // Grimoire State
  const todayStr = getTodayStr();
  const [journalEntry, setJournalEntry] = useState(history[todayStr]?.journal || '');

  // Grid Break State
  const [isGridBroken, setIsGridBroken] = useState(false);
  const [oathInput, setOathInput] = useState('');

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('myroutine_authenticated') === 'true';
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPassword) return;
    setIsAuthenticating(true);
    setLoginError('');

    const success = await plannerApi.verifyPassword(loginPassword);
    setIsAuthenticating(false);

    if (success) {
      localStorage.setItem('myroutine_authenticated', 'true');
      localStorage.setItem('myroutine_pass', loginPassword);
      setIsAuthenticated(true);
      setLoginPassword('');
    } else {
      setLoginError('Falsches Passwort. Bitte erneut versuchen.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('myroutine_authenticated');
    setIsAuthenticated(false);
  };

  useEffect(() => {
    (async () => {
      // Server already resets stale-completed routines before returning /tasks
      const [{ routines: fetchedRoutines, oneTimeTasks: fetchedOneTimeTasks }, fetchedHistory] = await Promise.all([
        plannerApi.fetchAllTasks(),
        plannerApi.fetchHistory(),
      ]);
      setRoutines(fetchedRoutines);
      setOneTimeTasks(fetchedOneTimeTasks);
      setHistory(fetchedHistory);

      if (fetchedHistory[todayStr]?.journal) {
        setJournalEntry(fetchedHistory[todayStr].journal as string);
      }

      if (checkIsGridBroken(fetchedHistory)) {
        setIsGridBroken(true);
      }
    })();
  }, []);

  // Save history helper (persists to the shared planner backend)
  const saveHistory = async (currentRoutines: Routine[], journal?: string) => {
    const today = getTodayStr();
    const completedCount = currentRoutines.filter(r => r.completed).length;
    const totalCount = currentRoutines.length;
    const level = calculateLevel(completedCount, totalCount);
    const journalToSave = journal !== undefined ? journal : history[today]?.journal;

    setHistory(prev => ({
      ...prev,
      [today]: { date: today, completedCount, totalCount, level, journal: journalToSave },
    }));

    await plannerApi.upsertHistory(today, { completedCount, totalCount, level, journal: journalToSave });
  };

  const toggleRoutine = async (id: string) => {
    if (isGridBroken) return; // Block actions if broken
    const today = getTodayStr();
    const newRoutines = routines.map(r =>
      r.id === id ? { ...r, completed: !r.completed, lastCompletedDate: !r.completed ? today : r.lastCompletedDate } : r
    );
    setRoutines(newRoutines);
    const toggled = newRoutines.find(r => r.id === id)!;
    await plannerApi.setTaskCompleted(id, toggled.completed);
    saveHistory(newRoutines);
  };

  const toggleOneTimeTask = async (id: string) => {
    if (isGridBroken) return;
    const today = getTodayStr();
    const newTasks = oneTimeTasks.map(t =>
      t.id === id ? { ...t, completed: !t.completed, lastCompletedDate: !t.completed ? today : t.lastCompletedDate } : t
    );
    setOneTimeTasks(newTasks);
    const toggled = newTasks.find(t => t.id === id)!;
    await plannerApi.setTaskCompleted(id, toggled.completed);
  };

  const handleDeleteOneTimeTask = (id: string) => {
    if (isGridBroken) return;
    if (confirm('Aufgabe wirklich löschen?')) {
      setOneTimeTasks(oneTimeTasks.filter(t => t.id !== id));
      plannerApi.deleteTask(id);
    }
  };

  const handleJournalChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJournalEntry(text);
    saveHistory(routines, text);
  };

  const handleDeleteRoutine = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (isGridBroken) return;
    if (confirm('Dieses Ritual wirklich aus dem Grimoire löschen?')) {
      const newRoutines = routines.filter(r => r.id !== id);
      setRoutines(newRoutines);
      plannerApi.deleteTask(id);
      saveHistory(newRoutines);
    }
  };

  const toggleWeekday = (day: string) => {
    setWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const openNewRoutineModal = () => {
    if (isGridBroken) return;
    setModalKind('routine');
    setEditingRoutine(null);
    setEditingTask(null);
    setTitle('');
    setTime('08:00');
    setType('morning');
    setMediaUrl('');
    setWeekdays([]);
    setIsModalOpen(true);
  };

  const openNewTaskModal = () => {
    if (isGridBroken) return;
    setModalKind('task');
    setEditingRoutine(null);
    setEditingTask(null);
    setTitle('');
    setTime('12:00');
    setIsModalOpen(true);
  };

  const handleEditRoutine = (e: React.MouseEvent, routine: Routine) => {
    e.stopPropagation();
    if (isGridBroken) return;
    setModalKind('routine');
    setEditingRoutine(routine);
    setEditingTask(null);
    setTitle(routine.title);
    setTime(routine.time);
    setType(routine.type);
    setMediaUrl(routine.mediaUrl || '');
    setWeekdays(routine.weekdays ? routine.weekdays.split(',') : []);
    setIsModalOpen(true);
  };

  const handleEditOneTimeTask = (e: React.MouseEvent, task: OneTimeTask) => {
    e.stopPropagation();
    if (isGridBroken) return;
    setModalKind('task');
    setEditingTask(task);
    setEditingRoutine(null);
    setTitle(task.title);
    setTime(task.time);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    if (modalKind === 'task') {
      if (editingTask) {
        const updated: OneTimeTask = { ...editingTask, title, time };
        await plannerApi.updateOneTimeTask(editingTask.id, updated);
        setOneTimeTasks(oneTimeTasks.map(t => t.id === editingTask.id ? updated : t));
      } else {
        await plannerApi.createOneTimeTask({ title, time });
        const { oneTimeTasks: newTasks } = await plannerApi.fetchAllTasks();
        setOneTimeTasks(newTasks);
      }
      setIsModalOpen(false);
      return;
    }

    const weekdaysStr = weekdays.length > 0 ? [...weekdays].sort((a, b) => Number(a) - Number(b)).join(',') : undefined;

    if (editingRoutine) {
      const updated: Routine = { ...editingRoutine, title, time, type, mediaUrl, weekdays: weekdaysStr };
      await plannerApi.updateRoutine(editingRoutine.id, updated);
      const newRoutines = routines.map(r => r.id === editingRoutine.id ? updated : r);
      setRoutines(newRoutines);
      saveHistory(newRoutines);
    } else {
      await plannerApi.createRoutine({ title, time, type, mediaUrl, weekdays: weekdaysStr });
      // Worker doesn't return the new row's id, so refetch to pick it up
      const { routines: newRoutines } = await plannerApi.fetchAllTasks();
      setRoutines(newRoutines);
      saveHistory(newRoutines);
    }

    setIsModalOpen(false);
  };

  const playVideo = (e: React.MouseEvent, routine: Routine) => {
    e.stopPropagation();
    if (routine.mediaUrl) {
      setPlayingVideoUrl(getEmbedUrl(routine.mediaUrl));
      setPlayingVideoTitle(routine.title);
    }
  };

  const handleOathSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (oathInput.trim().toLowerCase() === OATH_PHRASE) {
        setIsGridBroken(false);
        // Repair grid by marking yesterday as level 1 (forgiven) so it doesn't trigger again on reload today
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getDateStr(yesterday);

        const repaired = { date: yesterdayStr, completedCount: 1, totalCount: 1, level: 1 };
        setHistory(prev => ({ ...prev, [yesterdayStr]: repaired }));
        plannerApi.upsertHistory(yesterdayStr, repaired);
      } else {
        alert('Der Schwur ist falsch. Du musst schwören: "Ich bin der Disziplin verpflichtet"');
      }
    }
  };

  const completedCount = routines.filter(r => r.completed).length;
  const totalCount = routines.length;
  const progressPercentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const circumference = 2 * Math.PI * 65;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  const graphData = getHistoryGraphData(history, 90);
  const dailyQuote = getDailyQuote(todayStr);

  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-icon-badge">
            <Lock size={28} />
          </div>
          <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '6px' }}>myroutine</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '28px' }}>
            Bitte gib dein Passwort ein, um Zugang zu erhalten.
          </p>

          {loginError && (
            <div className="login-error-alert">
              <Shield size={16} /> {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ textAlign: 'left', marginBottom: '20px' }}>
              <label htmlFor="login-pass">Master Passwort</label>
              <div className="login-password-wrapper">
                <input
                  id="login-pass"
                  type={showPassword ? 'text' : 'password'}
                  className="login-password-input"
                  placeholder="Passwort eingeben..."
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="toggle-pass-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem', marginTop: '6px' }}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? 'Überprüfe...' : 'Einloggen'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Broken Grid Overlay */}
      {isGridBroken && (
        <div className="broken-overlay">
          <h2>Das Schutzraster ist zerbrochen.</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', maxWidth: '600px', lineHeight: '1.6' }}>
            Die Disziplin wurde gebrochen. Um in Das Sanktum zurückzukehren und das Raster zu reparieren, musst du den Schwur ablegen.
            Gib genau ein: <strong>Ich bin der Disziplin verpflichtet</strong> und drücke Enter.
          </p>
          <input
            type="text"
            value={oathInput}
            onChange={(e) => setOathInput(e.target.value)}
            onKeyDown={handleOathSubmit}
            placeholder="Schwöre hier..."
            autoFocus
          />
        </div>
      )}

      <header className="top-bar">
        <div className="top-bar-inner">
          <div className="top-bar-top-row">
            <h1 className="gradient-text top-bar-title">myroutine</h1>

            <div className="top-bar-actions">
              <button
                className={`btn-secondary header-action-btn ${isDronePlaying ? 'active' : ''}`}
                onClick={toggleDrone}
                title="432Hz Aura umschalten"
              >
                <Waves size={16} />
                <span className="btn-label">{isDronePlaying ? 'Aura aktiv' : 'Aura entfachen'}</span>
              </button>
              <button className="btn-primary header-action-btn" onClick={openNewRoutineModal}>
                <span className="btn-plus">+</span>
                <span className="btn-label">Neues Ritual</span>
              </button>
              <button
                className="btn-secondary header-action-btn logout-btn"
                onClick={handleLogout}
                title="Abmelden / Sperren"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          <div className="top-bar-tabs">
            <button 
              onClick={() => setActiveTab('habits')}
              className={`top-bar-tab-btn ${activeTab === 'habits' ? 'active' : ''}`}
            >Rituale</button>
            <button 
              onClick={() => setActiveTab('workouts')}
              className={`top-bar-tab-btn ${activeTab === 'workouts' ? 'active' : ''}`}
            >Workouts</button>
            <button 
              onClick={() => setActiveTab('nutrition')}
              className={`top-bar-tab-btn ${activeTab === 'nutrition' ? 'active' : ''}`}
            >Ernährung</button>
          </div>
        </div>
      </header>

      <div className="app-container">
        {activeTab === 'habits' ? (
          <>
            {/* The Oracle Quote */}
            <div className="oracle-container">
              <p className="oracle-quote">"{dailyQuote}"</p>
            </div>

        <div className="dashboard-grid">
          <div className="dashboard-column">
            {/* Progress */}
            <div className="glass-panel" style={{ textAlign: 'center' }}>
              <h3 className="section-title" style={{ justifyContent: 'center' }}><CircleDot className="lucide-icon" size={18} /> Aufstieg</h3>
              <div className="progress-container">
                <svg className="progress-ring" viewBox="0 0 150 150">
                  <defs>
                    <linearGradient id="herouiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#7c3aed" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                  <circle className="progress-ring-circle-bg" cx="75" cy="75" r="65" strokeWidth="7" />
                  <circle
                    className="progress-ring-circle" cx="75" cy="75" r="65" strokeWidth="7"
                    strokeDasharray={circumference} style={{ strokeDashoffset }}
                  />
                </svg>
                <div className="progress-text">
                  <span className="progress-percentage">{progressPercentage}%</span>
                  <span className="progress-label">Erreicht</span>
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                {completedCount} / {totalCount} Rituale erfüllt
              </p>
            </div>

            {/* Schutzraster Graph */}
            <div className="glass-panel">
              <h3 className="section-title"><Shield className="lucide-icon" size={18} /> Schutzraster</h3>
              <div className={`habit-graph ${isGridBroken ? 'broken' : ''}`}>
                {graphData.map((level, i) => (
                  <div key={i} className="habit-day" data-level={level}></div>
                ))}
              </div>
            </div>
          </div>

          {/* Routines — each phase gets its own column, side by side */}
          {['morning', 'evening'].map(typeCategory => {
            const currentRoutines = routines.filter(r => r.type === typeCategory).sort((a, b) => a.time.localeCompare(b.time));
            return (
              <div className="dashboard-column" key={typeCategory}>
                <div className="glass-panel">
                  <h3 className="section-title">
                    <Hexagon className="lucide-icon" size={18} />
                    {typeCategory === 'morning' ? 'Morgenrituale' : 'Abendrituale'}
                  </h3>
                  <div style={{ marginTop: '16px' }}>
                    {currentRoutines.length === 0 ? <p style={{color: 'var(--text-subtle)', fontStyle: 'italic', fontSize: '0.9rem'}}>Noch keine Rituale.</p> : null}
                    {currentRoutines.map(routine => (
                      <div
                        key={routine.id}
                        className={`routine-item ${routine.completed ? 'completed' : ''}`}
                        onClick={() => toggleRoutine(routine.id)}
                      >
                        <div className="checkbox">
                          {routine.completed && <Check size={13} className="check-icon" color="#ffffff" strokeWidth={3} />}
                        </div>

                        <div className="routine-info">
                          <div className="routine-title">{routine.title}</div>
                          <div className="routine-badges">
                            <span className="badge-pill time">{routine.time}</span>
                            {routine.weekdays && <span className="badge-pill days">{formatWeekdays(routine.weekdays)}</span>}
                          </div>
                        </div>

                        <div className="routine-actions">
                          {routine.mediaUrl && (
                            <button className="action-btn" onClick={(e) => playVideo(e, routine)} title="Video ansehen">
                              <Eye size={14} />
                            </button>
                          )}
                          <button className="action-btn" onClick={(e) => handleEditRoutine(e, routine)} title="Bearbeiten"><Edit2 size={13} /></button>
                          <button className="action-btn delete" onClick={(e) => handleDeleteRoutine(e, routine.id)} title="Löschen"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* The Grimoire specifically for Evening Rites */}
                  {typeCategory === 'evening' && (
                    <div style={{ marginTop: '24px' }}>
                      <h4 className="section-title" style={{ marginBottom: '4px', fontSize: '1.05rem' }}>
                        <BookOpen className="lucide-icon" size={16} /> Grimoire
                      </h4>
                      <textarea
                        className="grimoire-textarea"
                        placeholder="Trage deine Manifestationen, Dankbarkeit oder Gedanken des Tages ein…"
                        value={journalEntry}
                        onChange={handleJournalChange}
                        disabled={isGridBroken}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* One-time tasks */}
          <div className="dashboard-column">
            <div className="glass-panel">
              <h3 className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ListChecks className="lucide-icon" size={18} /> Heutige Aufgaben
                </span>
                <button className="action-btn" onClick={openNewTaskModal} title="Neue Aufgabe" style={{ color: 'var(--heroui-violet-light)' }}>+</button>
              </h3>
              <div style={{ marginTop: '16px' }}>
                {(() => {
                  const activeTasks = oneTimeTasks.filter(t => !(t.completed && t.lastCompletedDate && t.lastCompletedDate < todayStr));
                  const sortedTasks = [...activeTasks].sort((a, b) => a.time.localeCompare(b.time));
                  if (sortedTasks.length === 0) return <p style={{color: 'var(--text-subtle)', fontStyle: 'italic', fontSize: '0.9rem'}}>Keine offenen Aufgaben.</p>;
                  
                  return sortedTasks.map(task => (
                    <div
                      key={task.id}
                      className={`routine-item ${task.completed ? 'completed' : ''}`}
                      onClick={() => toggleOneTimeTask(task.id)}
                    >
                      <div className="checkbox">
                        {task.completed && <Check size={13} className="check-icon" color="#ffffff" strokeWidth={3} />}
                      </div>

                      <div className="routine-info">
                        <div className="routine-title">{task.title}</div>
                        <div className="routine-badges">
                          <span className="badge-pill time">{task.time}</span>
                        </div>
                      </div>

                      <div className="routine-actions">
                        <button className="action-btn" onClick={(e) => handleEditOneTimeTask(e, task)} title="Bearbeiten"><Edit2 size={13} /></button>
                        <button className="action-btn delete" onClick={(e) => { e.stopPropagation(); handleDeleteOneTimeTask(task.id); }} title="Löschen"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Emotional Scale */}
          <div className="dashboard-column">
            <EmotionalScale />
          </div>
        </div>
        </>
        ) : activeTab === 'workouts' ? (
          <WorkoutDashboard />
        ) : (
          <NutritionDashboard />
        )}
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>
                {modalKind === 'task' ? 'Aufgabe bearbeiten' : editingRoutine ? 'Ritual bearbeiten' : 'Neues Ritual erschaffen'}
              </h2>
              <button className="action-btn" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>

            <div className="form-group">
              <label>Bezeichnung</label>
              <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="z. B. Meditation" autoFocus />
            </div>

            <div className="form-group">
              <label>Uhrzeit</label>
              <input type="time" className="form-input" value={time} onChange={e => setTime(e.target.value)} />
            </div>

            {modalKind === 'routine' && (
              <>
                <div className="form-group">
                  <label>Video-Link (YouTube / Instagram URL)</label>
                  <input type="url" className="form-input" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://..." />
                </div>

                <div className="form-group">
                  <label>Tageszeit</label>
                  <select className="form-select" value={type} onChange={e => setType(e.target.value as 'morning'|'evening')}>
                    <option value="morning">Morgens</option>
                    <option value="evening">Abends</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Wochentage</label>
                  <div className="day-picker">
                    {WEEKDAYS.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        className={`day-btn ${weekdays.includes(d.value) ? 'active' : ''}`}
                        onClick={() => toggleWeekday(d.value)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <p className="form-hint">Keine Auswahl = jeden Tag.</p>
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Abbrechen</button>
              <button className="btn-primary" onClick={handleSave}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {playingVideoUrl && (
        <div className="modal-overlay" onClick={() => setPlayingVideoUrl(null)}>
          <div className="glass-panel video-modal-content" onClick={e => e.stopPropagation()}>
            <div className="video-modal-header">
              <h2 style={{ color: 'var(--accent-gold)', fontSize: '1.2rem' }}>{playingVideoTitle}</h2>
              <button className="action-btn" onClick={() => setPlayingVideoUrl(null)}><X size={24} /></button>
            </div>
            <div className="video-container">
              <iframe
                src={playingVideoUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
