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
      <h3 className="section-title" style={{ fontSize: '1rem' }}><Activity className="lucide-icon" size={18} /> Emotionale Skala</h3>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.75rem', fontFamily: 'var(--font-body)' }}>
        
        {/* High Frequency */}
        <div style={{ borderLeft: '2px solid var(--accent-gold)', paddingLeft: '12px' }}>
          <div style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: '8px' }}>GUT FÜHLEN</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {highVibe.map((item, i) => (
              <li key={i} style={{ color: `rgba(201, 163, 95, ${1 - i * 0.08})` }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Low Frequency */}
        <div style={{ borderLeft: '2px solid var(--accent-crimson)', paddingLeft: '12px', marginTop: 'auto' }}>
          <div style={{ color: 'var(--accent-crimson)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: '8px' }}>SCHLECHT FÜHLEN</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {lowVibe.map((item, i) => (
              <li key={i} style={{ color: `rgba(157, 145, 128, ${1 - i * 0.04})` }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};
