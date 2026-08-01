import React, { useState, useEffect } from 'react';
import { Utensils, ShoppingBag, Sparkles, Check, Clock, Save, RefreshCw, ChefHat } from 'lucide-react';
import type { NutritionProfile, NutritionPlan } from '../types';
import { fetchNutritionProfile, upsertNutritionProfile, fetchNutritionPlan, generateAiNutritionPlan, fetchBodyMetricsInputs } from '../services/plannerApi';
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

export const NutritionDashboard: React.FC<NutritionDashboardProps> = ({ selectedDayFocus = 'Trainingstag (V-Shape Focus)' }) => {
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
  const [dayFocus, setDayFocus] = useState<string>(selectedDayFocus);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  useEffect(() => {
    fetchBodyMetricsInputs().then(() => setLiveMetrics(getLiveBodyMetrics()));
    fetchNutritionProfile().then(p => setProfile(p));
    fetchNutritionPlan().then(p => setCurrentPlan(p));
  }, []);

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
              <strong style={{ fontSize: '1.1rem', color: '#38bdf8' }}>{liveMetrics.carbsGrams}g</strong>
            </div>
          </div>
        </div>
      </div>

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
                <option value="Erholungstag (Rest Day / Regeneration)">
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

              <div style={{ display: 'flex', gap: '14px', fontSize: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                  🔥 <strong>{currentPlan.totalCalories}</strong> kcal <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Ziel: {liveMetrics.targetCalories} kcal)</span>
                </span>
                {currentPlan.estimatedTotalPriceEur !== undefined && (
                  <span style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                    🏷️ <strong>ca. {currentPlan.estimatedTotalPriceEur.toFixed(2)} €</strong> <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>(🇦🇹 Supermarkt)</span>
                  </span>
                )}
                <span style={{ color: '#ef4444' }}>🥩 <strong>{currentPlan.totalProtein}g</strong> Prot</span>
                <span style={{ color: '#eab308' }}>🥑 <strong>{currentPlan.totalFat}g</strong> Fett</span>
                <span style={{ color: '#38bdf8' }}>🍚 <strong>{currentPlan.totalCarbs}g</strong> Carbs</span>
              </div>
            </div>
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
                      <span className="badge-pill" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        🏷️ ca. {meal.estimatedPriceEur.toFixed(2)} €
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShoppingBag size={20} style={{ color: '#22c55e' }} />
                  Einkaufsliste für deine Kochen-Session
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {Object.values(checkedShoppingItems).filter(Boolean).length} / {currentPlan.shoppingList.length} abgehakt
                </span>
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
