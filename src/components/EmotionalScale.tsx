import { Activity } from 'lucide-react';

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
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '0.78rem', fontFamily: 'var(--font-body)' }}>
        
        {/* High Frequency */}
        <div style={{ borderLeft: '2px solid var(--text-gold)', paddingLeft: '14px' }}>
          <div style={{ color: 'var(--text-gold)', fontFamily: 'var(--font-body)', fontWeight: '700', fontSize: '0.8rem', letterSpacing: '0.08em', marginBottom: '10px' }}>
            GUT FÜHLEN
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {highVibe.map((item, i) => (
              <li key={i} style={{ color: `rgba(223, 183, 108, ${1 - i * 0.07})`, fontWeight: i === 0 ? '600' : '400' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Low Frequency */}
        <div style={{ borderLeft: '2px solid #852f23', paddingLeft: '14px', marginTop: '4px' }}>
          <div style={{ color: '#b54333', fontFamily: 'var(--font-body)', fontWeight: '700', fontSize: '0.8rem', letterSpacing: '0.08em', marginBottom: '10px' }}>
            SCHLECHT FÜHLEN
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {lowVibe.map((item, i) => (
              <li key={i} style={{ color: `rgba(140, 115, 105, ${1 - i * 0.035})` }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};
