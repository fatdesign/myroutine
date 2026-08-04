import React, { useState, useMemo } from 'react';
import { Calendar, Activity, Weight, Flame, TrendingDown } from 'lucide-react';
import type { WorkoutSessionRecord } from '../types';

interface WeightHistogramProps {
  sessions: WorkoutSessionRecord;
}

export const WeightHistogram: React.FC<WeightHistogramProps> = ({ sessions }) => {
  // Current month string "YYYY-MM" (e.g. "2026-08")
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  // Today's full date string "YYYY-MM-DD"
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [hoveredDay, setHoveredDay] = useState<{ dayNum: number; dateStr: string; weight: number; kfa: number | null } | null>(null);

  // Extract distinct months that have bodyWeight or bodyFat data
  const dbMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    Object.values(sessions).forEach(session => {
      if (session.bodyWeight || session.bodyFat) {
        const monthPrefix = session.date.substring(0, 7); // YYYY-MM
        monthsSet.add(monthPrefix);
      }
    });
    return Array.from(monthsSet);
  }, [sessions]);

  // Generate list of available months (ONLY months with data + current month)
  const monthOptions = useMemo(() => {
    const setOfMonths = new Set<string>([currentMonthStr, ...dbMonths]);
    const sortedMonths = Array.from(setOfMonths).sort((a, b) => b.localeCompare(a));

    return sortedMonths.map(val => {
      const [year, monthNum] = val.split('-').map(Number);
      const d = new Date(year, monthNum - 1, 1);
      const label = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      return {
        value: val,
        label: label.charAt(0).toUpperCase() + label.slice(1)
      };
    });
  }, [dbMonths, currentMonthStr]);

  // Number of days in selected month
  const daysInMonth = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  }, [selectedMonth]);

  // Build daily data for the selected month (carrying forward last known weight)
  const chartPoints = useMemo(() => {
    const allDates = Object.keys(sessions).sort();
    let currentWeight = 0;
    
    // Find last known weight BEFORE or ON the first of the selected month
    for (const d of allDates) {
      if (d < `${selectedMonth}-01` && sessions[d].bodyWeight) {
        currentWeight = sessions[d].bodyWeight;
      }
    }

    // If still 0, find the FIRST weight in this month to use as baseline
    if (currentWeight === 0) {
      for (let day = 1; day <= daysInMonth; day++) {
         const d = `${selectedMonth}-${String(day).padStart(2, '0')}`;
         if (sessions[d]?.bodyWeight) {
            currentWeight = sessions[d].bodyWeight;
            break;
         }
      }
    }

    const points = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${selectedMonth}-${dayStr}`;
      
      const session = sessions[dateKey];
      const hasActualData = !!(session && session.bodyWeight);
      
      if (hasActualData) {
        currentWeight = session.bodyWeight!;
      }

      points.push({
        dayNum: day,
        dateStr: dateKey,
        weight: currentWeight,
        hasActualData,
        kfa: session?.bodyFat || null,
        session
      });
    }

    return points;
  }, [sessions, selectedMonth, daysInMonth]);

  // SVG Chart Dimensions
  const chartWidth = 760;
  const chartHeight = 220;
  const paddingLeft = 40;
  const paddingTop = 40;
  const totalSvgWidth = chartWidth + paddingLeft + 30;
  const totalSvgHeight = chartHeight + paddingTop + 40;

  const yDomain = useMemo(() => {
    const weights = chartPoints.map(p => p.weight).filter(w => w > 0);
    if (weights.length === 0) return { min: 0, max: 100, range: 100 };
    
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const padding = (maxW - minW) * 0.4 || 2; // Add padding to top and bottom, or 2kg if constant
    
    return {
      min: Math.max(0, minW - padding),
      max: maxW + padding,
      range: (maxW + padding) - Math.max(0, minW - padding) || 10
    };
  }, [chartPoints]);

  const svgPoints = useMemo(() => {
    return chartPoints.map(pt => {
      const x = paddingLeft + ((pt.dayNum - 1) / Math.max(1, daysInMonth - 1)) * chartWidth;
      const y = pt.weight > 0 ? paddingTop + chartHeight - ((pt.weight - yDomain.min) / yDomain.range) * chartHeight : paddingTop + chartHeight;
      return { ...pt, x, y };
    });
  }, [chartPoints, daysInMonth, yDomain]);

  // Build SVG Path strings (Line & Area under curve)
  const linePathD = useMemo(() => {
    if (svgPoints.length === 0) return '';
    return svgPoints.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x} ${pt.y}`;
      // Smooth curve interpolation
      const prev = svgPoints[idx - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, '');
  }, [svgPoints]);

  const areaPathD = useMemo(() => {
    if (svgPoints.length === 0) return '';
    const firstX = svgPoints[0].x;
    const lastX = svgPoints[svgPoints.length - 1].x;
    const bottomY = paddingTop + chartHeight;
    return `${linePathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePathD, svgPoints, chartHeight]);

  // Selected Date Display Label (German format)
  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
  }, [selectedDate]);

  const selectedDayData = useMemo(() => {
    return svgPoints.find(p => p.dateStr === selectedDate) || svgPoints[0];
  }, [selectedDate, svgPoints]);

  // Compute Delta for the selected day
  const deltaInfo = useMemo(() => {
    if (!selectedDayData) return null;
    const allDates = Object.keys(sessions).filter(d => sessions[d].bodyWeight).sort();
    const currIdx = allDates.indexOf(selectedDate);
    if (currIdx > 0) {
      const prevDate = allDates[currIdx - 1];
      const prevWeight = sessions[prevDate].bodyWeight;
      const currWeight = sessions[selectedDate]?.bodyWeight;
      if (prevWeight && currWeight) {
        const diff = (currWeight - prevWeight).toFixed(1);
        return Number(diff) > 0 ? `+${diff}` : `${diff}`;
      }
    }
    return null;
  }, [selectedDate, sessions, selectedDayData]);

  return (
    <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.35)', background: 'linear-gradient(180deg, rgba(20, 24, 20, 0.7) 0%, rgba(12, 16, 12, 0.85) 100%)', marginTop: '20px' }}>
      
      {/* Top Controls Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '12px', color: 'var(--heroui-emerald)', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
            <TrendingDown size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Monats-Körpergewicht Histogramm
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Klicke auf einen Tag im Diagramm, um rechts die Messwerte einzusehen.
            </p>
          </div>
        </div>

        {/* Month Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} style={{ color: 'var(--heroui-emerald)' }} /> Monat wählen:
          </label>
          <select
            className="form-input"
            value={selectedMonth}
            onChange={e => {
              setSelectedMonth(e.target.value);
              // Set selected date to 1st of that month or today if current month
              if (e.target.value === currentMonthStr) {
                setSelectedDate(todayStr);
              } else {
                setSelectedDate(`${e.target.value}-01`);
              }
            }}
            style={{
              padding: '8px 14px',
              fontSize: '0.88rem',
              fontWeight: 'bold',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#fff',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '10px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value} style={{ background: 'var(--bg-dark)' }}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Left Chart + Right Details */}
      <div className="nutrition-grid" style={{ gap: '20px', alignItems: 'stretch' }}>
        
        {/* LEFT: SVG Line Chart / Histogram Box */}
        <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
          
          {/* Chart Header Stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '3px', background: 'var(--heroui-emerald)' }} /> Körpergewicht</span>
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative', minHeight: '260px' }}>
            <svg viewBox={`0 0 ${totalSvgWidth} ${totalSvgHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(16, 185, 129, 0.45)" />
                  <stop offset="100%" stopColor="rgba(16, 185, 129, 0.0)" />
                </linearGradient>
                <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Y-Axis Grid Lines & Labels */}
              {[1, 0.75, 0.5, 0.25, 0].map((ratio) => {
                const y = paddingTop + chartHeight * (1 - ratio);
                const val = (yDomain.min + yDomain.range * ratio).toFixed(1);
                return (
                  <g key={`y-grid-${ratio}`}>
                    <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="4 4" />
                    <text x={paddingLeft - 10} y={y + 4} fill="var(--text-muted)" fontSize="11" textAnchor="end" fontFamily="sans-serif">
                      {val} kg
                    </text>
                  </g>
                );
              })}

              {/* Data Area & Line */}
              {svgPoints.length > 0 && (
                <>
                  <path d={areaPathD} fill="url(#weightAreaGrad)" />
                  <path d={linePathD} fill="none" stroke="var(--heroui-emerald)" strokeWidth="3" filter="url(#glowGreen)" />
                </>
              )}

              {/* Data Points */}
              {svgPoints.map((pt, idx) => {
                const isSelected = pt.dateStr === selectedDate;
                const isReal = pt.hasActualData;
                
                return (
                  <g 
                    key={`pt-${idx}`}
                    onMouseEnter={() => setHoveredDay(pt)}
                    onMouseLeave={() => setHoveredDay(null)}
                    onClick={() => setSelectedDate(pt.dateStr)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Vertical guideline on hover/selection */}
                    {(isSelected || (hoveredDay && hoveredDay.dayNum === pt.dayNum)) && (
                      <line x1={pt.x} y1={paddingTop} x2={pt.x} y2={paddingTop + chartHeight} stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="2 2" />
                    )}

                    {/* Outer Selection Ring */}
                    {isSelected && isReal && (
                      <circle cx={pt.x} cy={pt.y} r={10} fill="none" stroke="var(--heroui-emerald)" strokeWidth="2" filter="url(#glowGreen)" />
                    )}

                    {/* Node Circle */}
                    {isReal && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6 : 4.5}
                        fill={isSelected ? '#fff' : 'var(--heroui-emerald)'}
                        stroke="#12121a"
                        strokeWidth={isSelected ? 2 : 1}
                      />
                    )}

                    {/* X-Axis Day Number Labels */}
                    {(pt.dayNum % 2 === 1 || pt.dayNum === daysInMonth || isSelected) && (
                      <text
                        x={pt.x}
                        y={paddingTop + chartHeight + 18}
                        fill={isSelected ? 'var(--heroui-emerald)' : (isReal ? '#fff' : 'rgba(255, 255, 255, 0.4)')}
                        fontSize={isSelected ? '11' : '10'}
                        fontWeight={isSelected || isReal ? 'bold' : 'normal'}
                        textAnchor="middle"
                        fontFamily="sans-serif"
                      >
                        {pt.dayNum}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Hover Tooltip Overlay */}
          {hoveredDay && (
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '16px',
              background: 'rgba(18, 18, 28, 0.95)',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              fontSize: '0.75rem',
              color: '#fff',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
              <strong>Tag {hoveredDay.dayNum} ({hoveredDay.dateStr})</strong>: {hoveredDay.weight > 0 ? `${hoveredDay.weight} kg` : 'Kein Eintrag'} {hoveredDay.kfa ? `| ${hoveredDay.kfa}% KFA` : ''}
            </div>
          )}

          {/* Bottom legend note */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.73rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '8px' }}>
            <span>💡 <strong>Punkte</strong> = Tag mit echtem Gewichtseintrag | <strong>Klick auf Punkt</strong> zeigt Messwerte rechts</span>
            <span>Tag 1–{daysInMonth}</span>
          </div>
        </div>

        {/* RIGHT: Selected Day Food Log List Panel */}
        <div className="nutrition-right-panel" style={{
          background: 'rgba(0, 0, 0, 0.35)',
          padding: '18px',
          borderRadius: '14px',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          
          {/* Header for Selected Day */}
          <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--heroui-emerald)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Selected Day Overview
            </span>
            <h4 style={{ margin: '2px 0 6px 0', fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📅 {selectedDateLabel}</span>
              {selectedDate === todayStr && (
                <span className="badge-pill" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', fontSize: '0.7rem' }}>
                  Heute
                </span>
              )}
            </h4>
          </div>

          {/* Details for Selected Date */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
            {!selectedDayData || !selectedDayData.hasActualData ? (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '10px',
                padding: '20px',
                textAlign: 'center',
                border: '1px dashed rgba(255, 255, 255, 0.1)'
              }}>
                <Weight size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Kein Gewicht an diesem Tag getrackt.</p>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', opacity: 0.6 }}>Das Diagramm zeigt das zuletzt bekannte Gewicht von {selectedDayData?.weight || 0} kg.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Weight size={16} /> Körpergewicht
                     </span>
                     <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {selectedDayData.weight} kg
                        {deltaInfo && (
                           <span style={{ 
                              fontSize: '0.75rem', 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              background: deltaInfo.startsWith('-') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', 
                              color: deltaInfo.startsWith('-') ? '#22c55e' : '#ef4444' 
                           }}>
                              {deltaInfo}
                           </span>
                        )}
                     </span>
                  </div>

                  {selectedDayData.kfa && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                       <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Flame size={16} style={{ color: '#ef4444' }} /> Körperfettanteil
                       </span>
                       <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#22c55e' }}>
                          {selectedDayData.kfa}% KFA
                       </span>
                    </div>
                  )}

                  {selectedDayData.session?.neck && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                       <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          👔 Nacken
                       </span>
                       <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>
                          {selectedDayData.session.neck} cm
                       </span>
                    </div>
                  )}

                  {selectedDayData.session?.waist && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                       <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          📏 Bauch
                       </span>
                       <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>
                          {selectedDayData.session.waist} cm
                       </span>
                    </div>
                  )}
                </div>

                {selectedDayData.session?.photoUrl && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>📸 Check-in Foto</span>
                    <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <img src={selectedDayData.session.photoUrl} alt="Progress" style={{ width: '100%', height: 'auto', display: 'block' }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
