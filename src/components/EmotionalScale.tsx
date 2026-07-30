import { Activity, Smile, Frown } from 'lucide-react';

export const EmotionalScale = () => {
  const highVibe = [
    "1. Freude / Wertschätzung / Liebe",
    "2. Passion",
    "3. Begeisterung / Eifer / Glück",
    "4. Optimismus",
    "5. Positive Erwartungshaltung",
    "6. Hoffnung",
    "7. Zufriedenheit"
  ];

  const lowVibe = [
    "8. Langeweile",
    "9. Pessimismus",
    "10. Frustration / Ungeduld",
    "11. Überwältigung",
    "12. Enttäuschung",
    "13. Zweifel",
    "14. Sorge",
    "15. Schuld",
    "16. Entmutigung",
    "17. Wut",
    "18. Rache",
    "19. Hass",
    "20. Eifersucht",
    "21. Unsicherheit / Wertlosigkeit",
    "22. Angst / Verzweiflung / Ohnmacht"
  ];

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3 className="section-title">
        <Activity className="lucide-icon" size={18} /> Emotionale Skala
      </h3>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '0.8rem', fontFamily: 'var(--font-sans)' }}>
        
        {/* High Frequency - Emerald / Cyan Theme */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.06)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '14px',
          padding: '14px'
        }}>
          <div style={{
            color: '#10b981',
            fontWeight: '700',
            fontSize: '0.78rem',
            letterSpacing: '0.06em',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Smile size={14} /> GUT FÜHLEN
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {highVibe.map((item, i) => (
              <li key={i} style={{ color: `rgba(16, 185, 129, ${1 - i * 0.08})`, fontWeight: i === 0 ? '600' : '400' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Low Frequency - Rose / Amber Theme */}
        <div style={{
          background: 'rgba(244, 63, 94, 0.06)',
          border: '1px solid rgba(244, 63, 94, 0.2)',
          borderRadius: '14px',
          padding: '14px'
        }}>
          <div style={{
            color: '#f43f5e',
            fontWeight: '700',
            fontSize: '0.78rem',
            letterSpacing: '0.06em',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Frown size={14} /> SCHLECHT FÜHLEN
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {lowVibe.map((item, i) => (
              <li key={i} style={{ color: `rgba(161, 161, 170, ${1 - i * 0.035})` }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};
