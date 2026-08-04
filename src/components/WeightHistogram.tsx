import React, { useState, useMemo } from 'react';
import { Calendar, Weight, Flame, TrendingDown } from 'lucide-react';
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
  const [hoveredDay, setHoveredDay] = useState<any | null>(null);

  // Toggles for different metrics
  type MetricType = 'weight' | 'kfa' | 'neck' | 'waist';
  const [activeMetric, setActiveMetric] = useState<MetricType>('weight');

  // Extract distinct months that have bodyWeight or bodyFat data
  const dbMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    Object.values(sessions).forEach(session => {
      if (session.bodyWeight || session.bodyFat || session.neck || session.waist) {
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

  // Build daily data for the selected month (carrying forward last known values)
  const chartPoints = useMemo(() => {
    const allDates = Object.keys(sessions).sort();
    let currentWeight = 0;
    let currentKfa = 0;
    let currentNeck = 0;
    let currentWaist = 0;
    
    // Find last known values BEFORE or ON the first of the selected month
    for (const d of allDates) {
      if (d < `${selectedMonth}-01`) {
        if (sessions[d].bodyWeight) currentWeight = sessions[d].bodyWeight;
        if (sessions[d].bodyFat) currentKfa = sessions[d].bodyFat;
        if (sessions[d].neck) currentNeck = sessions[d].neck;
        if (sessions[d].waist) currentWaist = sessions[d].waist;
      }
    }

    // If still 0, find the FIRST value in this month to use as baseline
    for (let day = 1; day <= daysInMonth; day++) {
       const d = `${selectedMonth}-${String(day).padStart(2, '0')}`;
       if (currentWeight === 0 && sessions[d]?.bodyWeight) currentWeight = sessions[d].bodyWeight;
       if (currentKfa === 0 && sessions[d]?.bodyFat) currentKfa = sessions[d].bodyFat;
       if (currentNeck === 0 && sessions[d]?.neck) currentNeck = sessions[d].neck;
       if (currentWaist === 0 && sessions[d]?.waist) currentWaist = sessions[d].waist;
    }

    const points = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${selectedMonth}-${dayStr}`;
      
      const session = sessions[dateKey];
      const hasActualWeight = !!(session && session.bodyWeight);
      const hasActualKfa = !!(session && session.bodyFat);
      const hasActualNeck = !!(session && session.neck);
      const hasActualWaist = !!(session && session.waist);
      
      if (hasActualWeight) currentWeight = session.bodyWeight!;
      if (hasActualKfa) currentKfa = session.bodyFat!;
      if (hasActualNeck) currentNeck = session.neck!;
      if (hasActualWaist) currentWaist = session.waist!;

      points.push({
        dayNum: day,
        dateStr: dateKey,
        weight: currentWeight,
        kfa: currentKfa,
        neck: currentNeck,
        waist: currentWaist,
        hasActualWeight,
        hasActualKfa,
        hasActualNeck,
        hasActualWaist,
        hasAnyData: hasActualWeight || hasActualKfa || hasActualNeck || hasActualWaist,
        session
      });
    }

    return points;
  }, [sessions, selectedMonth, daysInMonth]);

  // SVG Chart Dimensions
  const chartWidth = 760;
  const chartHeight = 220;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 40;
  const paddingBottom = 40;
  const totalSvgWidth = chartWidth + paddingLeft + paddingRight;
  const totalSvgHeight = chartHeight + paddingTop + paddingBottom;

  // Active Domain Calculation
  const activeDomain = useMemo(() => {
    const vals = chartPoints.map(p => p[activeMetric]).filter(v => v > 0);
    if (vals.length === 0) return { min: 0, max: 100, range: 100 };
    
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const padding = (maxV - minV) * 0.4 || 2; 
    
    const finalMin = Math.max(0, minV - padding);
    const finalMax = maxV + padding;
    return {
      min: finalMin,
      max: finalMax,
      range: finalMax - finalMin || 10
    };
  }, [chartPoints, activeMetric]);

  const svgPoints = useMemo(() => {
    return chartPoints.map(pt => {
      const x = paddingLeft + ((pt.dayNum - 1) / Math.max(1, daysInMonth - 1)) * chartWidth;
      const val = pt[activeMetric];
      const y = val > 0 ? paddingTop + chartHeight - ((val - activeDomain.min) / activeDomain.range) * chartHeight : null;
      return { ...pt, x, y };
    });
  }, [chartPoints, daysInMonth, activeDomain, activeMetric]);

  // Build SVG Path strings
  const linePathD = useMemo(() => {
    const validPoints = svgPoints.filter(p => p.y !== null);
    if (validPoints.length === 0) return '';
    return validPoints.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x} ${pt.y}`;
      const prev = validPoints[idx - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, '');
  }, [svgPoints]);

  const areaPathD = useMemo(() => {
    if (!linePathD) return '';
    const validPoints = svgPoints.filter(p => p.y !== null);
    if (validPoints.length === 0) return '';
    const firstX = validPoints[0].x;
    const lastX = validPoints[validPoints.length - 1].x;
    const bottomY = paddingTop + chartHeight;
    return `${linePathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePathD, svgPoints]);

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

  // UI Configuration for Active Metric
  const METRIC_CONFIG = {
    weight: { color: 'var(--heroui-emerald)', label: 'Gewicht', unit: 'kg' },
    kfa: { color: '#ef4444', label: 'KFA', unit: '%' },
    neck: { color: '#3b82f6', label: 'Nacken', unit: 'cm' },
    waist: { color: '#eab308', label: 'Bauch', unit: 'cm' }
  };
  const activeColor = METRIC_CONFIG[activeMetric].color;

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
              Monats-Körperentwicklung
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
          
          {/* Active Metric Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
            {(Object.keys(METRIC_CONFIG) as MetricType[]).map(key => {
              const isActive = activeMetric === key;
              const config = METRIC_CONFIG[key];
              return (
                <button
                  key={key}
                  onClick={() => setActiveMetric(key)}
                  style={{
                    background: isActive ? `${config.color}20` : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isActive ? config.color : 'rgba(255, 255, 255, 0.1)'}`,
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? `0 0 10px ${config.color}30` : 'none'
                  }}
                >
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: config.color, opacity: isActive ? 1 : 0.5 }} />
                  {config.label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, position: 'relative', minHeight: '260px' }}>
            <svg viewBox={`0 0 ${totalSvgWidth} ${totalSvgHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="activeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeColor} stopOpacity="0.45" />
                  <stop offset="100%" stopColor={activeColor} stopOpacity="0.0" />
                </linearGradient>
                <filter id="activeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Y-Axis Grid Lines & Labels */}
              {[1, 0.75, 0.5, 0.25, 0].map((ratio) => {
                const y = paddingTop + chartHeight * (1 - ratio);
                const val = (activeDomain.min + activeDomain.range * ratio).toFixed(1);

                return (
                  <g key={`y-grid-${ratio}`}>
                    <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="4 4" />
                    
                    <text x={paddingLeft - 10} y={y + 4} fill={activeColor} fontSize="10" fontWeight="bold" textAnchor="end" fontFamily="sans-serif">
                      {val} {METRIC_CONFIG[activeMetric].unit}
                    </text>
                  </g>
                );
              })}

              {/* Data Area & Line */}
              {linePathD && (
                <>
                  <path d={areaPathD} fill="url(#activeAreaGrad)" />
                  <path d={linePathD} fill="none" stroke={activeColor} strokeWidth="3" filter="url(#activeGlow)" />
                </>
              )}

              {/* Data Points */}
              {svgPoints.map((pt, idx) => {
                const isSelected = pt.dateStr === selectedDate;
                const isHovered = hoveredDay && hoveredDay.dateStr === pt.dateStr;
                const isHighlighted = isSelected || isHovered;
                
                // Capitalized key to match object boolean props (e.g., 'weight' -> 'hasActualWeight')
                const capKey = activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1);
                const hasActual = pt[`hasActual${capKey}` as keyof typeof pt];
                
                if (pt.y === null) return null;

                return (
                  <g 
                    key={`pt-${idx}`}
                    onMouseEnter={() => setHoveredDay(pt)}
                    onMouseLeave={() => setHoveredDay(null)}
                    onClick={() => setSelectedDate(pt.dateStr)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Vertical guideline */}
                    {isHighlighted && (
                      <line x1={pt.x} y1={paddingTop} x2={pt.x} y2={paddingTop + chartHeight} stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="2 2" />
                    )}

                    {/* Node Circle */}
                    {hasActual && (
                      <circle cx={pt.x} cy={pt.y} r={isHighlighted ? 6 : 4.5} fill={isHighlighted ? '#fff' : activeColor} stroke="#12121a" strokeWidth={isHighlighted ? 2 : 1} />
                    )}

                    {/* Outer Selection Ring */}
                    {isSelected && hasActual && (
                      <circle cx={pt.x} cy={pt.y} r={10} fill="none" stroke={activeColor} strokeWidth="2" filter="url(#activeGlow)" />
                    )}

                    {/* X-Axis Day Labels */}
                    {(pt.dayNum % 2 === 1 || pt.dayNum === daysInMonth || isSelected) && (
                      <text
                        x={pt.x}
                        y={paddingTop + chartHeight + 18}
                        fill={isSelected ? '#fff' : (pt.hasAnyData ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)')}
                        fontSize={isSelected ? '11' : '10'}
                        fontWeight={isSelected || pt.hasAnyData ? 'bold' : 'normal'}
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
              top: '52px',
              right: '16px',
              background: 'rgba(18, 18, 28, 0.95)',
              padding: '8px 14px',
              borderRadius: '8px',
              border: `1px solid ${activeColor}40`,
              fontSize: '0.75rem',
              color: '#fff',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <strong style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '2px' }}>
                Tag {hoveredDay.dayNum} ({hoveredDay.dateStr})
              </strong>
              {hoveredDay.weight > 0 && <span style={{ color: METRIC_CONFIG.weight.color, opacity: activeMetric === 'weight' ? 1 : 0.6 }}>Gewicht: {hoveredDay.weight} kg {hoveredDay.hasActualWeight ? '' : '(alt)'}</span>}
              {hoveredDay.kfa > 0 && <span style={{ color: METRIC_CONFIG.kfa.color, opacity: activeMetric === 'kfa' ? 1 : 0.6 }}>KFA: {hoveredDay.kfa}% {hoveredDay.hasActualKfa ? '' : '(alt)'}</span>}
              {hoveredDay.neck > 0 && <span style={{ color: METRIC_CONFIG.neck.color, opacity: activeMetric === 'neck' ? 1 : 0.6 }}>Nacken: {hoveredDay.neck} cm {hoveredDay.hasActualNeck ? '' : '(alt)'}</span>}
              {hoveredDay.waist > 0 && <span style={{ color: METRIC_CONFIG.waist.color, opacity: activeMetric === 'waist' ? 1 : 0.6 }}>Bauch: {hoveredDay.waist} cm {hoveredDay.hasActualWaist ? '' : '(alt)'}</span>}
            </div>
          )}
        </div>

        {/* RIGHT: Selected Day Details Panel */}
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
              Messwerte am Tag
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
            {!selectedDayData || !selectedDayData.hasAnyData ? (
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
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Keine Daten für diesen Tag geloggt.</p>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', opacity: 0.6 }}>Das Diagramm interpoliert Werte zwischen Messungen.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  
                  {/* Weight */}
                  {selectedDayData.weight > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activeMetric === 'weight' ? 'rgba(255,255,255,0.05)' : 'transparent', padding: '4px 8px', borderRadius: '8px', margin: '-4px -8px' }}>
                       <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Weight size={16} style={{ color: METRIC_CONFIG.weight.color }} /> Gewicht {selectedDayData.hasActualWeight ? '' : '(alt)'}
                       </span>
                       <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {selectedDayData.weight} kg
                          {selectedDayData.hasActualWeight && deltaInfo && (
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
                  )}

                  {/* KFA */}
                  {selectedDayData.kfa > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', background: activeMetric === 'kfa' ? 'rgba(255,255,255,0.05)' : 'transparent', padding: '4px 8px', borderRadius: '8px', margin: '0 -8px -4px -8px' }}>
                       <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Flame size={16} style={{ color: METRIC_CONFIG.kfa.color }} /> KFA {selectedDayData.hasActualKfa ? '' : '(alt)'}
                       </span>
                       <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: METRIC_CONFIG.kfa.color }}>
                          {selectedDayData.kfa}%
                       </span>
                    </div>
                  )}

                  {/* Neck */}
                  {selectedDayData.neck > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', background: activeMetric === 'neck' ? 'rgba(255,255,255,0.05)' : 'transparent', padding: '4px 8px', borderRadius: '8px', margin: '0 -8px -4px -8px' }}>
                       <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: METRIC_CONFIG.neck.color, flexShrink: 0 }} /> Nacken {selectedDayData.hasActualNeck ? '' : '(alt)'}
                       </span>
                       <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>
                          {selectedDayData.neck} cm
                       </span>
                    </div>
                  )}

                  {/* Waist */}
                  {selectedDayData.waist > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', background: activeMetric === 'waist' ? 'rgba(255,255,255,0.05)' : 'transparent', padding: '4px 8px', borderRadius: '8px', margin: '0 -8px -4px -8px' }}>
                       <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: METRIC_CONFIG.waist.color, flexShrink: 0 }} /> Bauch {selectedDayData.hasActualWaist ? '' : '(alt)'}
                       </span>
                       <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>
                          {selectedDayData.waist} cm
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
