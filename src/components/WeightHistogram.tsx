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
  const [showWeight, setShowWeight] = useState(true);
  const [showKfa, setShowKfa] = useState(true);
  const [showNeck, setShowNeck] = useState(true);
  const [showWaist, setShowWaist] = useState(true);

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
        if (sessions[d].bodyWeight) currentWeight = sessions[d].bodyWeight!;
        if (sessions[d].bodyFat) currentKfa = sessions[d].bodyFat!;
        if (sessions[d].neck) currentNeck = sessions[d].neck!;
        if (sessions[d].waist) currentWaist = sessions[d].waist!;
      }
    }

    // If still 0, find the FIRST value in this month to use as baseline
    for (let day = 1; day <= daysInMonth; day++) {
       const d = `${selectedMonth}-${String(day).padStart(2, '0')}`;
       if (currentWeight === 0 && sessions[d]?.bodyWeight) currentWeight = sessions[d].bodyWeight!;
       if (currentKfa === 0 && sessions[d]?.bodyFat) currentKfa = sessions[d].bodyFat!;
       if (currentNeck === 0 && sessions[d]?.neck) currentNeck = sessions[d].neck!;
       if (currentWaist === 0 && sessions[d]?.waist) currentWaist = sessions[d].waist!;
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
  const paddingLeft = 95;
  const paddingRight = 95;
  const paddingTop = 40;
  const paddingBottom = 40;
  const totalSvgWidth = chartWidth + paddingLeft + paddingRight;
  const totalSvgHeight = chartHeight + paddingTop + paddingBottom;

  // Helper to calculate Y domain for a specific metric
  const getDomain = (key: 'weight' | 'kfa' | 'neck' | 'waist', flatOffsetIndex: number) => {
    const vals = chartPoints.map(p => p[key]).filter(v => v > 0);
    if (vals.length === 0) return { min: 0, max: 100, range: 100, isFlat: true };
    
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const isFlat = minV === maxV;
    
    let padBottom = (maxV - minV) * 0.4 || 2; 
    let padTop = (maxV - minV) * 0.4 || 2; 
    
    // Offset flat lines so they don't perfectly overlap in the middle
    if (isFlat) {
       if (flatOffsetIndex === 1) { padBottom = 3; padTop = 1; }
       if (flatOffsetIndex === 2) { padBottom = 1; padTop = 3; }
       if (flatOffsetIndex === 3) { padBottom = 3.5; padTop = 0.5; }
    }
    
    const finalMin = Math.max(0, minV - padBottom);
    const finalMax = maxV + padTop;
    return {
      min: finalMin,
      max: finalMax,
      range: finalMax - finalMin || 10,
      isFlat
    };
  };

  const domains = useMemo(() => ({
    weight: getDomain('weight', 0),
    kfa: getDomain('kfa', 1),
    neck: getDomain('neck', 2),
    waist: getDomain('waist', 3),
  }), [chartPoints]);

  const svgPoints = useMemo(() => {
    return chartPoints.map(pt => {
      const x = paddingLeft + ((pt.dayNum - 1) / Math.max(1, daysInMonth - 1)) * chartWidth;
      
      const getY = (val: number, domain: any) => 
        val > 0 ? paddingTop + chartHeight - ((val - domain.min) / domain.range) * chartHeight : null;

      return { 
        ...pt, 
        x, 
        yWeight: getY(pt.weight, domains.weight) || (paddingTop + chartHeight),
        yKfa: getY(pt.kfa, domains.kfa),
        yNeck: getY(pt.neck, domains.neck),
        yWaist: getY(pt.waist, domains.waist)
      };
    });
  }, [chartPoints, daysInMonth, domains]);

  // Build SVG Path strings (Line & Area under curve)
  const buildPath = (key: 'yWeight' | 'yKfa' | 'yNeck' | 'yWaist') => {
    const validPoints = svgPoints.filter(p => p[key] !== null);
    if (validPoints.length === 0) return '';
    return validPoints.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x} ${pt[key]}`;
      // Smooth curve interpolation
      const prev = validPoints[idx - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev[key];
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt[key];
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt[key]}`;
    }, '');
  };

  const paths = useMemo(() => ({
    weight: buildPath('yWeight'),
    kfa: buildPath('yKfa'),
    neck: buildPath('yNeck'),
    waist: buildPath('yWaist'),
  }), [svgPoints]);

  const areaPathWeightD = useMemo(() => {
    if (!paths.weight) return '';
    const validPoints = svgPoints.filter(p => p.yWeight !== null);
    if (validPoints.length === 0) return '';
    const firstX = validPoints[0].x;
    const lastX = validPoints[validPoints.length - 1].x;
    const bottomY = paddingTop + chartHeight;
    return `${paths.weight} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [paths.weight, svgPoints]);

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

  // Colors
  const COLORS = {
    weight: 'var(--heroui-emerald)', // #10b981
    kfa: '#ef4444',                  // Red
    neck: '#3b82f6',                 // Blue
    waist: '#eab308'                 // Yellow
  };

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
          
          {/* Chart Header Stats (Legend) */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: showWeight ? '#fff' : 'var(--text-muted)' }}>
              <input type="checkbox" checked={showWeight} onChange={() => setShowWeight(!showWeight)} style={{ accentColor: COLORS.weight }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS.weight, opacity: showWeight ? 1 : 0.3 }} /> Gewicht
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: showKfa ? '#fff' : 'var(--text-muted)' }}>
              <input type="checkbox" checked={showKfa} onChange={() => setShowKfa(!showKfa)} style={{ accentColor: COLORS.kfa }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS.kfa, opacity: showKfa ? 1 : 0.3 }} /> KFA
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: showNeck ? '#fff' : 'var(--text-muted)' }}>
              <input type="checkbox" checked={showNeck} onChange={() => setShowNeck(!showNeck)} style={{ accentColor: COLORS.neck }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS.neck, opacity: showNeck ? 1 : 0.3 }} /> Nacken
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: showWaist ? '#fff' : 'var(--text-muted)' }}>
              <input type="checkbox" checked={showWaist} onChange={() => setShowWaist(!showWaist)} style={{ accentColor: COLORS.waist }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS.waist, opacity: showWaist ? 1 : 0.3 }} /> Bauch
            </label>
          </div>

          <div style={{ flex: 1, position: 'relative', minHeight: '260px' }}>
            <svg viewBox={`0 0 ${totalSvgWidth} ${totalSvgHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(16, 185, 129, 0.45)" />
                  <stop offset="100%" stopColor="rgba(16, 185, 129, 0.0)" />
                </linearGradient>
                <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glowBlue" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glowYellow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Y-Axis Grid Lines & Multi-Labels */}
              {[1, 0.75, 0.5, 0.25, 0].map((ratio) => {
                const y = paddingTop + chartHeight * (1 - ratio);
                
                const valW = (domains.weight.min + domains.weight.range * ratio).toFixed(1);
                const valK = (domains.kfa.min + domains.kfa.range * ratio).toFixed(1);
                const valN = (domains.neck.min + domains.neck.range * ratio).toFixed(1);
                const valB = (domains.waist.min + domains.waist.range * ratio).toFixed(1);

                return (
                  <g key={`y-grid-${ratio}`}>
                    <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="4 4" />
                    
                    {/* LEFT AXIS */}
                    {showWeight && (
                      <text x={paddingLeft - 50} y={y + 4} fill={COLORS.weight} fontSize="10" fontWeight="bold" textAnchor="end" fontFamily="sans-serif">
                        {valW} kg
                      </text>
                    )}
                    {showKfa && (
                      <text x={paddingLeft - 10} y={y + 4} fill={COLORS.kfa} fontSize="10" fontWeight="bold" textAnchor="end" fontFamily="sans-serif">
                        {valK} %
                      </text>
                    )}

                    {/* RIGHT AXIS */}
                    {showNeck && (
                      <text x={paddingLeft + chartWidth + 10} y={y + 4} fill={COLORS.neck} fontSize="10" fontWeight="bold" textAnchor="start" fontFamily="sans-serif">
                        {valN} cm
                      </text>
                    )}
                    {showWaist && (
                      <text x={paddingLeft + chartWidth + 50} y={y + 4} fill={COLORS.waist} fontSize="10" fontWeight="bold" textAnchor="start" fontFamily="sans-serif">
                        {valB} cm
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Data Area (Weight only) */}
              {showWeight && paths.weight && (
                <path d={areaPathWeightD} fill="url(#weightAreaGrad)" />
              )}

              {/* Data Lines */}
              {showWaist && paths.waist && <path d={paths.waist} fill="none" stroke={COLORS.waist} strokeWidth="2.5" filter="url(#glowYellow)" />}
              {showNeck && paths.neck && <path d={paths.neck} fill="none" stroke={COLORS.neck} strokeWidth="2.5" filter="url(#glowBlue)" />}
              {showKfa && paths.kfa && <path d={paths.kfa} fill="none" stroke={COLORS.kfa} strokeWidth="2.5" filter="url(#glowRed)" />}
              {showWeight && paths.weight && <path d={paths.weight} fill="none" stroke={COLORS.weight} strokeWidth="3" filter="url(#glowGreen)" />}

              {/* Data Points */}
              {svgPoints.map((pt, idx) => {
                const isSelected = pt.dateStr === selectedDate;
                const isHovered = hoveredDay && hoveredDay.dateStr === pt.dateStr;
                const isHighlighted = isSelected || isHovered;
                
                return (
                  <g 
                    key={`pt-${idx}`}
                    onMouseEnter={() => setHoveredDay(pt)}
                    onMouseLeave={() => setHoveredDay(null)}
                    onClick={() => setSelectedDate(pt.dateStr)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Vertical guideline on hover/selection */}
                    {isHighlighted && (
                      <line x1={pt.x} y1={paddingTop} x2={pt.x} y2={paddingTop + chartHeight} stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="2 2" />
                    )}

                    {/* Node Circles */}
                    {showWaist && pt.yWaist !== null && pt.hasActualWaist && (
                      <circle cx={pt.x} cy={pt.yWaist} r={isHighlighted ? 5 : 3.5} fill={isHighlighted ? '#fff' : COLORS.waist} stroke="#12121a" strokeWidth={isHighlighted ? 2 : 1} />
                    )}
                    {showNeck && pt.yNeck !== null && pt.hasActualNeck && (
                      <circle cx={pt.x} cy={pt.yNeck} r={isHighlighted ? 5 : 3.5} fill={isHighlighted ? '#fff' : COLORS.neck} stroke="#12121a" strokeWidth={isHighlighted ? 2 : 1} />
                    )}
                    {showKfa && pt.yKfa !== null && pt.hasActualKfa && (
                      <circle cx={pt.x} cy={pt.yKfa} r={isHighlighted ? 5 : 3.5} fill={isHighlighted ? '#fff' : COLORS.kfa} stroke="#12121a" strokeWidth={isHighlighted ? 2 : 1} />
                    )}
                    {showWeight && pt.hasActualWeight && (
                      <circle cx={pt.x} cy={pt.yWeight} r={isHighlighted ? 6 : 4.5} fill={isHighlighted ? '#fff' : COLORS.weight} stroke="#12121a" strokeWidth={isHighlighted ? 2 : 1} />
                    )}

                    {/* Outer Selection Ring for Weight if selected */}
                    {isSelected && showWeight && pt.hasActualWeight && (
                      <circle cx={pt.x} cy={pt.yWeight} r={10} fill="none" stroke={COLORS.weight} strokeWidth="2" filter="url(#glowGreen)" />
                    )}

                    {/* X-Axis Day Number Labels */}
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
              top: '12px',
              right: '16px',
              background: 'rgba(18, 18, 28, 0.95)',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
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
              {hoveredDay.weight > 0 && <span style={{ color: COLORS.weight }}>Gewicht: {hoveredDay.weight} kg {hoveredDay.hasActualWeight ? '' : '(alt)'}</span>}
              {hoveredDay.kfa > 0 && <span style={{ color: COLORS.kfa }}>KFA: {hoveredDay.kfa}% {hoveredDay.hasActualKfa ? '' : '(alt)'}</span>}
              {hoveredDay.neck > 0 && <span style={{ color: COLORS.neck }}>Nacken: {hoveredDay.neck} cm {hoveredDay.hasActualNeck ? '' : '(alt)'}</span>}
              {hoveredDay.waist > 0 && <span style={{ color: COLORS.waist }}>Bauch: {hoveredDay.waist} cm {hoveredDay.hasActualWaist ? '' : '(alt)'}</span>}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Weight size={16} style={{ color: COLORS.weight }} /> Gewicht {selectedDayData.hasActualWeight ? '' : '(alt)'}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                       <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Flame size={16} style={{ color: COLORS.kfa }} /> KFA {selectedDayData.hasActualKfa ? '' : '(alt)'}
                       </span>
                       <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: COLORS.kfa }}>
                          {selectedDayData.kfa}%
                       </span>
                    </div>
                  )}

                  {/* Neck */}
                  {selectedDayData.neck > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                       <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: COLORS.neck, flexShrink: 0 }} /> Nacken {selectedDayData.hasActualNeck ? '' : '(alt)'}
                       </span>
                       <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>
                          {selectedDayData.neck} cm
                       </span>
                    </div>
                  )}

                  {/* Waist */}
                  {selectedDayData.waist > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                       <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: COLORS.waist, flexShrink: 0 }} /> Bauch {selectedDayData.hasActualWaist ? '' : '(alt)'}
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
