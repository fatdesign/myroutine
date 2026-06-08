import { useState, useEffect } from 'react';
import { Sun, Moon, Check, Flame, BarChart3, Edit2, Trash2, X } from 'lucide-react';
import { initialRoutines } from './data/mockData';
import type { Routine, HistoryRecord } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { getTodayStr, calculateLevel, getHistoryGraphData, checkAndResetRoutines } from './utils/habitUtils';
import './index.css';

function App() {
  const [routines, setRoutines] = useLocalStorage<Routine[]>('routineflow-routines', initialRoutines);
  const [history, setHistory] = useLocalStorage<HistoryRecord>('routineflow-history', {});
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState<'morning' | 'evening'>('morning');

  useEffect(() => {
    // Reset routines on mount if it's a new day
    const updated = checkAndResetRoutines(routines);
    if (updated !== routines) {
      setRoutines(updated);
    }
  }, []);

  const saveHistory = (currentRoutines: Routine[]) => {
    const today = getTodayStr();
    const completedCount = currentRoutines.filter(r => r.completed).length;
    const totalCount = currentRoutines.length;
    const level = calculateLevel(completedCount, totalCount);
    
    setHistory(prev => ({
      ...prev,
      [today]: { date: today, completedCount, totalCount, level }
    }));
  };

  const toggleRoutine = (id: string) => {
    const today = getTodayStr();
    const newRoutines = routines.map(r => 
      r.id === id ? { ...r, completed: !r.completed, lastCompletedDate: !r.completed ? today : r.lastCompletedDate } : r
    );
    setRoutines(newRoutines);
    saveHistory(newRoutines);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if(confirm('Delete this routine?')) {
      const newRoutines = routines.filter(r => r.id !== id);
      setRoutines(newRoutines);
      saveHistory(newRoutines);
    }
  };

  const handleEdit = (e: React.MouseEvent, routine: Routine) => {
    e.stopPropagation();
    setEditingRoutine(routine);
    setTitle(routine.title);
    setTime(routine.time);
    setType(routine.type);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingRoutine(null);
    setTitle('');
    setTime('08:00');
    setType('morning');
    setIsModalOpen(true);
  };

  const saveRoutine = () => {
    if (!title.trim()) return;

    let newRoutines;
    if (editingRoutine) {
      newRoutines = routines.map(r => r.id === editingRoutine.id ? { ...r, title, time, type } : r);
    } else {
      const newRoutine: Routine = {
        id: Date.now().toString(),
        title,
        time,
        type,
        completed: false
      };
      newRoutines = [...routines, newRoutine];
    }
    
    setRoutines(newRoutines);
    saveHistory(newRoutines); // Recalculate history since totalCount changed
    setIsModalOpen(false);
  };

  const completedCount = routines.filter(r => r.completed).length;
  const totalCount = routines.length;
  const progressPercentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  
  const circumference = 2 * Math.PI * 65; 
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  const graphData = getHistoryGraphData(history, 90);

  return (
    <div className="app-container">
      <header>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '2.5rem' }}>RoutineFlow</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back, limit pushers!</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn-primary" onClick={openNewModal}>+ New Habit</button>
        </div>
      </header>

      {/* Grid ... */}
      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* Progress */}
          <div className="glass-panel">
            <h3 className="section-title"><Flame className="lucide-icon" /> Daily Progress</h3>
            <div className="progress-container">
              <svg className="progress-ring" viewBox="0 0 150 150">
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent-blue)" />
                    <stop offset="100%" stopColor="var(--accent-purple)" />
                  </linearGradient>
                </defs>
                <circle className="progress-ring-circle-bg" cx="75" cy="75" r="65" strokeWidth="12" />
                <circle 
                  className="progress-ring-circle" cx="75" cy="75" r="65" strokeWidth="12"
                  strokeDasharray={circumference} style={{ strokeDashoffset }}
                />
              </svg>
              <div className="progress-text">
                <span className="progress-percentage">{progressPercentage}%</span>
                <span className="progress-label">Completed</span>
              </div>
            </div>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              {completedCount} of {totalCount} routines done
            </p>
          </div>

          {/* Graph */}
          <div className="glass-panel">
            <h3 className="section-title"><BarChart3 className="lucide-icon" /> Habit Streaks</h3>
            <div className="habit-graph">
              {graphData.map((level, i) => (
                <div key={i} className="habit-day" data-level={level}></div>
              ))}
            </div>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>90 Days</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Less</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div className="habit-day" data-level="0" style={{ width: '12px', height: '12px' }}></div>
                  <div className="habit-day" data-level="1" style={{ width: '12px', height: '12px' }}></div>
                  <div className="habit-day" data-level="2" style={{ width: '12px', height: '12px' }}></div>
                  <div className="habit-day" data-level="3" style={{ width: '12px', height: '12px' }}></div>
                  <div className="habit-day" data-level="4" style={{ width: '12px', height: '12px' }}></div>
                </div>
                <span>More</span>
              </div>
            </div>
          </div>
        </div>

        {/* Routines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {['morning', 'evening'].map(typeCategory => {
            const currentRoutines = routines.filter(r => r.type === typeCategory);
            return (
              <div className="glass-panel" key={typeCategory}>
                <h3 className="section-title" style={{textTransform: 'capitalize'}}>
                  {typeCategory === 'morning' ? <Sun className="lucide-icon" /> : <Moon className="lucide-icon" />} 
                  {typeCategory} Routine
                </h3>
                <div>
                  {currentRoutines.length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No routines yet.</p> : null}
                  {currentRoutines.map(routine => (
                    <div 
                      key={routine.id} 
                      className={`routine-item ${routine.completed ? 'completed' : ''}`}
                      onClick={() => toggleRoutine(routine.id)}
                    >
                      <div className="checkbox">
                        {routine.completed && <Check size={16} color="var(--bg-color)" />}
                      </div>
                      <div className="routine-info">
                        <div className="routine-title">{routine.title}</div>
                        <div className="routine-time">{routine.time}</div>
                      </div>
                      <div className="routine-actions">
                        <button className="action-btn" onClick={(e) => handleEdit(e, routine)}><Edit2 size={16} /></button>
                        <button className="action-btn delete" onClick={(e) => handleDelete(e, routine.id)}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>{editingRoutine ? 'Edit Routine' : 'New Routine'}</h2>
              <button className="action-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            
            <div className="form-group">
              <label>Title</label>
              <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Read 10 pages" autoFocus />
            </div>
            
            <div className="form-group">
              <label>Time (Optional)</label>
              <input type="time" className="form-input" value={time} onChange={e => setTime(e.target.value)} />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value as 'morning'|'evening')}>
                <option value="morning">Morning Routine</option>
                <option value="evening">Evening Routine</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveRoutine}>Save Routine</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
