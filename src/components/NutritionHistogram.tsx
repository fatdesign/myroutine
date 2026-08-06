import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Utensils, Trash2, BarChart2, Pencil, Check, X } from 'lucide-react';
import type { LoggedMeal } from '../types';
import { fetchMonthlyMacroLogs, fetchMacroLogMonths, deleteLoggedMeal, updateLoggedMeal } from '../services/plannerApi';

interface NutritionHistogramProps {
  targetCalories?: number;
  onMealDeleted?: () => void;
}

export const NutritionHistogram: React.FC<NutritionHistogramProps> = ({
  targetCalories = 2090,
  onMealDeleted
}) => {
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
  const [dbMonths, setDbMonths] = useState<string[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<LoggedMeal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hoveredDay, setHoveredDay] = useState<{ dayNum: number; dateStr: string; calories: number; protein: number; fat: number; carbs: number; mealsCount: number } | null>(null);

  // Fetch distinct months with recorded data on mount
  useEffect(() => {
    fetchMacroLogMonths().then(months => {
      if (months && months.length > 0) {
        setDbMonths(months);
      }
    });
  }, []);

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

  // Fetch monthly logs when selectedMonth changes
  const loadMonthlyData = async (monthKey: string) => {
    setIsLoading(true);
    try {
      const logs = await fetchMonthlyMacroLogs(monthKey);
      setMonthlyLogs(logs);
    } catch (e) {
      console.warn('Error loading monthly macro logs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMonthlyData(selectedMonth);
  }, [selectedMonth]);

  // Number of days in selected month
  const daysInMonth = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  }, [selectedMonth]);

  // Aggregate logs by date "YYYY-MM-DD"
  const dailyTotalsMap = useMemo(() => {
    const map: Record<string, { totalCalories: number; totalProtein: number; totalFat: number; totalCarbs: number; meals: LoggedMeal[] }> = {};
    
    // Initialize all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${selectedMonth}-${dayStr}`;
      map[dateKey] = { totalCalories: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0, meals: [] };
    }

    // Populate with logged meals
    monthlyLogs.forEach(meal => {
      if (meal.date && map[meal.date]) {
        map[meal.date].totalCalories += meal.calories || 0;
        map[meal.date].totalProtein += meal.protein || 0;
        map[meal.date].totalFat += meal.fat || 0;
        map[meal.date].totalCarbs += meal.carbs || 0;
        map[meal.date].meals.push(meal);
      }
    });

    return map;
  }, [monthlyLogs, selectedMonth, daysInMonth]);

  // Calculate max calories for chart Y-scaling
  const maxCaloriesInMonth = useMemo(() => {
    let maxCals = targetCalories * 1.25;
    Object.values(dailyTotalsMap).forEach(d => {
      if (d.totalCalories > maxCals) {
        maxCals = d.totalCalories;
      }
    });
    return Math.max(2500, Math.ceil(maxCals / 500) * 500);
  }, [dailyTotalsMap, targetCalories]);

  // Handle meal deletion in the right panel
  const handleDeleteMealItem = async (mealId: string) => {
    await deleteLoggedMeal(mealId);
    setMonthlyLogs(prev => prev.filter(m => m.id !== mealId));
    if (onMealDeleted) onMealDeleted();
  };

  // Inline editing of a logged meal's macros (AI estimates can be off — let the user correct them)
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ calories: string; protein: string; fat: string; carbs: string }>({ calories: '', protein: '', fat: '', carbs: '' });

  const startEditMeal = (meal: LoggedMeal) => {
    setEditingMealId(meal.id);
    setEditForm({
      calories: String(meal.calories),
      protein: String(meal.protein),
      fat: String(meal.fat),
      carbs: String(meal.carbs)
    });
  };

  const cancelEditMeal = () => setEditingMealId(null);

  const saveEditMeal = async (mealId: string) => {
    const updates = {
      calories: Number(editForm.calories) || 0,
      protein: Number(editForm.protein) || 0,
      fat: Number(editForm.fat) || 0,
      carbs: Number(editForm.carbs) || 0
    };
    setMonthlyLogs(prev => prev.map(m => (m.id === mealId ? { ...m, ...updates } : m)));
    setEditingMealId(null);
    await updateLoggedMeal(mealId, updates);
    if (onMealDeleted) onMealDeleted();
  };

  // Currently selected day details
  const selectedDayData = dailyTotalsMap[selectedDate] || {
    totalCalories: 0,
    totalProtein: 0,
    totalFat: 0,
    totalCarbs: 0,
    meals: []
  };

  // SVG Chart Geometry Constants
  const width = 760;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate X, Y coordinates for each day of the month
  const chartPoints = useMemo(() => {
    const points: { dayNum: number; dateStr: string; x: number; y: number; calories: number; protein: number; fat: number; carbs: number; mealsCount: number }[] = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${selectedMonth}-${dayStr}`;
      const data = dailyTotalsMap[dateKey] || { totalCalories: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0, meals: [] };
      
      const x = paddingLeft + ((day - 1) / Math.max(1, daysInMonth - 1)) * chartWidth;
      const calsClamped = Math.min(data.totalCalories, maxCaloriesInMonth);
      const y = paddingTop + chartHeight - (calsClamped / maxCaloriesInMonth) * chartHeight;

      points.push({
        dayNum: day,
        dateStr: dateKey,
        x,
        y,
        calories: data.totalCalories,
        protein: data.totalProtein,
        fat: data.totalFat,
        carbs: data.totalCarbs,
        mealsCount: data.meals.length
      });
    }

    return points;
  }, [dailyTotalsMap, daysInMonth, selectedMonth, chartWidth, chartHeight, maxCaloriesInMonth]);

  // Build SVG Path strings (Line & Area under curve)
  const linePathD = useMemo(() => {
    if (chartPoints.length === 0) return '';
    return chartPoints.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x} ${pt.y}`;
      // Smooth curve interpolation
      const prev = chartPoints[idx - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, '');
  }, [chartPoints]);

  const areaPathD = useMemo(() => {
    if (chartPoints.length === 0) return '';
    const firstX = chartPoints[0].x;
    const lastX = chartPoints[chartPoints.length - 1].x;
    const bottomY = paddingTop + chartHeight;
    return `${linePathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePathD, chartPoints, chartHeight]);

  const targetLineY = paddingTop + chartHeight - (targetCalories / maxCaloriesInMonth) * chartHeight;

  // Selected Date Display Label (German format)
  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
  }, [selectedDate]);

  return (
    <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(124, 58, 237, 0.35)', background: 'linear-gradient(180deg, rgba(20, 20, 28, 0.7) 0%, rgba(12, 12, 18, 0.85) 100%)' }}>
      
      {/* Top Controls Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', background: 'rgba(124, 58, 237, 0.2)', borderRadius: '12px', color: 'var(--heroui-violet-light)', border: '1px solid rgba(124, 58, 237, 0.4)' }}>
            <BarChart2 size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Monats-Kalorien Histogramm & Mahlzeiten-Analyse
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Klicke auf einen Tag im Diagramm, um rechts die getrackten Speisen einzusehen.
            </p>
          </div>
        </div>

        {/* Month Selector Dropdown (Top-Left styled) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} style={{ color: 'var(--heroui-violet-light)' }} /> Monat wählen:
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
              background: 'rgba(124, 58, 237, 0.15)',
              color: '#fff',
              border: '1px solid rgba(124, 58, 237, 0.4)',
              borderRadius: '10px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value} style={{ background: '#181824', color: '#fff' }}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Left Chart + Right Food Log List */}
      <div className="nutrition-grid" style={{ gap: '20px', alignItems: 'stretch' }}>
        
        {/* LEFT: SVG Line Chart / Histogram Box */}
        <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
          
          {/* Chart Header Stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '3px', background: '#a855f7', borderRadius: '2px', display: 'inline-block' }} /> Kalorienzufuhr
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '2px', background: '#22c55e', borderTop: '1px dashed #22c55e', display: 'inline-block' }} /> Ziel ({targetCalories} kcal)
              </span>
            </div>
            {isLoading && <span style={{ color: 'var(--heroui-violet-light)', fontStyle: 'italic' }}>Lade Daten...</span>}
          </div>

          {/* SVG Diagram Canvas */}
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              <defs>
                {/* Purple to Transparent Fill Gradient */}
                <linearGradient id="calorieGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#a855f7" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                </linearGradient>
                {/* Active Node Glow Filter */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Y-Axis Horizontal Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const yVal = paddingTop + chartHeight * (1 - ratio);
                const calVal = Math.round(maxCaloriesInMonth * ratio);
                return (
                  <g key={i}>
                    <line x1={paddingLeft} y1={yVal} x2={width - paddingRight} y2={yVal} stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3 3" />
                    <text x={paddingLeft - 8} y={yVal + 4} fill="rgba(255, 255, 255, 0.4)" fontSize="10" textAnchor="end" fontFamily="sans-serif">
                      {calVal}
                    </text>
                  </g>
                );
              })}

              {/* Target Calorie Line */}
              <line
                x1={paddingLeft}
                y1={targetLineY}
                x2={width - paddingRight}
                y2={targetLineY}
                stroke="#22c55e"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                opacity="0.85"
              />

              {/* Translucent Area Under Curve */}
              {areaPathD && <path d={areaPathD} fill="url(#calorieGradient)" />}

              {/* Solid Curved Line */}
              {linePathD && <path d={linePathD} fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

              {/* Clickable Data Points (Nodes for each Day) */}
              {chartPoints.map((pt) => {
                const isSelected = pt.dateStr === selectedDate;
                const hasMeals = pt.mealsCount > 0;
                const isOverGoal = pt.calories > targetCalories;

                // Color code: green if in goal, red/orange if over, purple if standard, dim grey if 0
                let dotColor = '#a855f7';
                if (!hasMeals) dotColor = 'rgba(255, 255, 255, 0.25)';
                else if (isOverGoal) dotColor = '#ef4444';
                else dotColor = '#22c55e';

                return (
                  <g
                    key={pt.dayNum}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedDate(pt.dateStr)}
                    onMouseEnter={() => setHoveredDay(pt)}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    {/* Vertical guideline on hover/selection */}
                    {(isSelected || (hoveredDay && hoveredDay.dayNum === pt.dayNum)) && (
                      <line x1={pt.x} y1={paddingTop} x2={pt.x} y2={paddingTop + chartHeight} stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="2 2" />
                    )}

                    {/* Outer Selection Ring */}
                    {isSelected && (
                      <circle cx={pt.x} cy={pt.y} r={10} fill="none" stroke="#a855f7" strokeWidth="2" filter="url(#glow)" />
                    )}

                    {/* Node Circle */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 6 : (hasMeals ? 4.5 : 3)}
                      fill={dotColor}
                      stroke="#12121a"
                      strokeWidth={isSelected ? 2 : 1}
                    />

                    {/* X-Axis Day Number Labels */}
                    {(pt.dayNum % 2 === 1 || pt.dayNum === daysInMonth || isSelected) && (
                      <text
                        x={pt.x}
                        y={paddingTop + chartHeight + 18}
                        fill={isSelected ? '#a855f7' : (hasMeals ? '#fff' : 'rgba(255, 255, 255, 0.4)')}
                        fontSize={isSelected ? '11' : '10'}
                        fontWeight={isSelected || hasMeals ? 'bold' : 'normal'}
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
              border: '1px solid rgba(168, 85, 247, 0.4)',
              fontSize: '0.75rem',
              color: '#fff',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
              <strong>Tag {hoveredDay.dayNum} ({hoveredDay.dateStr})</strong>: {hoveredDay.calories} kcal ({hoveredDay.mealsCount} Mahlzeiten)
            </div>
          )}

          {/* Bottom legend note */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.73rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '8px' }}>
            <span>💡 <strong>Grüne/Rote Punkte</strong> = Tag mit getrackten Speisen | <strong>Klick auf Punkt</strong> zeigt Tages-Speisen rechts</span>
            <span>Tag 1–{daysInMonth}</span>
          </div>
        </div>

        {/* RIGHT: Selected Day Food Log List Panel */}
        <div className="nutrition-right-panel" style={{
          background: 'rgba(0, 0, 0, 0.35)',
          padding: '18px',
          borderRadius: '14px',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          
          {/* Header for Selected Day */}
          <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--heroui-violet-light)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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

            {/* Daily Total Macro Badges */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', fontSize: '0.75rem' }}>
              <span style={{ background: selectedDayData.totalCalories > targetCalories ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)', color: selectedDayData.totalCalories > targetCalories ? '#ef4444' : '#22c55e', padding: '3px 8px', borderRadius: '6px', border: `1px solid ${selectedDayData.totalCalories > targetCalories ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}` }}>
                🔥 <strong>{selectedDayData.totalCalories}</strong> / {targetCalories} kcal
              </span>
              <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '3px 8px', borderRadius: '6px' }}>
                🥩 <strong>{selectedDayData.totalProtein}g</strong> P
              </span>
              <span style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', padding: '3px 8px', borderRadius: '6px' }}>
                🥑 <strong>{selectedDayData.totalFat}g</strong> F
              </span>
              <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '3px 8px', borderRadius: '6px' }}>
                🍚 <strong>{selectedDayData.totalCarbs}g</strong> C
              </span>
            </div>
          </div>

          {/* Logged Meals List for the Selected Day */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
            {selectedDayData.meals.length === 0 ? (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px 12px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.82rem',
                gap: '8px'
              }}>
                <Utensils size={24} style={{ opacity: 0.4, color: 'var(--heroui-violet-light)' }} />
                <span>Keine Mahlzeiten für diesen Tag eingetragen.</span>
                <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>Wähle einen anderen Tag mit einem farbigen Punkt auf dem Diagramm.</span>
              </div>
            ) : (
              selectedDayData.meals.map(meal => (
                <div
                  key={meal.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    fontSize: '0.82rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {editingMealId === meal.id ? (
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <span style={{ color: '#fff', fontWeight: 'bold' }}>{meal.meal_name}</span>
                        {meal.time && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>
                            ⏰ {meal.time}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          🔥
                          <input type="number" className="form-input" value={editForm.calories} onChange={e => setEditForm(f => ({ ...f, calories: e.target.value }))} style={{ width: '60px', padding: '3px 6px', fontSize: '0.78rem' }} /> kcal
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          🥩
                          <input type="number" className="form-input" value={editForm.protein} onChange={e => setEditForm(f => ({ ...f, protein: e.target.value }))} style={{ width: '50px', padding: '3px 6px', fontSize: '0.78rem' }} /> g P
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          🥑
                          <input type="number" className="form-input" value={editForm.fat} onChange={e => setEditForm(f => ({ ...f, fat: e.target.value }))} style={{ width: '50px', padding: '3px 6px', fontSize: '0.78rem' }} /> g F
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          🍚
                          <input type="number" className="form-input" value={editForm.carbs} onChange={e => setEditForm(f => ({ ...f, carbs: e.target.value }))} style={{ width: '50px', padding: '3px 6px', fontSize: '0.78rem' }} /> g C
                        </label>
                        <button type="button" onClick={() => saveEditMeal(meal.id)} title="Speichern" style={{ background: 'rgba(34, 197, 94, 0.2)', border: 'none', color: '#22c55e', cursor: 'pointer', padding: '5px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}>
                          <Check size={14} />
                        </button>
                        <button type="button" onClick={cancelEditMeal} title="Abbrechen" style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '5px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#fff', fontWeight: 'bold' }}>{meal.meal_name}</span>
                          {meal.time && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>
                              ⏰ {meal.time}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                          🔥 <strong style={{ color: '#22c55e' }}>{meal.calories} kcal</strong> | 🥩 {meal.protein}g P | 🥑 {meal.fat}g F | 🍚 {meal.carbs}g C
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => startEditMeal(meal)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--heroui-violet-light)',
                            opacity: 0.7,
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Nährwerte korrigieren"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMealItem(meal.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            opacity: 0.7,
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Mahlzeit löschen"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          </div>

      </div>

    </div>
  );
};
