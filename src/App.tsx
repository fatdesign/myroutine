import { useState, useEffect } from 'react';
import { Eye, Check, Edit2, Trash2, X, Hexagon, CircleDot, Shield, Waves, BookOpen } from 'lucide-react';
import { initialRoutines } from './data/mockData';
import type { Routine, HistoryRecord } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { getTodayStr, calculateLevel, getHistoryGraphData, checkAndResetRoutines, checkIsGridBroken } from './utils/habitUtils';
import { getDailyQuote } from './data/quotes';
import { useAudioDrone } from './hooks/useAudioDrone';
import { EmotionalScale } from './components/EmotionalScale';
import './index.css';

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
  } catch (e) {
    return url;
  }
};

function App() {
  const [routines, setRoutines] = useLocalStorage<Routine[]>('routineflow-routines', initialRoutines);
  const [history, setHistory] = useLocalStorage<HistoryRecord>('routineflow-history', {});
  const { isPlaying: isDronePlaying, toggleDrone } = useAudioDrone();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  
  // Video Modal State
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);
  const [playingVideoTitle, setPlayingVideoTitle] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState<'morning' | 'evening'>('morning');
  const [mediaUrl, setMediaUrl] = useState('');

  // Grimoire State
  const todayStr = getTodayStr();
  const [journalEntry, setJournalEntry] = useState(history[todayStr]?.journal || '');

  // Grid Break State
  const [isGridBroken, setIsGridBroken] = useState(false);
  const [oathInput, setOathInput] = useState('');

  useEffect(() => {
    // 1. Reset Routines if new day
    const updated = checkAndResetRoutines(routines);
    if (updated !== routines) {
      setRoutines(updated);
    }
    
    // 2. Load today's journal
    if (history[todayStr]?.journal) {
      setJournalEntry(history[todayStr].journal as string);
    }

    // 3. Check Price of Failure
    if (checkIsGridBroken(history)) {
      setIsGridBroken(true);
    }
  }, []);

  // Save history helper
  const saveHistory = (currentRoutines: Routine[], journal?: string) => {
    const today = getTodayStr();
    const completedCount = currentRoutines.filter(r => r.completed).length;
    const totalCount = currentRoutines.length;
    const level = calculateLevel(completedCount, totalCount);
    
    setHistory(prev => ({
      ...prev,
      [today]: { 
        ...prev[today],
        date: today, 
        completedCount, 
        totalCount, 
        level,
        journal: journal !== undefined ? journal : prev[today]?.journal 
      }
    }));
  };

  const toggleRoutine = (id: string) => {
    if (isGridBroken) return; // Block actions if broken
    const today = getTodayStr();
    const newRoutines = routines.map(r => 
      r.id === id ? { ...r, completed: !r.completed, lastCompletedDate: !r.completed ? today : r.lastCompletedDate } : r
    );
    setRoutines(newRoutines);
    saveHistory(newRoutines);
  };

  const handleJournalChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJournalEntry(text);
    saveHistory(routines, text);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (isGridBroken) return;
    if(confirm('Erase this ritual from the grimoire?')) {
      const newRoutines = routines.filter(r => r.id !== id);
      setRoutines(newRoutines);
      saveHistory(newRoutines);
    }
  };

  const handleEdit = (e: React.MouseEvent, routine: Routine) => {
    e.stopPropagation();
    if (isGridBroken) return;
    setEditingRoutine(routine);
    setTitle(routine.title);
    setTime(routine.time);
    setType(routine.type);
    setMediaUrl(routine.mediaUrl || '');
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    if (isGridBroken) return;
    setEditingRoutine(null);
    setTitle('');
    setTime('08:00');
    setType('morning');
    setMediaUrl('');
    setIsModalOpen(true);
  };

  const saveRoutine = () => {
    if (!title.trim()) return;

    let newRoutines;
    if (editingRoutine) {
      newRoutines = routines.map(r => r.id === editingRoutine.id ? { ...r, title, time, type, mediaUrl } : r);
    } else {
      const newRoutine: Routine = {
        id: Date.now().toString(),
        title,
        time,
        type,
        mediaUrl,
        completed: false
      };
      newRoutines = [...routines, newRoutine];
    }
    
    setRoutines(newRoutines);
    saveHistory(newRoutines);
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
      if (oathInput.trim().toLowerCase() === 'i am bound by discipline') {
        setIsGridBroken(false);
        // Repair grid by marking yesterday as level 1 (forgiven) so it doesn't trigger again on reload today
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        setHistory(prev => ({
          ...prev,
          [yesterdayStr]: {
            date: yesterdayStr,
            completedCount: 1, // Fake count to pass the check
            totalCount: 1,
            level: 1 // Lowest positive level
          }
        }));
      } else {
        alert('The oath is incorrect. You must vow: "I am bound by discipline"');
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

  return (
    <div className="app-container">
      {/* Broken Grid Overlay */}
      {isGridBroken && (
        <div className="broken-overlay">
          <h2>The Protection Grid is Fractured.</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', maxWidth: '600px', lineHeight: '1.6' }}>
            Discipline was compromised. To re-enter The Sanctum and repair the grid, you must swear the oath. 
            Type exactly: <strong>I am bound by discipline</strong> and press Enter.
          </p>
          <input 
            type="text" 
            value={oathInput} 
            onChange={(e) => setOathInput(e.target.value)} 
            onKeyDown={handleOathSubmit}
            placeholder="Type your oath..."
            autoFocus
          />
        </div>
      )}

      <header>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '2.5rem' }}>The Sanctum</h1>
          <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Discipline is the ultimate protector.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button 
            className="btn-secondary" 
            onClick={toggleDrone} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: isDronePlaying ? 'var(--accent-gold)' : 'var(--border-color)', color: isDronePlaying ? 'var(--accent-gold)' : 'var(--text-secondary)' }}
            title="Toggle 432Hz Aura"
          >
            <Waves size={18} /> {isDronePlaying ? 'Aura Active' : 'Ignite Aura'}
          </button>
          <button className="btn-primary" onClick={openNewModal}>Forge Ritual</button>
        </div>
      </header>

      {/* The Oracle */}
      <div className="oracle-container glass-panel">
        <p className="oracle-quote">"{dailyQuote}"</p>
      </div>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          
          {/* Progress */}
          <div className="glass-panel" style={{ textAlign: 'center' }}>
            <h3 className="section-title" style={{ justifyContent: 'center' }}><CircleDot className="lucide-icon" size={20} /> Ascension</h3>
            <div className="progress-container">
              <svg className="progress-ring" viewBox="0 0 150 150">
                <circle className="progress-ring-circle-bg" cx="75" cy="75" r="65" strokeWidth="6" />
                <circle 
                  className="progress-ring-circle" cx="75" cy="75" r="65" strokeWidth="6"
                  strokeDasharray={circumference} style={{ strokeDashoffset }}
                />
              </svg>
              <div className="progress-text">
                <span className="progress-percentage">{progressPercentage}%</span>
                <span className="progress-label">Manifested</span>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-heading)' }}>
              {completedCount} / {totalCount} Rites Completed
            </p>
          </div>

          {/* Graph */}
          <div className="glass-panel">
            <h3 className="section-title"><Shield className="lucide-icon" size={20} /> Protection Grid</h3>
            <div className={`habit-graph ${isGridBroken ? 'broken' : ''}`}>
              {graphData.map((level, i) => (
                <div key={i} className="habit-day" data-level={level}></div>
              ))}
            </div>
          </div>
        </div>

        {/* Routines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {['morning', 'evening'].map(typeCategory => {
            const currentRoutines = routines.filter(r => r.type === typeCategory);
            return (
              <div className="glass-panel" key={typeCategory}>
                <h3 className="section-title">
                  <Hexagon className="lucide-icon" size={20} /> 
                  {typeCategory === 'morning' ? 'Awakening Rites' : 'Dusk Rites'}
                </h3>
                <div style={{ marginTop: '20px' }}>
                  {currentRoutines.length === 0 ? <p style={{color: 'var(--text-secondary)', fontStyle: 'italic'}}>Silence remains.</p> : null}
                  {currentRoutines.map(routine => (
                    <div 
                      key={routine.id} 
                      className={`routine-item ${routine.completed ? 'completed' : ''}`}
                      onClick={() => toggleRoutine(routine.id)}
                    >
                      <div className="checkbox">
                        {routine.completed && <Check size={14} className="check-icon" color="var(--bg-color)" strokeWidth={3} />}
                      </div>
                      
                      <div className="routine-info">
                        <div className="routine-title">{routine.title}</div>
                        <div className="routine-time">{routine.time}</div>
                      </div>

                      <div className="routine-actions">
                        {routine.mediaUrl && (
                          <button className="action-btn" onClick={(e) => playVideo(e, routine)} title="View Vision">
                            <Eye size={18} />
                          </button>
                        )}
                        <button className="action-btn" onClick={(e) => handleEdit(e, routine)} title="Alter"><Edit2 size={16} /></button>
                        <button className="action-btn delete" onClick={(e) => handleDelete(e, routine.id)} title="Erase"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* The Grimoire specifically for Evening Rites */}
                {typeCategory === 'evening' && (
                  <div style={{ marginTop: '30px' }}>
                    <h4 style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BookOpen size={16} /> The Grimoire
                    </h4>
                    <textarea 
                      className="grimoire-textarea"
                      placeholder="Transcribe your manifestations, gratitude, or reflections of the day..."
                      value={journalEntry}
                      onChange={handleJournalChange}
                      disabled={isGridBroken}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Emotional Scale */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <EmotionalScale />
        </div>
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: 'var(--accent-gold)' }}>{editingRoutine ? 'Alter Ritual' : 'Forge New Ritual'}</h2>
              <button className="action-btn" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            
            <div className="form-group">
              <label>Incantation (Title)</label>
              <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Sphinx Pose" autoFocus />
            </div>
            
            <div className="form-group">
              <label>Hour of Alignment (Time)</label>
              <input type="time" className="form-input" value={time} onChange={e => setTime(e.target.value)} />
            </div>

            <div className="form-group">
              <label>Vision Link (YouTube / Instagram URL)</label>
              <input type="url" className="form-input" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://..." />
            </div>

            <div className="form-group">
              <label>Phase</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value as 'morning'|'evening')}>
                <option value="morning">Awakening (Morning)</option>
                <option value="evening">Dusk (Evening)</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Abandon</button>
              <button className="btn-primary" onClick={saveRoutine}>Seal Ritual</button>
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
