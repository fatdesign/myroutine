import { useState, useEffect } from 'react';
import { Sun, Moon, Check, Zap, Flame, BarChart3 } from 'lucide-react';
import { initialRoutines, generateHabitData, type Routine } from './data/mockData';
import './index.css';

function App() {
  const [routines, setRoutines] = useState<Routine[]>(initialRoutines);
  const [habitData, setHabitData] = useState<number[]>([]);
  
  useEffect(() => {
    setHabitData(generateHabitData());
  }, []);

  const toggleRoutine = (id: string) => {
    setRoutines(prev => prev.map(r => 
      r.id === id ? { ...r, completed: !r.completed } : r
    ));
  };

  const completedCount = routines.filter(r => r.completed).length;
  const progressPercentage = Math.round((completedCount / routines.length) * 100) || 0;
  
  const circumference = 2 * Math.PI * 65; // radius 65
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  return (
    <div className="app-container">
      <header>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '2.5rem' }}>RoutineFlow</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back, limit pushers!</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn-icon"><Zap size={20} /></button>
          <button className="btn-primary">New Habit</button>
        </div>
      </header>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* Progress Widget */}
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
                <circle 
                  className="progress-ring-circle-bg" 
                  cx="75" cy="75" r="65" strokeWidth="12"
                />
                <circle 
                  className="progress-ring-circle" 
                  cx="75" cy="75" r="65" strokeWidth="12"
                  strokeDasharray={circumference}
                  style={{ strokeDashoffset }}
                />
              </svg>
              <div className="progress-text">
                <span className="progress-percentage">{progressPercentage}%</span>
                <span className="progress-label">Completed</span>
              </div>
            </div>
            
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              {completedCount} of {routines.length} routines done
            </p>
          </div>

          {/* Habit Graph */}
          <div className="glass-panel">
            <h3 className="section-title"><BarChart3 className="lucide-icon" /> Habit Streaks</h3>
            <div className="habit-graph">
              {habitData.map((level, i) => (
                <div key={i} className="habit-day" data-level={level} title={`Activity level: ${level}`}></div>
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

        {/* Routines List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div className="glass-panel">
            <h3 className="section-title"><Sun className="lucide-icon" /> Morning Routine</h3>
            <div>
              {routines.filter(r => r.type === 'morning').map(routine => (
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
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel">
            <h3 className="section-title"><Moon className="lucide-icon" /> Evening Routine</h3>
            <div>
              {routines.filter(r => r.type === 'evening').map(routine => (
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
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
