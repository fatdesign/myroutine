import React, { useState, useEffect } from 'react';
import { Utensils, ShoppingBag, Sparkles, Check, Clock, Save, RefreshCw, ChefHat, Send, Camera, Trash2, Award, Lightbulb, Target, Flame, Droplet, Image as ImageIcon, Sun, Moon } from 'lucide-react';
import type { NutritionProfile, NutritionPlan, LoggedMeal, WeeklyCoachReport } from '../types';
import { 
  fetchNutritionProfile, upsertNutritionProfile, fetchNutritionPlan, generateAiNutritionPlan, 
  fetchBodyMetricsInputs, sendTelegramNutritionPlan, fetchDailyMacroLogs, deleteLoggedMeal, 
  fetchWeeklyCoachReport, generateWeeklyCoachReport,
  fetchDailyWaterLogs, addWaterLog, deleteWaterLog, type WaterLog,
  fetchProgressPhotos, type ProgressPhoto,
  triggerMorningBriefing, triggerEveningRecap
} from '../services/plannerApi';
import { WORKOUT_PLAN } from '../data/workouts';
import { getLiveBodyMetrics, type BodyMetrics } from '../utils/bodyMetrics';

interface NutritionDashboardProps {
  metrics?: {
    targetCalories: number;
    proteinGrams: number;
    fatGrams: number;
    carbsGrams: number;
    kfa: number;
  };
  selectedDayFocus?: string;
}

const getTodayFocus = (): string => {
  const dayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  if (dayOfWeek === 0) {
    return 'Erholungstag (Sonntag: Rest Day & Regeneration)';
  }
  const workoutDay = WORKOUT_PLAN.find(w => w.dayId === String(dayOfWeek));
  if (workoutDay) {
    return `Trainingstag (${workoutDay.dayName}: ${workoutDay.focus})`;
  }
  return 'Trainingstag (V-Shape Focus)';
};

export const NutritionDashboard: React.FC<NutritionDashboardProps> = ({ selectedDayFocus }) => {
  const [liveMetrics, setLiveMetrics] = useState<BodyMetrics>(() => getLiveBodyMetrics());

  useEffect(() => {
    const updateMetrics = () => {
      setLiveMetrics(getLiveBodyMetrics());
    };
    updateMetrics();

    window.addEventListener('myroutine_body_metrics_updated', updateMetrics);
    window.addEventListener('storage', updateMetrics);
    return () => {
      window.removeEventListener('myroutine_body_metrics_updated', updateMetrics);
      window.removeEventListener('storage', updateMetrics);
    };
  }, []);

  const [profile, setProfile] = useState<NutritionProfile>({
    meals_per_day: 3,
    breakfast_type: 'normal',
    diet_focus: 'high_protein',
    preferences: '',
    allergies: ''
  });

  const [currentPlan, setCurrentPlan] = useState<NutritionPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [checkedShoppingItems, setCheckedShoppingItems] = useState<Record<string, boolean>>({});
  const [dayFocus, setDayFocus] = useState<string>(() => selectedDayFocus || getTodayFocus());
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [isTelegramSending, setIsTelegramSending] = useState<boolean>(false);
  const [telegramFeedback, setTelegramFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Macro Logs & Coach Report state
  const [macroLogs, setMacroLogs] = useState<LoggedMeal[]>([]);
  const [coachReport, setCoachReport] = useState<WeeklyCoachReport | null>(null);
  const [isReportGenerating, setIsReportGenerating] = useState<boolean>(false);

  // New Water Logs, Progress Photos & Briefing Triggers State
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [totalWaterMl, setTotalWaterMl] = useState<number>(0);
  const [progressPhotos, setProgressPhotos] = useState<ProgressPhoto[]>([]);
  const [briefingMsg, setBriefingMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchBodyMetricsInputs().then(() => setLiveMetrics(getLiveBodyMetrics()));
    fetchNutritionProfile().then(p => setProfile(p));
    fetchNutritionPlan().then(p => setCurrentPlan(p));
    fetchDailyMacroLogs().then(logs => setMacroLogs(logs));
    fetchWeeklyCoachReport().then(rep => setCoachReport(rep));
    fetchDailyWaterLogs().then(res => {
      setWaterLogs(res.logs);
      setTotalWaterMl(res.totalMl);
    });
    fetchProgressPhotos().then(photos => setProgressPhotos(photos));
  }, []);

  const handleDeleteMeal = async (id: string) => {
    await deleteLoggedMeal(id);
    setMacroLogs(prev => prev.filter(m => m.id !== id));
  };

  const handleAddWater = async (amountMl: number) => {
    await addWaterLog(amountMl);
    const res = await fetchDailyWaterLogs();
    setWaterLogs(res.logs);
    setTotalWaterMl(res.totalMl);
  };

  const handleDeleteWaterItem = async (id: string) => {
    await deleteWaterLog(id);
    const res = await fetchDailyWaterLogs();
    setWaterLogs(res.logs);
    setTotalWaterMl(res.totalMl);
  };

  const handleTriggerMorning = async () => {
    setBriefingMsg('🌅 Sende Morgen-Briefing an Telegram...');
    const res = await triggerMorningBriefing();
    setBriefingMsg(res.success ? '✓ Morgen-Briefing erfolgreich an Telegram gesendet!' : (res.error || 'Fehler beim Senden'));
    setTimeout(() => setBriefingMsg(null), 4000);
  };

  const handleTriggerEvening = async () => {
    setBriefingMsg('🌙 Sende Abend-Recap an Telegram...');
    const res = await triggerEveningRecap();
    setBriefingMsg(res.success ? '✓ Abend-Recap erfolgreich an Telegram gesendet!' : (res.error || 'Fehler beim Senden'));
    setTimeout(() => setBriefingMsg(null), 4000);
  const handleGenerateCoachReport = async () => {
    setIsReportGenerating(true);
    try {
      const report = await generateWeeklyCoachReport();
      setCoachReport(report);
    } catch (e: any) {
      alert("Fehler bei der Generierung des Wochen-Coach Reports!");
    } finally {
      setIsReportGenerating(false);
    }
  };

  const handleSaveProfile = async () => {
    await upsertNutritionProfile(profile);
    setSaveSuccessMsg('✓ Profil in Cloudflare D1 gespeichert!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleGeneratePlan = async () => {
    setIsLoading(true);
    try {
      const plan = await generateAiNutritionPlan(profile, liveMetrics, dayFocus);
      setCurrentPlan(plan);
    } catch (e: any) {
      alert("Fehler bei der KI-Generierung. Bitte erneut versuchen!");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShoppingItem = (itemKey: string) => {
    setCheckedShoppingItems(prev => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }));
  };

  const handleSendTelegramBot = async () => {
    if (!currentPlan) return;
    setIsTelegramSending(true);
    setTelegramFeedback(null);
    try {
      const res = await sendTelegramNutritionPlan(currentPlan);
      if (res.success) {
        setTelegramFeedback({ type: 'success', text: '✓ Ernährungsplan & Einkaufsliste an Telegram gesendet!' });
      } else {
        setTelegramFeedback({ type: 'error', text: res.error || 'Fehler beim Senden an Telegram.' });
      }
    } catch (e: any) {
      setTelegramFeedback({ type: 'error', text: 'Fehler bei der Verbindung zum Telegram Bot.' });
    } finally {
      setIsTelegramSending(false);
      setTimeout(() => setTelegramFeedback(null), 6000);
    }
  };

  return (
    <div className="nutrition-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Utensils style={{ color: '#22c55e' }} />
              V-Shape KI Ernährungs- & Einkaufsplaner
            </h2>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Generiere KI-gestützte Tagespläne (Cloudflare Workers AI) exakt abgestimmt auf dein Kaloriendefizit & Makro-Protokoll.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.3)', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Ziel-Kalorien</span>
              <strong style={{ fontSize: '1.1rem', color: '#22c55e' }}>{liveMetrics.targetCalories} kcal</strong>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '12px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Protein</span>
              <strong style={{ fontSize: '1.1rem', color: '#ef4444' }}>{liveMetrics.proteinGrams}g</strong>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '12px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Carbs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Macro Progress & Telegram Photo Log Panel */}
      {(() => {
        const loggedCalories = macroLogs.reduce((sum, m) => sum + (m.calories || 0), 0);
        const loggedProtein = macroLogs.reduce((sum, m) => sum + (m.protein || 0), 0);
        const loggedFat = macroLogs.reduce((sum, m) => sum + (m.fat || 0), 0);
        const loggedCarbs = macroLogs.reduce((sum, m) => sum + (m.carbs || 0), 0);
        const rawCalPercent = Math.round((loggedCalories / (liveMetrics.targetCalories || 1)) * 100);
        const calPercent = Math.min(100, rawCalPercent);
        const protPercent = Math.min(100, Math.round((loggedProtein / (liveMetrics.proteinGrams || 1)) * 100));
        const isOverCal = loggedCalories > liveMetrics.targetCalories;

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            
            {/* Today's Macro Live Progress */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', border: `1px solid ${isOverCal ? 'rgba(239, 68, 68, 0.4)' : 'rgba(124, 58, 237, 0.3)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Flame size={18} style={{ color: isOverCal ? '#ef4444' : 'var(--heroui-violet-light)' }} />
                  Tages-Makro-Fortschritt (Heute getrackt)
                </h3>
                <span className="badge-pill time" style={{ background: isOverCal ? 'rgba(239, 68, 68, 0.2)' : 'rgba(124, 58, 237, 0.2)', color: isOverCal ? '#ef4444' : 'var(--heroui-violet-light)', fontSize: '0.75rem' }}>
                  {macroLogs.length} Mahlzeit(en)
                </span>
              </div>

              {/* Progress Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      🔥 Kalorien: <strong style={{ color: isOverCal ? '#ef4444' : '#22c55e' }}>{loggedCalories}</strong> / {liveMetrics.targetCalories} kcal
                      {isOverCal ? (
                        <span style={{ color: '#ef4444', marginLeft: '6px', fontSize: '0.75rem' }}>(+{loggedCalories - liveMetrics.targetCalories} kcal Überschuss ⚠️)</span>
                      ) : (
                        <span style={{ color: '#22c55e', marginLeft: '6px', fontSize: '0.75rem' }}>(Noch {liveMetrics.targetCalories - loggedCalories} kcal offen 🎯)</span>
                      )}
                    </span>
                    <span style={{ color: isOverCal ? '#ef4444' : '#22c55e', fontWeight: 'bold' }}>{rawCalPercent}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${calPercent}%`, height: '100%', background: isOverCal ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #22c55e, #16a34a)', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>🥩 Eiweiß: <strong style={{ color: '#ef4444' }}>{loggedProtein}g</strong> / {liveMetrics.proteinGrams}g</span>
                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{protPercent}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${protPercent}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #dc2626)', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: '4px' }}>
                  <span>🥑 Fett: <strong style={{ color: '#eab308' }}>{loggedFat}g</strong> / {liveMetrics.fatGrams}g</span>
                  <span>🍚 Carbs: <strong style={{ color: '#38bdf8' }}>{loggedCarbs}g</strong> / {liveMetrics.carbsGrams}g</span>
                </div>
              </div>

              {/* Photo Helper Notice */}
              <div style={{ background: 'rgba(0, 136, 204, 0.12)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(0, 136, 204, 0.25)', fontSize: '0.78rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Camera size={18} style={{ flexShrink: 0 }} />
                <span><strong>Foto-Tracking via Telegram:</strong> Schicke einfach ein Teller-Foto an deinen Telegram Bot – Gemini KI schätzt Portionsgrößen & Makros!</span>
              </div>

              {/* Logged Meals List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {macroLogs.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                    Noch keine Mahlzeiten für heute getrackt.
                  </div>
                ) : (
                  macroLogs.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>
                      <div>
                        <span style={{ color: '#fff', fontWeight: 'bold', display: 'block' }}>{m.meal_name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          ⏰ {m.time} | 🔥 {m.calories} kcal | 🥩 {m.protein}g P | 🥑 {m.fat}g F | 🍚 {m.carbs}g C
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMeal(m.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', opacity: 0.7, cursor: 'pointer', padding: '4px' }}
                        title="Mahlzeit löschen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 💧 Hydration Guard (Wasser-Tracker) */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(56, 189, 248, 0.35)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Droplet size={18} style={{ color: '#38bdf8' }} />
                    Hydration Guard (Wasser-Tracker)
                  </h3>
                  <span className="badge-pill time" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    Ziel: 3.5 Liter
                  </span>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      💧 Getrunken: <strong style={{ color: '#38bdf8' }}>{(totalWaterMl / 1000).toFixed(2)} L</strong> ({totalWaterMl} ml / 3500 ml)
                    </span>
                    <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                      {Math.min(100, Math.round((totalWaterMl / 3500) * 100))}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.06)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.round((totalWaterMl / 3500) * 100))}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #0284c7)', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {/* Quick Add Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button type="button" onClick={() => handleAddWater(250)} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    +250 ml Glass
                  </button>
                  <button type="button" onClick={() => handleAddWater(500)} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    +500 ml Flasche
                  </button>
                  <button type="button" onClick={() => handleAddWater(750)} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    +750 ml Shaker
                  </button>
                </div>

                {/* Today's Water Logs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
                  {waterLogs.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
                      Schicke z.B. <em>"500ml Wasser"</em> an Telegram oder nutze die Quick-Buttons.
                    </div>
                  ) : (
                    waterLogs.map(w => (
                      <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.78rem' }}>
                        <span style={{ color: '#e4e4e7' }}>🥤 {w.time} – +{w.amount_ml} ml</span>
                        <button type="button" onClick={() => handleDeleteWaterItem(w.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', opacity: 0.7, cursor: 'pointer' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 📸 V-Shape Formcheck & Photo Vault (Transformations-Zeitstrahl) */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(168, 85, 247, 0.35)', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ImageIcon size={18} style={{ color: 'var(--heroui-violet-light)' }} />
                  V-Shape Transformations-Zeitstrahl (Progress Photo Vault)
                </h3>
                <span className="badge-pill" style={{ background: 'rgba(168, 85, 247, 0.2)', color: 'var(--heroui-violet-light)', fontSize: '0.75rem' }}>
                  {progressPhotos.length} Check-in(s)
                </span>
              </div>

              {progressPhotos.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  📸 <strong>Noch keine Transformations-Fotos vorhanden.</strong><br />
                  Schicke einfach dein Spiegel-Foto oder Workout Check-in mit deinen Messwerten an deinen Telegram Bot!
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {progressPhotos.map((photo, idx) => (
                    <div key={idx} style={{ minWidth: '200px', maxWidth: '220px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {photo.photo_url ? (
                        <img src={photo.photo_url} alt={`Formcheck ${photo.date}`} style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '120px', background: 'rgba(124, 58, 237, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--heroui-violet-light)' }}>
                          <Camera size={32} />
                        </div>
                      )}
                      <div style={{ padding: '10px 12px' }}>
                        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.8rem', display: 'block' }}>📅 {photo.date}</span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {photo.body_weight && <span>⚖️ Gewicht: {photo.body_weight} kg</span>}
                          {photo.body_fat && <span>🎯 KFA: {photo.body_fat}%</span>}
                          {photo.waist && <span>📏 Bauch: {photo.waist} cm</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 🌅 Automatischer Telegram Briefings Quick-Bar */}
            <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid rgba(234, 179, 8, 0.35)', gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ margin: 0, color: '#fff', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sun size={16} style={{ color: '#eab308' }} />
                  Automatischer Telegram Briefing & Recap Bot (Aktiv: 07:00 & 21:00)
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Erhalte täglich automatisch dein Morgen-Briefing mit Tages-Zitat & Ritualen sowie deinen abendlichen Disziplin-Recap.
                </p>
                {briefingMsg && (
                  <span style={{ fontSize: '0.78rem', color: '#eab308', fontWeight: 'bold', marginTop: '4px', display: 'block' }}>{briefingMsg}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={handleTriggerMorning} style={{ background: 'rgba(234, 179, 8, 0.18)', border: '1px solid rgba(234, 179, 8, 0.4)', color: '#eab308', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sun size={14} /> Morgen (07:00) testen
                </button>
                <button type="button" onClick={handleTriggerEvening} style={{ background: 'rgba(168, 85, 247, 0.18)', border: '1px solid rgba(168, 85, 247, 0.4)', color: 'var(--heroui-violet-light)', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Moon size={14} /> Abend (21:00) testen
                </button>
              </div>
            </div>

            {/* KI Wochen-Coach Report Card */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(34, 197, 94, 0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={18} style={{ color: '#22c55e' }} />
                    KI Wochen-Coach Report
                  </h3>
                  {coachReport && (
                    <span className="badge-pill" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid rgba(34, 197, 94, 0.4)' }}>
                      Score: {coachReport.score} / 100 🔥
                    </span>
                  )}
                </div>

                {coachReport ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ margin: 0, fontSize: '0.83rem', color: '#e4e4e7', lineHeight: '1.5', background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '10px' }}>
                      {coachReport.summary}
                    </p>

                    {coachReport.highlights && coachReport.highlights.length > 0 && (
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                          <Target size={12} /> Highlights der Woche:
                        </span>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {coachReport.highlights.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {coachReport.recommendations && coachReport.recommendations.length > 0 && (
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#eab308', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                          <Lightbulb size={12} /> Coach-Tipps für nächste Woche:
                        </span>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {coachReport.recommendations.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.5', padding: '16px 0' }}>
                    🤖 Lass die KI deine absolvierte Woche (Rituale, KFA-Fortschritt, Workouts & Makros) analysieren und dir maßgeschneiderte Tipps erstellen.
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleGenerateCoachReport}
                disabled={isReportGenerating}
                style={{
                  marginTop: '16px',
                  padding: '10px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 'bold',
                  borderColor: 'rgba(34, 197, 94, 0.4)',
                  color: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isReportGenerating ? (
                  <>
                    <RefreshCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                    Wochen-Analyse wird erstellt...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    {coachReport ? '🔄 Wochen-Analyse aktualisieren' : '✨ KI Wochen-Analyse jetzt generieren'}
                  </>
                )}
              </button>
            </div>

          </div>
        );
      })()}

      {/* Main Grid: Profile Settings & AI Generator Trigger */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Profile Config Card */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ChefHat size={18} style={{ color: 'var(--heroui-violet-light)' }} />
            Dein Ernährungs-Profil (D1 Database Sync)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Mahlzeiten pro Tag</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[2, 3, 4].map(num => (
                  <button
                    key={num}
                    type="button"
                    className="btn-secondary"
                    onClick={() => setProfile(p => ({ ...p, meals_per_day: num }))}
                    style={{
                      padding: '8px',
                      borderColor: profile.meals_per_day === num ? 'var(--heroui-violet)' : 'transparent',
                      background: profile.meals_per_day === num ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
                      color: profile.meals_per_day === num ? '#fff' : 'var(--text-muted)'
                    }}
                  >
                    {num} Mahlzeiten
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Frühstücks-Stil</label>
              <select
                className="form-input"
                value={profile.breakfast_type}
                onChange={e => setProfile(p => ({ ...p, breakfast_type: e.target.value as any }))}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="normal">🍳 Normales Frühstück (Haferflocken / Eier)</option>
                <option value="intermittent_fasting">⏳ Intervallfasten 16:8 (Erstes Essen Mittags)</option>
                <option value="shake_only">🥤 Shake / Smoothie Only</option>
                <option value="high_protein">🥩 High Protein Breakfast</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Diät-Schwerpunkt</label>
              <select
                className="form-input"
                value={profile.diet_focus}
                onChange={e => setProfile(p => ({ ...p, diet_focus: e.target.value as any }))}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="high_protein">🥩 High-Protein (Muskelschutz)</option>
                <option value="v_shape_shred">🔥 V-Shape Shred Cut</option>
                <option value="balanced">⚖️ Ausgewogen & Energievoll</option>
                <option value="low_carb">🥑 Low-Carb High Fat</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Lieblingsessen / Vorlieben</label>
              <input
                type="text"
                className="form-input"
                placeholder="z.B. Hähnchen, Reis, Avocado, Quark, Lachs..."
                value={profile.preferences}
                onChange={e => setProfile(p => ({ ...p, preferences: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Allergien / Unverträglichkeiten</label>
              <input
                type="text"
                className="form-input"
                placeholder="z.B. Keine Meeresfrüchte, Laktosefrei..."
                value={profile.allergies}
                onChange={e => setProfile(p => ({ ...p, allergies: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleSaveProfile}
                style={{ padding: '8px 16px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={14} /> Profil Speichern
              </button>
              {saveSuccessMsg && <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 'bold' }}>{saveSuccessMsg}</span>}
            </div>
          </div>
        </div>

        {/* AI Plan Generator Action Card */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: '#22c55e' }} />
              KI Ernährungsplan Generieren
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Trainings-Fokus wählen</label>
              <select
                className="form-input"
                value={dayFocus}
                onChange={e => setDayFocus(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                {WORKOUT_PLAN.map(day => (
                  <option key={day.dayId} value={`Trainingstag (${day.dayName}: ${day.focus})`}>
                    🏋️ Tag {day.dayId}: {day.dayName} – {day.focus}
                  </option>
                ))}
                <option value="Erholungstag (Sonntag: Rest Day & Regeneration)">
                  🧘 Tag 7: Sonntag – Rest Day (Erholung & Regeneration)
                </option>
              </select>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              💡 Die KI (Cloudflare Workers AI) berechnet deinen Mahlzeitenplan und erstellt automatisch eine <strong>vollständige Einkaufsliste</strong> für deinen Tag.
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleGeneratePlan}
            disabled={isLoading}
            style={{
              marginTop: '20px',
              padding: '14px 20px',
              width: '100%',
              fontSize: '0.95rem',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              border: 'none',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? (
              <>
                <RefreshCw size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                Cloudflare AI kocht deinen Plan...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                ✨ KI-Ernährungsplan & Einkaufsliste generieren
              </>
            )}
          </button>
        </div>

      </div>

      {/* Generated Meal Plan Display */}
      {currentPlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Plan Summary Header */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  Generierter KI-Tagesplan (Mahlzeiten-Summe)
                </span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.3rem', color: '#fff' }}>
                  {currentPlan.dayName}
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '14px', fontSize: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                    🔥 <strong>{currentPlan.totalCalories}</strong> kcal <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Ziel: {liveMetrics.targetCalories} kcal)</span>
                  </span>
                  {currentPlan.estimatedTotalPriceEur !== undefined && (
                    <span style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                      🏷️ <strong>ca. {currentPlan.estimatedTotalPriceEur.toFixed(2)} €</strong> <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>(Portionen)</span>
                    </span>
                  )}
                  <span style={{ color: '#ef4444' }}>🥩 <strong>{currentPlan.totalProtein}g</strong> Prot</span>
                  <span style={{ color: '#eab308' }}>🥑 <strong>{currentPlan.totalFat}g</strong> Fett</span>
                  <span style={{ color: '#38bdf8' }}>🍚 <strong>{currentPlan.totalCarbs}g</strong> Carbs</span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleSendTelegramBot}
                    disabled={isTelegramSending}
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.8rem',
                      background: 'rgba(0, 136, 204, 0.18)',
                      color: '#38bdf8',
                      border: '1px solid rgba(0, 136, 204, 0.4)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    <Send size={14} />
                    {isTelegramSending ? 'Sende an Telegram...' : '📱 Per Telegram Bot senden'}
                  </button>
                </div>
              </div>
            </div>

            {telegramFeedback && (
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                background: telegramFeedback.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: telegramFeedback.type === 'success' ? '#22c55e' : '#ef4444',
                border: `1px solid ${telegramFeedback.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                {telegramFeedback.text}
              </div>
            )}
          </div>

          {/* Meal Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {currentPlan.meals.map((meal, idx) => (
              <div key={idx} className="glass-panel" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {meal.time} UHR
                    </span>
                    <h4 style={{ margin: '4px 0 0 0', fontSize: '1.1rem', color: '#fff' }}>
                      {meal.name}
                    </h4>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {meal.estimatedPriceEur !== undefined && (
                      <span className="badge-pill" title="Anteiliger Portionspreis der verbrauchten Zutaten" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        🏷️ ca. {meal.estimatedPriceEur.toFixed(2)} € (Portion)
                      </span>
                    )}
                    <span className="badge-pill time" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', fontSize: '0.75rem' }}>
                      {meal.calories} kcal
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem', marginBottom: '14px', color: 'var(--text-muted)' }}>
                  <span>P: <strong style={{ color: '#fff' }}>{meal.protein}g</strong></span>
                  <span>F: <strong style={{ color: '#fff' }}>{meal.fat}g</strong></span>
                  <span>C: <strong style={{ color: '#fff' }}>{meal.carbs}g</strong></span>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Zutaten:</span>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: '#e4e4e7', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {meal.ingredients.map((ing, i) => (
                      <li key={i}>{ing}</li>
                    ))}
                  </ul>
                </div>

                {meal.instructions && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {meal.instructions}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Interactive Shopping List Card */}
          {currentPlan.shoppingList && currentPlan.shoppingList.length > 0 && (
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShoppingBag size={20} style={{ color: '#22c55e' }} />
                    Einkaufsliste für deine Kochen-Session
                  </h3>
                  {currentPlan.estimatedSupermarketReceiptEur !== undefined && (
                    <span style={{ fontSize: '0.8rem', color: '#eab308', display: 'block', marginTop: '4px', fontWeight: '500' }}>
                      🛒 Geschätzter Kassenbon an der Kasse (Supermarkt Gekaufte Packungen): <strong>ca. {currentPlan.estimatedSupermarketReceiptEur.toFixed(2)} €</strong>
                    </span>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleSendTelegramBot}
                    disabled={isTelegramSending}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      background: 'rgba(0, 136, 204, 0.2)',
                      color: '#38bdf8',
                      border: '1px solid rgba(0, 136, 204, 0.4)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    <Send size={13} />
                    📱 Einkaufsliste an Telegram
                  </button>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {Object.values(checkedShoppingItems).filter(Boolean).length} / {currentPlan.shoppingList.length} abgehakt
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                {currentPlan.shoppingList.map((item, idx) => {
                  const itemKey = `${item.category}-${item.item}-${idx}`;
                  const isChecked = !!checkedShoppingItems[itemKey];

                  return (
                    <div
                      key={itemKey}
                      onClick={() => toggleShoppingItem(itemKey)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: isChecked ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                        border: isChecked ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '5px',
                        border: isChecked ? 'none' : '2px solid var(--text-muted)',
                        background: isChecked ? '#22c55e' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff'
                      }}>
                        {isChecked && <Check size={14} />}
                      </div>

                      <div>
                        <span style={{
                          fontSize: '0.9rem',
                          color: isChecked ? 'var(--text-muted)' : '#fff',
                          textDecoration: isChecked ? 'line-through' : 'none',
                          display: 'block'
                        }}>
                          {item.item}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {item.category}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
}
