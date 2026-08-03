/**
 * PLANNER AI ASSISTANT - D1 Worker Engine
 * Handles Task Storage (D1 SQL), Daily History (streak graph / journal / Grid Broken),
 * Telegram Webhooks (Text & Voice), and AI Parsing.
 * Includes Cron Trigger for Reminders
 */

// Infer morning/evening phase from an HH:mm time string when not explicitly provided
function inferType(time) {
  if (!time) return 'morning';
  const hour = parseInt(String(time).split(':')[0], 10);
  return hour < 12 ? 'morning' : 'evening';
}

export default {
  // 1. Fetch Handler (API + Webhook)
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    const path = url.pathname;
    console.log(`[REQUEST] ${request.method} ${path}`);

    try {
      // --- Auth Endpoint ---
      if (path === '/auth' || path === '/auth/') {
        if (request.method === 'POST') {
          const { password } = await request.json();
          const adminPass = env.ADMIN_PASSWORD;
          if (adminPass && password && String(password).trim() === String(adminPass).trim()) {
            return new Response(JSON.stringify({ success: true, authenticated: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            return new Response(JSON.stringify({ success: false, authenticated: false, error: 'Ungültiges Passwort' }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      }

      // --- API Endpoints ---
      if (path === '/tasks') {
        if (request.method === 'GET') {
          const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

          // --- Migration: Auto-add columns if missing ---
          try {
            await env.DB.prepare("SELECT weekdays FROM tasks LIMIT 1").run();
          } catch (e) {
            console.log("Migration: Adding weekdays column...");
            await env.DB.prepare("ALTER TABLE tasks ADD COLUMN weekdays TEXT").run();
          }
          try {
            await env.DB.prepare("SELECT type FROM tasks LIMIT 1").run();
          } catch (e) {
            console.log("Migration: Adding type column...");
            await env.DB.prepare("ALTER TABLE tasks ADD COLUMN type TEXT DEFAULT 'morning'").run();
          }
          try {
            await env.DB.prepare("SELECT media_url FROM tasks LIMIT 1").run();
          } catch (e) {
            console.log("Migration: Adding media_url column...");
            await env.DB.prepare("ALTER TABLE tasks ADD COLUMN media_url TEXT").run();
          }

          // 1. Reset routines that were completed on a previous day (unchecked for the new day)
          await env.DB.prepare("UPDATE tasks SET completed = 0 WHERE (is_routine = 1) AND completed = 1 AND (last_completed_date < ? OR last_completed_date IS NULL)")
            .bind(today)
            .run();

          // 2. Delete one-time tasks that were completed on a previous day (or have no completion date stored)
          await env.DB.prepare("DELETE FROM tasks WHERE (is_routine = 0 OR is_routine IS NULL) AND completed = 1 AND (last_completed_date < ? OR last_completed_date IS NULL)")
            .bind(today)
            .run();

          let { results } = await env.DB.prepare("SELECT * FROM tasks ORDER BY time ASC").all();

          return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (request.method === 'POST') {
          const { text, time, is_routine, weekdays, type, mediaUrl } = await request.json();
          await env.DB.prepare("INSERT INTO tasks (text, time, is_routine, weekdays, type, media_url) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(text, time, is_routine ? 1 : 0, weekdays || null, type || inferType(time), mediaUrl || null)
            .run();
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      if (path.startsWith('/tasks/')) {
        const id = path.split('/').pop();
        if (request.method === 'PUT') {
          const { text, time, is_routine, completed, weekdays, type, mediaUrl } = await request.json();
          const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
          const dateToStore = completed ? today : null;

          if (text !== undefined && time !== undefined) {
            await env.DB.prepare("UPDATE tasks SET text = ?, time = ?, is_routine = ?, completed = ?, last_completed_date = ?, weekdays = ?, type = ?, media_url = ? WHERE id = ?")
              .bind(text, time, is_routine ? 1 : 0, completed ? 1 : 0, dateToStore, weekdays || null, type || inferType(time), mediaUrl || null, id)
              .run();
          } else {
            await env.DB.prepare("UPDATE tasks SET completed = ?, last_completed_date = ? WHERE id = ?")
              .bind(completed ? 1 : 0, dateToStore, id)
              .run();
          }
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
        if (request.method === 'DELETE') {
          await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // --- Settings Endpoint ---
      if (path === '/settings') {
        if (request.method === 'GET') {
          const { results } = await env.DB.prepare("SELECT * FROM settings").all();
          const settingsMap = {};
          (results || []).forEach(r => { settingsMap[r.key] = r.value; });
          return new Response(JSON.stringify(settingsMap), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (request.method === 'POST' || request.method === 'PUT') {
          const body = await request.json();
          for (const [key, value] of Object.entries(body)) {
            await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").bind(key, String(value)).run();
          }
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // --- History Endpoints (streak graph / journal / Grid Broken, used by myroutine) ---
      if (path === '/history') {
        if (request.method === 'GET') {
          // --- Migration: Auto-create history table if missing ---
          await env.DB.prepare(
            "CREATE TABLE IF NOT EXISTS history (date TEXT PRIMARY KEY, completed_count INTEGER DEFAULT 0, total_count INTEGER DEFAULT 0, level INTEGER DEFAULT 0, journal TEXT)"
          ).run();

          const { results } = await env.DB.prepare("SELECT * FROM history ORDER BY date ASC").all();
          return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      if (path.startsWith('/history/')) {
        const date = path.split('/').pop();
        if (request.method === 'PUT') {
          const { completedCount, totalCount, level, journal } = await request.json();

          await env.DB.prepare(
            `INSERT INTO history (date, completed_count, total_count, level, journal) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(date) DO UPDATE SET
               completed_count = excluded.completed_count,
               total_count = excluded.total_count,
               level = excluded.level,
               journal = COALESCE(excluded.journal, history.journal)`
          )
            .bind(date, completedCount ?? 0, totalCount ?? 0, level ?? 0, journal ?? null)
            .run();

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // --- Workout History Endpoints ---
      if (path === '/workout-history' || path === '/workout-history/') {
        if (request.method === 'GET') {
          await env.DB.prepare(
            "CREATE TABLE IF NOT EXISTS workout_history (date TEXT, exercise_id TEXT, completed_sets INTEGER, PRIMARY KEY (date, exercise_id))"
          ).run();

          const { results } = await env.DB.prepare("SELECT * FROM workout_history ORDER BY date ASC").all();
          return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      if (path.startsWith('/workout-history/')) {
        const date = path.split('/').pop();
        if (request.method === 'PUT') {
          const { exercises } = await request.json();

          await env.DB.prepare(
            "CREATE TABLE IF NOT EXISTS workout_history (date TEXT, exercise_id TEXT, completed_sets INTEGER, PRIMARY KEY (date, exercise_id))"
          ).run();

          // We delete all existing records for the date and insert the new ones
          // to handle when a user unchecks all sets for an exercise.
          await env.DB.prepare("DELETE FROM workout_history WHERE date = ?").bind(date).run();

          for (const [exerciseId, sets] of Object.entries(exercises)) {
            if (sets > 0) {
              await env.DB.prepare(
                "INSERT INTO workout_history (date, exercise_id, completed_sets) VALUES (?, ?, ?)"
              )
                .bind(date, exerciseId, sets)
                .run();
            }
          }

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // --- R2 Upload & Serve Endpoints ---
      if (path === '/upload' || path === '/upload/') {
        if (request.method === 'POST') {
          const contentType = request.headers.get('Content-Type') || 'image/jpeg';
          const filename = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
          const arrayBuffer = await request.arrayBuffer();

          if (env.ASSETS) {
            await env.ASSETS.put(filename, arrayBuffer, {
              httpMetadata: { contentType },
            });
            const publicUrl = `https://planner-ai.f-klavun.workers.dev/media/${filename}`;
            return new Response(JSON.stringify({ success: true, url: publicUrl, filename }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } else {
            return new Response(JSON.stringify({ success: false, error: 'R2 ASSETS binding not found' }), {
              status: 500,
              headers: corsHeaders,
            });
          }
        }
      }

      if (path.startsWith('/media/')) {
        const filename = path.split('/')[2];
        if (request.method === 'GET') {
          if (!env.ASSETS) return new Response('R2 Binding missing', { status: 500 });
          const object = await env.ASSETS.get(filename);
          if (!object) return new Response('Not found', { status: 404 });
          const headers = new Headers(corsHeaders);
          object.writeHttpMetadata(headers);
          headers.set('etag', object.httpEtag);
          return new Response(object.body, { headers });
        }
      }

      // --- Workout Sessions Endpoints ---
      if (path === '/workout-sessions' || path === '/workout-sessions/') {
        if (request.method === 'GET') {
          await env.DB.prepare(
            "CREATE TABLE IF NOT EXISTS workout_sessions (date TEXT PRIMARY KEY, duration_seconds INTEGER DEFAULT 0, body_weight REAL, photo_url TEXT, body_fat REAL)"
          ).run();

          // Try adding body_fat column if table existed without it
          try {
            await env.DB.prepare("ALTER TABLE workout_sessions ADD COLUMN body_fat REAL").run();
          } catch (e) { /* column exists */ }

          const { results } = await env.DB.prepare("SELECT * FROM workout_sessions ORDER BY date ASC").all();
          return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      if (path.startsWith('/workout-sessions/')) {
        const date = path.split('/').pop();
        if (request.method === 'PUT') {
          const { durationSeconds, bodyWeight, photoUrl, bodyFat, neck, waist, hip } = await request.json();

          await env.DB.prepare(
            "CREATE TABLE IF NOT EXISTS workout_sessions (date TEXT PRIMARY KEY, duration_seconds INTEGER DEFAULT 0, body_weight REAL, photo_url TEXT, body_fat REAL, neck REAL, waist REAL, hip REAL)"
          ).run();

          try { await env.DB.prepare("ALTER TABLE workout_sessions ADD COLUMN body_fat REAL").run(); } catch (e) {}
          try { await env.DB.prepare("ALTER TABLE workout_sessions ADD COLUMN neck REAL").run(); } catch (e) {}
          try { await env.DB.prepare("ALTER TABLE workout_sessions ADD COLUMN waist REAL").run(); } catch (e) {}
          try { await env.DB.prepare("ALTER TABLE workout_sessions ADD COLUMN hip REAL").run(); } catch (e) {}

          await env.DB.prepare(
            `INSERT INTO workout_sessions (date, duration_seconds, body_weight, photo_url, body_fat, neck, waist, hip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(date) DO UPDATE SET
               duration_seconds = COALESCE(excluded.duration_seconds, workout_sessions.duration_seconds),
               body_weight = COALESCE(excluded.body_weight, workout_sessions.body_weight),
               photo_url = COALESCE(excluded.photo_url, workout_sessions.photo_url),
               body_fat = COALESCE(excluded.body_fat, workout_sessions.body_fat),
               neck = COALESCE(excluded.neck, workout_sessions.neck),
               waist = COALESCE(excluded.waist, workout_sessions.waist),
               hip = COALESCE(excluded.hip, workout_sessions.hip)`
          )
            .bind(date, durationSeconds ?? 0, bodyWeight ?? null, photoUrl ?? null, bodyFat ?? null, neck ?? null, waist ?? null, hip ?? null)
            .run();

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // --- Daily Macro Logs Endpoints (Food Tracking) ---
      if (path === '/macro-logs' || path === '/macro-logs/') {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS daily_macro_logs (
            id TEXT PRIMARY KEY,
            date TEXT,
            time TEXT,
            meal_name TEXT,
            calories INTEGER DEFAULT 0,
            protein INTEGER DEFAULT 0,
            fat INTEGER DEFAULT 0,
            carbs INTEGER DEFAULT 0,
            photo_url TEXT,
            created_at TEXT
          )`
        ).run();

        if (request.method === 'GET') {
          const urlObj = new URL(request.url);
          const monthParam = urlObj.searchParams.get('month');
          const allParam = urlObj.searchParams.get('all');
          const dateParam = urlObj.searchParams.get('date');

          if (monthParam) {
            const { results } = await env.DB.prepare("SELECT * FROM daily_macro_logs WHERE date LIKE ? ORDER BY date ASC, time ASC").bind(`${monthParam}%`).all();
            return new Response(JSON.stringify(results || []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          if (allParam === 'true') {
            const { results } = await env.DB.prepare("SELECT * FROM daily_macro_logs ORDER BY date ASC, time ASC").all();
            return new Response(JSON.stringify(results || []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          const targetDate = dateParam || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
          const { results } = await env.DB.prepare("SELECT * FROM daily_macro_logs WHERE date = ? ORDER BY time ASC").bind(targetDate).all();
          return new Response(JSON.stringify(results || []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (request.method === 'POST') {
          const body = await request.json();
          const todayStr = body.date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
          const nowTime = body.time || new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date());
          const id = body.id || `meal_${Date.now()}`;

          await env.DB.prepare(
            `INSERT INTO daily_macro_logs (id, date, time, meal_name, calories, protein, fat, carbs, photo_url, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(id, todayStr, nowTime, body.meal_name || 'Mahlzeit', body.calories || 0, body.protein || 0, body.fat || 0, body.carbs || 0, body.photo_url || null, new Date().toISOString())
            .run();

          return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      if (path.startsWith('/macro-logs/')) {
        const mealId = path.split('/').pop();
        if (request.method === 'DELETE') {
          await env.DB.prepare("DELETE FROM daily_macro_logs WHERE id = ?").bind(mealId).run();
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // --- Weekly Coach Report Endpoints ---
      if (path === '/weekly-coach-report' || path === '/weekly-coach-report/') {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS weekly_coach_reports (
            id TEXT PRIMARY KEY DEFAULT 'current_week',
            week_start TEXT,
            week_end TEXT,
            score INTEGER DEFAULT 85,
            summary TEXT,
            highlights TEXT,
            recommendations TEXT,
            created_at TEXT
          )`
        ).run();

        if (request.method === 'GET') {
          const row = await env.DB.prepare("SELECT * FROM weekly_coach_reports WHERE id = 'current_week'").first();
          if (row) {
            return new Response(JSON.stringify({
              ...row,
              highlights: JSON.parse(row.highlights || "[]"),
              recommendations: JSON.parse(row.recommendations || "[]")
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify(null), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (request.method === 'POST') {
          const workouts = await env.DB.prepare("SELECT * FROM workout_sessions ORDER BY date DESC LIMIT 7").all();
          const metrics = await env.DB.prepare("SELECT * FROM body_metrics_inputs WHERE id = 'user_default'").first();
          const macros = await env.DB.prepare("SELECT SUM(calories) as cals, SUM(protein) as prot FROM daily_macro_logs").first();
          const tasks = await env.DB.prepare("SELECT COUNT(*) as count FROM tasks WHERE completed = 1").first();

          const prompt = `Du bist ein hochklassiger V-Shape Fitness & Performance Coach.
Analysiere die Daten der vergangenen Woche für deinen Klienten:
- Absolvierte Workouts in 7 Tagen: ${workouts.results?.length || 0}
- Aktuelles Gewicht: ${metrics?.weight || 90} kg, Nacken: ${metrics?.neck || 44} cm, Bauch: ${metrics?.waist || 100} cm
- Erfüllte Rituale/Aufgaben: ${tasks?.count || 0}
- Getrackte Nährwerte: ${macros?.cals || 0} kcal, ${macros?.prot || 0}g Eiweiß

Erstelle einen inspirierenden, hochprofessionellen Wochen-Report im JSON Format:
{
  "score": (Score von 0-100 basierend auf der Leistung),
  "summary": "Ein prägnanter, motivierender Absatz zur Leistung der Woche auf Deutsch",
  "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"],
  "recommendations": ["Empfehlung 1 für nächste Woche", "Empfehlung 2", "Empfehlung 3"]
}`;

          const apiKey = getGeminiApiKey(env);
          const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          });
          const aiData = await res.json();
          let text = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          if (text.includes('```')) text = text.replace(/```json|```/g, '').trim();
          let coachJson = { score: 88, summary: "Solide Leistung in dieser Woche. Dein V-Shape Fokus zeigt kontinuierliche Fortschritte!", highlights: ["Körperfett und Umfang-Messungen regelmäßig erfasst", "Ritual-Erfüllung auf hohem Niveau"], recommendations: ["Protein-Zufuhr weiterhin bei mind. 2g/kg halten", "Progressive Überlastung beim Grundtraining anstreben"] };
          try { coachJson = JSON.parse(text); } catch(e) {}

          const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
          const reportData = {
            id: 'current_week',
            week_start: todayStr,
            week_end: todayStr,
            score: coachJson.score || 88,
            summary: coachJson.summary || "Solide Leistung in dieser Woche.",
            highlights: JSON.stringify(coachJson.highlights || []),
            recommendations: JSON.stringify(coachJson.recommendations || []),
            created_at: new Date().toISOString()
          };

          await env.DB.prepare(
            `INSERT INTO weekly_coach_reports (id, week_start, week_end, score, summary, highlights, recommendations, created_at)
             VALUES ('current_week', ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               score = excluded.score,
               summary = excluded.summary,
               highlights = excluded.highlights,
               recommendations = excluded.recommendations,
               created_at = excluded.created_at`
          )
            .bind(reportData.week_start, reportData.week_end, reportData.score, reportData.summary, reportData.highlights, reportData.recommendations, reportData.created_at)
            .run();

          return new Response(JSON.stringify({
            ...reportData,
            highlights: coachJson.highlights,
            recommendations: coachJson.recommendations
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // --- Body Metrics Calculator Inputs Endpoint ---
      if (path === '/body-metrics-inputs' || path === '/body-metrics-inputs/') {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS body_metrics_inputs (
            id TEXT PRIMARY KEY DEFAULT 'user_default',
            gender TEXT DEFAULT 'male',
            age INTEGER DEFAULT 27,
            weight REAL DEFAULT 90,
            height REAL DEFAULT 186,
            neck REAL DEFAULT 44,
            waist REAL DEFAULT 100,
            hip REAL DEFAULT 100,
            target_kfa REAL DEFAULT 7.0,
            activity_level REAL DEFAULT 1.55,
            target_deficit_mode REAL DEFAULT 500,
            updated_at TEXT
          )`
        ).run();

        if (request.method === 'GET') {
          const row = await env.DB.prepare("SELECT * FROM body_metrics_inputs WHERE id = 'user_default'").first();
          if (row) {
            return new Response(JSON.stringify({
              gender: row.gender || 'male',
              age: Number(row.age) || 27,
              weight: Number(row.weight) || 90,
              height: Number(row.height) || 186,
              neck: Number(row.neck) || 44,
              waist: Number(row.waist) || 100,
              hip: Number(row.hip) || 100,
              targetKfa: Number(row.target_kfa) || 7.0,
              activityLevel: Number(row.activity_level) || 1.55,
              targetDeficitMode: Number(row.target_deficit_mode) || 500
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({
            gender: 'male',
            age: 27,
            weight: 90,
            height: 186,
            neck: 44,
            waist: 100,
            hip: 100,
            targetKfa: 7.0,
            activityLevel: 1.55,
            targetDeficitMode: 500
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (request.method === 'PUT' || request.method === 'POST') {
          const body = await request.json();
          const now = new Date().toISOString();
          await env.DB.prepare(
            `INSERT INTO body_metrics_inputs (id, gender, age, weight, height, neck, waist, hip, target_kfa, activity_level, target_deficit_mode, updated_at)
             VALUES ('user_default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               gender = excluded.gender,
               age = excluded.age,
               weight = excluded.weight,
               height = excluded.height,
               neck = excluded.neck,
               waist = excluded.waist,
               hip = excluded.hip,
               target_kfa = excluded.target_kfa,
               activity_level = excluded.activity_level,
               target_deficit_mode = excluded.target_deficit_mode,
               updated_at = excluded.updated_at`
          )
            .bind(
              body.gender || 'male',
              body.age ?? 27,
              body.weight ?? 90,
              body.height ?? 186,
              body.neck ?? 44,
              body.waist ?? 100,
              body.hip ?? 100,
              body.targetKfa ?? body.target_kfa ?? 7.0,
              body.activityLevel ?? body.activity_level ?? 1.55,
              body.targetDeficitMode ?? body.target_deficit_mode ?? 500,
              now
            )
            .run();

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // --- Nutrition Profile & Plans Endpoints ---
      if (path === '/nutrition-profile' || path === '/nutrition-profile/') {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS nutrition_profile (
            id TEXT PRIMARY KEY DEFAULT 'user_default',
            meals_per_day INTEGER DEFAULT 3,
            breakfast_type TEXT DEFAULT 'normal',
            diet_focus TEXT DEFAULT 'high_protein',
            preferences TEXT DEFAULT '',
            allergies TEXT DEFAULT '',
            updated_at TEXT
          )`
        ).run();

        if (request.method === 'GET') {
          const profile = await env.DB.prepare("SELECT * FROM nutrition_profile WHERE id = 'user_default'").first();
          return new Response(JSON.stringify(profile || {
            meals_per_day: 3,
            breakfast_type: 'normal',
            diet_focus: 'high_protein',
            preferences: '',
            allergies: ''
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (request.method === 'PUT' || request.method === 'POST') {
          const { meals_per_day, breakfast_type, diet_focus, preferences, allergies } = await request.json();
          const now = new Date().toISOString();
          await env.DB.prepare(
            `INSERT INTO nutrition_profile (id, meals_per_day, breakfast_type, diet_focus, preferences, allergies, updated_at)
             VALUES ('user_default', ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               meals_per_day = excluded.meals_per_day,
               breakfast_type = excluded.breakfast_type,
               diet_focus = excluded.diet_focus,
               preferences = excluded.preferences,
               allergies = excluded.allergies,
               updated_at = excluded.updated_at`
          )
            .bind(meals_per_day ?? 3, breakfast_type ?? 'normal', diet_focus ?? 'high_protein', preferences ?? '', allergies ?? '', now)
            .run();

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      if (path === '/nutrition-plans' || path === '/nutrition-plans/') {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS nutrition_plans (
            id TEXT PRIMARY KEY DEFAULT 'current_plan',
            plan_json TEXT,
            updated_at TEXT
          )`
        ).run();

        if (request.method === 'GET') {
          const row = await env.DB.prepare("SELECT * FROM nutrition_plans WHERE id = 'current_plan'").first();
          let planData = null;
          if (row && row.plan_json) {
            try { planData = JSON.parse(row.plan_json); } catch (e) { }
          }
          return new Response(JSON.stringify({ plan: planData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (request.method === 'PUT' || request.method === 'POST') {
          const { plan } = await request.json();
          const now = new Date().toISOString();
          const jsonStr = JSON.stringify(plan);
          await env.DB.prepare(
            `INSERT INTO nutrition_plans (id, plan_json, updated_at)
             VALUES ('current_plan', ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               plan_json = excluded.plan_json,
               updated_at = excluded.updated_at`
          ).bind(jsonStr, now).run();

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      if (path === '/send-telegram-nutrition' || path === '/send-telegram-nutrition/') {
        if (request.method === 'POST') {
          const chatIdResult = await env.DB.prepare("SELECT value FROM settings WHERE key = 'telegram_chat_id'").first();
          if (!chatIdResult || !chatIdResult.value) {
            return new Response(JSON.stringify({
              success: false,
              error: "Keine Telegram Chat-ID gefunden! Bitte schreibe zuerst einmal '/start' an deinen Telegram Bot."
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
          }

          const { plan } = await request.json();
          if (!plan) {
            return new Response(JSON.stringify({ success: false, error: "Kein Ernährungsplan vorhanden." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
          }

          let msg = `🥗 V-Shape KI Tages-Ernährungsplan\n`;
          msg += `📅 ${plan.dayName || 'Tagesplan'}\n`;
          msg += `🔥 ${plan.totalCalories} kcal (P: ${plan.totalProtein}g | F: ${plan.totalFat}g | C: ${plan.totalCarbs}g)\n`;
          if (plan.estimatedTotalPriceEur) {
            msg += `🏷️ Teller-Kosten: ca. ${Number(plan.estimatedTotalPriceEur).toFixed(2)} €\n`;
          }
          msg += `\n-------------------------------\n\n`;

          msg += `🍽️ MAHLZEITEN:\n`;
          if (plan.meals && plan.meals.length > 0) {
            plan.meals.forEach((meal) => {
              msg += `\n⏰ ${meal.time || ''} UHR - ${meal.name}\n`;
              msg += `🔥 ${meal.calories} kcal (P: ${meal.protein}g | F: ${meal.fat}g | C: ${meal.carbs}g)`;
              if (meal.estimatedPriceEur) {
                msg += ` | 🏷️ ca. ${Number(meal.estimatedPriceEur).toFixed(2)} €`;
              }
              if (meal.ingredients && meal.ingredients.length > 0) {
                msg += `\nZutaten: ${meal.ingredients.join(', ')}`;
              }
              msg += `\n`;
            });
          }

          if (plan.shoppingList && plan.shoppingList.length > 0) {
            msg += `\n-------------------------------\n\n`;
            msg += `🛒 EINKAUFSLISTE`;
            if (plan.estimatedSupermarketReceiptEur) {
              msg += ` (🇦🇹 Kassenbon: ca. ${Number(plan.estimatedSupermarketReceiptEur).toFixed(2)} €)`;
            }
            msg += `:\n\n`;

            const categories = {};
            plan.shoppingList.forEach(item => {
              const cat = item.category || 'Sonstiges';
              if (!categories[cat]) categories[cat] = [];
              categories[cat].push(item.item);
            });

            for (const [cat, items] of Object.entries(categories)) {
              msg += `📌 ${cat}:\n`;
              items.forEach(it => {
                msg += `[ ] ${it}\n`;
              });
              msg += `\n`;
            }
          }

          msg += `💪 Generiert für Fatih Limitless! YOU ARE THE MASTER!`;

          await sendTelegramMessage(chatIdResult.value, msg, env);

          return new Response(JSON.stringify({ success: true, message: "Ernährungsplan & Einkaufsliste erfolgreich an deinen Telegram Bot gesendet!" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      if (path === '/generate-nutrition-plan' || path === '/generate-nutrition-plan/') {
        if (request.method === 'POST') {
          const { profile, metrics, dayFocus } = await request.json();

          const prompt = `Du bist ein professioneller V-Shape Fitness Ernährungsberater & Chefkoch.
Erstelle einen maßgeschneiderten Tages-Ernährungsplan sowie eine gesammelte Einkaufsliste für diesen Tag auf Deutsch.
BERECHNE DIE KOSTEN (IN EUR €) FÜR ÖSTERREICHISCHE SUPERMÄRKTE (HOFER, BILLA, SPAR):
1. "estimatedPriceEur": Anteiliger PORTIONSPREIS für diesen einen Teller (z.B. 250g Hähnchen anteilig von 500g Packung ~2.95€ + Reis + Brokkoli = ca. 4.60€ Portionspreis).
2. "estimatedTotalPriceEur": Summe der Teller-Portionspreise des Tages (z.B. ca. 9.80€/Tag).
3. "estimatedSupermarketReceiptEur": Geschätzter KASSENBON-TOTALBETRAG an der Supermarktkasse für alle GANZEN Packungen aus der Einkaufsliste (z.B. 500g Packung Hähnchen + 1kg Sack Reis + Brokkoli + Olivenöl usw. = ca. 18.50€ Kassenbon).

METRIKEN & ZIELE:
- Ziel-Kalorien: ${metrics?.targetCalories || 2200} kcal/Tag
- Protein-Ziel: ${metrics?.proteinGrams || 160}g
- Fett-Ziel: ${metrics?.fatGrams || 70}g
- Kohlenhydrate-Ziel: ${metrics?.carbsGrams || 200}g
- Tag-Fokus: ${dayFocus || 'Trainingstag (Brust & Bizeps)'}
- Mahlzeiten pro Tag: ${profile?.meals_per_day || 3}
- Frühstücks-Typ: ${profile?.breakfast_type || 'normal'} (wenn 'intermittent_fasting' 16:8, dann erstes Essen erst mittags!)
- Diät-Fokus: ${profile?.diet_focus || 'high_protein'}
- Vorlieben: ${profile?.preferences || 'keine'}
- Allergien/Ausschlüsse: ${profile?.allergies || 'keine'}

Antworte AUSSCHLIESSLICH im folgenden gültigen JSON Format ohne Markdown Formattierung:
{
  "dayName": "${dayFocus || 'Trainingstag'}",
  "totalCalories": ${metrics?.targetCalories || 2200},
  "totalProtein": ${metrics?.proteinGrams || 160},
  "totalFat": ${metrics?.fatGrams || 70},
  "totalCarbs": ${metrics?.carbsGrams || 200},
  "estimatedTotalPriceEur": 9.80,
  "estimatedSupermarketReceiptEur": 18.50,
  "meals": [
    {
      "time": "08:30",
      "name": "Name der Mahlzeit",
      "calories": 500,
      "protein": 40,
      "fat": 15,
      "carbs": 50,
      "estimatedPriceEur": 3.20,
      "ingredients": ["100g Haferflocken", "30g Whey Protein", "200ml Mandelmilch"],
      "instructions": "Kurze einfache Zubereitungsinstruktionen..."
    }
  ],
  "shoppingList": [
    { "category": "Protein & Fleisch", "item": "Hähnchenbrust 500g Packung" },
    { "category": "Gemüse & Obst", "item": "Brokkoli 1 Kopf" }
  ]
}`;

          let aiPlanResult = null;

          if (env.AI) {
            try {
              console.log("Calling Cloudflare Workers AI @cf/meta/llama-3.1-8b-instruct...");
              const aiRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
                messages: [
                  { role: 'system', content: 'Du antwortest ausschließlich im gültigen JSON Format.' },
                  { role: 'user', content: prompt }
                ]
              });
              let responseText = aiRes.response || aiRes.text || (typeof aiRes === 'string' ? aiRes : JSON.stringify(aiRes));
              if (responseText.includes('```')) {
                responseText = responseText.replace(/```json|```/g, '').trim();
              }
              aiPlanResult = JSON.parse(responseText);
            } catch (err) {
              console.warn("Cloudflare Workers AI call failed, falling back to Gemini:", err.message);
            }
          }

          const apiKey = getGeminiApiKey(env);
          if (!aiPlanResult && apiKey) {
            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
              })
            });

            if (response.ok) {
              const data = await response.json();
              let content = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (content) {
                if (content.includes('```')) {
                  content = content.replace(/```json|```/g, '').trim();
                }
                aiPlanResult = JSON.parse(content);
              }
            }
          }

          if (aiPlanResult) {
            const now = new Date().toISOString();
            await env.DB.prepare(
              `CREATE TABLE IF NOT EXISTS nutrition_plans (
                id TEXT PRIMARY KEY DEFAULT 'current_plan',
                plan_json TEXT,
                updated_at TEXT
              )`
            ).run();

            await env.DB.prepare(
              `INSERT INTO nutrition_plans (id, plan_json, updated_at)
               VALUES ('current_plan', ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 plan_json = excluded.plan_json,
                 updated_at = excluded.updated_at`
            ).bind(JSON.stringify(aiPlanResult), now).run();

            return new Response(JSON.stringify({ success: true, plan: aiPlanResult }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            return new Response(JSON.stringify({ success: false, error: 'AI generation failed' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      }

      // --- Water Tracking Endpoints ---
      if (path === '/water-logs' || path === '/water-logs/') {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS daily_water_logs (
            id TEXT PRIMARY KEY,
            date TEXT,
            time TEXT,
            amount_ml INTEGER DEFAULT 0,
            created_at TEXT
          )`
        ).run();

        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

        if (request.method === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT * FROM daily_water_logs WHERE date = ? ORDER BY time ASC`
          ).bind(todayStr).all();

          const totals = await env.DB.prepare(
            `SELECT SUM(amount_ml) as total_ml FROM daily_water_logs WHERE date = ?`
          ).bind(todayStr).first();

          return new Response(JSON.stringify({ logs: results || [], totalMl: Number(totals?.total_ml) || 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (request.method === 'POST') {
          const { amount_ml } = await request.json();
          const amount = Math.max(50, Math.min(5000, Number(amount_ml) || 250));
          const nowTime = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date());
          const logId = `water_${Date.now()}`;

          await env.DB.prepare(
            `INSERT INTO daily_water_logs (id, date, time, amount_ml, created_at) VALUES (?, ?, ?, ?, ?)`
          ).bind(logId, todayStr, nowTime, amount, new Date().toISOString()).run();

          return new Response(JSON.stringify({ success: true, id: logId }), { headers: corsHeaders });
        }

        if (request.method === 'DELETE') {
          const { id } = await request.json();
          await env.DB.prepare("DELETE FROM daily_water_logs WHERE id = ?").bind(id).run();
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // --- Progress Photos & Timeline Endpoint ---
      if (path === '/progress-photos' || path === '/progress-photos/') {
        if (request.method === 'GET') {
          let photos = [];
          try {
            const { results } = await env.DB.prepare(
              `SELECT date, body_weight, body_fat, neck, waist, photo_url FROM workout_sessions WHERE photo_url IS NOT NULL AND photo_url != '' ORDER BY date DESC`
            ).all();
            photos = results || [];
          } catch (e) {}

          return new Response(JSON.stringify({ photos }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // --- Trigger Briefings Endpoints ---
      if (path === '/trigger-morning-briefing' || path === '/trigger-morning-briefing/') {
        if (request.method === 'POST') {
          const chatIdResult = await env.DB.prepare("SELECT value FROM settings WHERE key = 'telegram_chat_id'").first();
          if (!chatIdResult || !chatIdResult.value) {
            return new Response(JSON.stringify({ success: false, error: 'Telegram Chat ID not stored yet. Please message the bot first!' }), { status: 400, headers: corsHeaders });
          }
          await sendMorningBriefing(chatIdResult.value, env);
          return new Response(JSON.stringify({ success: true, message: 'Morning Briefing sent to Telegram!' }), { headers: corsHeaders });
        }
      }

      if (path === '/trigger-evening-recap' || path === '/trigger-evening-recap/') {
        if (request.method === 'POST') {
          const chatIdResult = await env.DB.prepare("SELECT value FROM settings WHERE key = 'telegram_chat_id'").first();
          if (!chatIdResult || !chatIdResult.value) {
            return new Response(JSON.stringify({ success: false, error: 'Telegram Chat ID not stored yet. Please message the bot first!' }), { status: 400, headers: corsHeaders });
          }
          await sendEveningRecap(chatIdResult.value, env);
          return new Response(JSON.stringify({ success: true, message: 'Evening Recap sent to Telegram!' }), { headers: corsHeaders });
        }
      }

      // --- Telegram Webhook ---
      if ((path === '/webhook' || path === '/webhook/')) {
        if (request.method === 'POST') {
          return await handleTelegramUpdate(request, env);
        }
        if (request.method === 'GET') {
          return new Response('Webhook endpoint is reachable! 📡', { headers: corsHeaders });
        }
      }

      return new Response('Planner AI D1 Worker Online', { status: 200 });

    } catch (err) {
      console.error('Global Worker Error:', err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },

  // 2. Scheduled Handler (Cron Trigger)
  async scheduled(event, env, ctx) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

    // 1. Reset routines for the current day
    await env.DB.prepare("UPDATE tasks SET completed = 0 WHERE (is_routine = 1) AND completed = 1 AND (last_completed_date < ? OR last_completed_date IS NULL)")
      .bind(today)
      .run();

    // 2. Delete completed one-time tasks from previous days (or those without a completion date)
    await env.DB.prepare("DELETE FROM tasks WHERE (is_routine = 0 OR is_routine IS NULL) AND completed = 1 AND (last_completed_date < ? OR last_completed_date IS NULL)")
      .bind(today)
      .run();

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      hour12: false
    });

    const currentTimeStr = formatter.format(now);

    const targetDate = new Date(now.getTime() + 10 * 60000);
    const targetTimeStr = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      hour12: false
    }).format(targetDate);

    // Get Current Day of Week (1-7, 1=Monday)
    const dow = now.getDay();
    const currentDow = dow === 0 ? 7 : dow; // Map Sunday from 0 to 7

    console.log(`Cron Check: [Now: ${currentTimeStr}] [Future: ${targetTimeStr}] [Day: ${currentDow}]`);

    // Automatic Briefings Trigger (07:00 Morning Briefing & 21:00 Evening Recap)
    const chatIdResult = await env.DB.prepare("SELECT value FROM settings WHERE key = 'telegram_chat_id'").first();
    const chatIdForBriefing = chatIdResult && chatIdResult.value;
    if (chatIdForBriefing) {
      const mTimeRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'morning_briefing_time'").first();
      const eTimeRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'evening_recap_time'").first();
      const mTime = (mTimeRes && mTimeRes.value) ? mTimeRes.value : "07:00";
      const eTime = (eTimeRes && eTimeRes.value) ? eTimeRes.value : "21:00";

      if (currentTimeStr === mTime) {
        await sendMorningBriefing(chatIdForBriefing, env);
      }
      if (currentTimeStr === eTime) {
        await sendEveningRecap(chatIdForBriefing, env);
      }

      // --- Smart Hydration Reminder ---
      // Fires every full hour between 10:00 and 20:00, only if behind on water pace
      const berlinHour = parseInt(new Intl.DateTimeFormat('de-DE', {
        timeZone: 'Europe/Berlin',
        hour: '2-digit',
        hourCycle: 'h23',
        hour12: false
      }).format(now), 10);
      const berlinMinute = parseInt(new Intl.DateTimeFormat('de-DE', {
        timeZone: 'Europe/Berlin',
        minute: '2-digit'
      }).format(now), 10);

      const isHydrationCheckTime = berlinMinute === 0 && berlinHour >= 10 && berlinHour <= 20;

      if (isHydrationCheckTime) {
        try {
          const TARGET_ML = 3500;
          const DAY_START_HOUR = 7;
          const DAY_END_HOUR = 22;
          const totalDayMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
          const elapsedMinutes = Math.max(0, (berlinHour - DAY_START_HOUR) * 60 + berlinMinute);
          const expectedSoFar = Math.round((elapsedMinutes / totalDayMinutes) * TARGET_ML);

          const waterResult = await env.DB.prepare(
            "SELECT COALESCE(SUM(amount_ml), 0) as total FROM daily_water_logs WHERE date = ?"
          ).bind(today).first();

          const actualMl = waterResult ? Number(waterResult.total) : 0;
          const deficit = expectedSoFar - actualMl;
          const percentDone = Math.round((actualMl / TARGET_ML) * 100);

          if (deficit >= 500) {
            const messages = [
              `💧 Hydration Alert! Du bist ${deficit}ml hinter deinem Soll-Tempo.\n\n📊 Aktuell: ${actualMl}ml / ${TARGET_ML}ml (${percentDone}%)\n🎯 Erwartet bis ${berlinHour}:00 Uhr: ${expectedSoFar}ml\n\nTrink jetzt mindestens ${Math.round(deficit/250)*250}ml! 🚰`,
              `🚨 Wasser-Check! Bis ${berlinHour}:00 Uhr solltest du ${expectedSoFar}ml getrunken haben — du hast erst ${actualMl}ml.\n\nFehlen noch: ${deficit}ml. Flasche holen! 💪`,
              `💧 Psst — dein Körper fragt nach Wasser!\n\nSoll: ${expectedSoFar}ml | Ist: ${actualMl}ml\nDu bist ${deficit}ml im Rückstand. Zeit für eine große Flasche! 🥤`
            ];
            const msg = messages[berlinHour % messages.length];
            await sendTelegramMessage(chatIdForBriefing, msg, env);
          }
        } catch (e) {
          console.error('Hydration check failed:', e.message);
        }
      }
    }

    // 2. Fetch tasks for both NOW and 10 MIN LATER (only those not completed)
    // We filter in the logic for weekdays to handle NULL/Empty values correctly
    const { results } = await env.DB.prepare("SELECT * FROM tasks WHERE (time = ? OR time = ?) AND completed = 0")
      .bind(currentTimeStr, targetTimeStr)
      .all();

    if (results.length > 0) {
      const chatIdResult = await env.DB.prepare("SELECT value FROM settings WHERE key = 'telegram_chat_id'").first();
      if (chatIdResult) {
        // --- IDEA 3: WEEKLY RISK BUDGET CHECK ---
        let budgetWarning = "";
        try {
          const budgetRes = await fetch("https://fatdesign-trading-bot.f-klavun.workers.dev/weekly-budget-status?account=ALL", {
            headers: { 'X-Admin-Password': env.ADMIN_PASSWORD }
          });
          if (budgetRes.ok) {
            const b = await budgetRes.json();
            if (b.limit_exceeded) {
              budgetWarning = "🚫 **WEEKLY LIMIT EXCEEDED!**\nFokus heute: Backtesting / Analyse. KEIN LIVE TRADING.";
            }
          }
        } catch (e) { console.log("Budget check failed", e.message); }

        for (const task of results) {
          // Weekday Check
          if (task.weekdays) {
            const days = String(task.weekdays).split(',').map(d => d.trim());
            if (!days.includes(String(currentDow))) continue;
          }

          let reminderText = task.text;
          if (budgetWarning && (reminderText.toLowerCase().includes("trading") || reminderText.toLowerCase().includes("markt"))) {
            reminderText = `⚠️ **STOPP!** ${reminderText}\n\n${budgetWarning}`;
          }

          if (task.time === currentTimeStr) {
            await sendTelegramMessage(chatIdResult.value, `🚀 JETZT FÄLLIG:\n"${reminderText}"`, env);
          }
          if (task.time === targetTimeStr) {
            await sendTelegramMessage(chatIdResult.value, `⏰ IN 10 MINUTEN:\n"${reminderText}"`, env);
          }
        }
      }
    }
  }
};

// --- Telegram Logic ---
async function handleTelegramUpdate(request, env) {
  const clonedRequest = request.clone();

  try {
    const update = await request.json();
    if (!update.message) return new Response('OK');

    const chatId = update.message.chat.id;
    const ALLOWED_CHAT_ID = env.TELEGRAM_OWNER_ID;

    if (ALLOWED_CHAT_ID && String(chatId) !== String(ALLOWED_CHAT_ID)) {
      await sendTelegramMessage(chatId, "🚫 Zugriff verweigert. Dieser Bot ist privat und für ein anderes Konto konfiguriert.", env);
      return new Response('OK');
    }

    // Save Chat ID for future reminders
    await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('telegram_chat_id', ?)")
      .bind(String(chatId))
      .run();

    if (update.message.text === '/start') {
      await sendTelegramMessage(chatId, "Hallo! 🤖 Ich bin dein Planner AI Assistent.\n\nDu kannst mir schreiben oder einfach eine Sprachnachricht oder ein Foto deines Essens schicken, z.B.:\n- 📸 Foto von deinem Teller (KI erkennt Mahlzeit & Makros!)\n- '1 gekochtes Ei' (exaktes Tracking!)\n- 'Gewicht 91.5 kg, Nacken 44, Bauch 97'\n\n💡 Tipp: Mit /delete_last_meal oder /loeschen kannst du die letzte Mahlzeit stornieren.", env);
      return new Response('OK');
    }

    if (update.message.text === '/delete_last_meal' || update.message.text === '/loeschen') {
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
      const lastMeal = await env.DB.prepare("SELECT * FROM daily_macro_logs WHERE date = ? ORDER BY created_at DESC LIMIT 1").bind(todayStr).first();
      if (lastMeal) {
        await env.DB.prepare("DELETE FROM daily_macro_logs WHERE id = ?").bind(lastMeal.id).run();
        await sendTelegramMessage(chatId, `🗑️ Letzte Mahlzeit gelöscht: "${lastMeal.meal_name}" (${lastMeal.calories} kcal, ${lastMeal.protein}g P).`, env);
      } else {
        await sendTelegramMessage(chatId, `ℹ️ Heute wurden keine Mahlzeiten getrackt.`, env);
      }
      return new Response('OK');
    }

    let userText = update.message.text || update.message.caption || "";
    let audioData = null;
    let photoData = null;
    let telegramPhotoUrl = null;

    // Handle Photo Messages
    if (update.message.photo && update.message.photo.length > 0) {
      console.log('Photo message detected!');
      await sendTelegramAction(chatId, 'typing', env);
      const photos = update.message.photo;
      const largestPhoto = photos[photos.length - 1];

      try {
        const getFileUrl = `https://api.telegram.org/bot${env.PLANNER_TELEGRAM}/getFile?file_id=${largestPhoto.file_id}`;
        const res = await fetch(getFileUrl);
        const fileData = await res.json();
        if (fileData.ok) {
          const filePath = fileData.result.file_path;
          const downloadUrl = `https://api.telegram.org/file/bot${env.PLANNER_TELEGRAM}/${filePath}`;
          const fileRes = await fetch(downloadUrl);
          const arrayBuffer = await fileRes.arrayBuffer();

          // Upload to R2 bucket ASSETS
          const filename = `photo_${Date.now()}_tg.jpg`;
          if (env.ASSETS) {
            await env.ASSETS.put(filename, arrayBuffer, {
              httpMetadata: { contentType: 'image/jpeg' },
            });
            telegramPhotoUrl = `https://planner-ai.f-klavun.workers.dev/media/${filename}`;
            console.log('Telegram photo successfully uploaded to R2:', telegramPhotoUrl);
          }

          // Also set photoData for Gemini parsing (Base64)
          photoData = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        }
      } catch (e) {
        console.error('Failed to upload telegram photo to R2:', e.message);
      }

      if (!userText) userText = "[Photo - See Image]";
    } else if (update.message.voice) {
      console.log('Voice message detected!');
      await sendTelegramAction(chatId, 'record_voice', env);
      const fileId = update.message.voice.file_id;
      audioData = await downloadTelegramFile(fileId, env);
      if (!userText) userText = "[Voice Message - See Audio]";
    }

    if (!userText && !audioData && !photoData) return new Response('OK');

    // AI Parsing (Handles text, audio and photos)
    console.log('Parsing with Gemini Multi-modal...');
    const aiResponse = await parseWithAI(userText, audioData, photoData, env);
    console.log('AI Response:', JSON.stringify(aiResponse));

    if (aiResponse) {
      if (aiResponse.type === 'water_log' || aiResponse.amount_ml) {
        await handleWaterLogTelegram(chatId, aiResponse, env);
      } else if (aiResponse.type === 'food_log' || aiResponse.calories || aiResponse.meal_name) {
        await handleFoodLogTelegram(chatId, aiResponse, env, telegramPhotoUrl);
      } else if (aiResponse.type === 'body_metrics' || aiResponse.weight || aiResponse.neck || aiResponse.waist) {
        await handleBodyMetricsTelegram(chatId, aiResponse, env, telegramPhotoUrl);
      } else if (aiResponse.task) {
        const time = aiResponse.time || '09:00';
        const type = aiResponse.type || inferType(time);
        await env.DB.prepare("INSERT INTO tasks (text, time, is_routine, weekdays, type) VALUES (?, ?, ?, ?, ?)")
          .bind(aiResponse.task, time, aiResponse.is_routine ? 1 : 0, aiResponse.weekdays || null, type)
          .run();

        const dayText = aiResponse.weekdays ? ` am Wochentag (${aiResponse.weekdays})` : "";
        await sendTelegramMessage(chatId, `✅ Eingetragen: "${aiResponse.task}" um ${aiResponse.time}${dayText}.`, env);
      } else {
        await sendTelegramMessage(chatId, "Entschuldige, ich konnte deine Eingabe (Essen, Körpermessung oder Aufgabe) nicht eindeutig zuordnen. Bitte probier es nochmal!", env);
      }
    } else {
      await sendTelegramMessage(chatId, "Entschuldige, ich konnte keine Eingabe verarbeiten. Bitte probier es nochmal!", env);
    }

  } catch (e) {
    console.error('Telegram Update Error:', e.message);
    try {
      const updateFallback = await clonedRequest.json();
      const fallbackChatId = updateFallback?.message?.chat?.id;
      if (fallbackChatId) {
        const isQuotaError = e.message && (e.message.includes('quota') || e.message.includes('RESOURCE_EXHAUSTED') || e.message.includes('429'));
        const userMsg = isQuotaError
          ? `⏳ KI-Limit erreicht! Die Gemini API hat das kostenlose Tageslimit (kurzzeitig) erreicht.\n\nBitte versuche es in 1-2 Minuten nochmal. Deine Nachricht wurde nicht gespeichert.`
          : `❌ Fehler: ${e.message}`;
        await sendTelegramMessage(fallbackChatId, userMsg, env);
      }
    } catch (innerError) { }
  }

  return new Response('OK');
}

// --- Water Log Handler for Telegram ---
async function handleWaterLogTelegram(chatId, waterLog, env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS daily_water_logs (
      id TEXT PRIMARY KEY,
      date TEXT,
      time TEXT,
      amount_ml INTEGER DEFAULT 0,
      created_at TEXT
    )`
  ).run();

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  const nowTime = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date());

  const logId = `water_${Date.now()}`;
  const amount = Math.max(50, Math.min(5000, Number(waterLog.amount_ml) || 250));

  await env.DB.prepare(
    `INSERT INTO daily_water_logs (id, date, time, amount_ml, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(logId, todayStr, nowTime, amount, new Date().toISOString()).run();

  const totals = await env.DB.prepare(
    `SELECT SUM(amount_ml) as total_ml FROM daily_water_logs WHERE date = ?`
  ).bind(todayStr).first();

  const totalMl = Number(totals?.total_ml) || amount;
  const targetMl = 3500;
  const percent = Math.min(100, Math.round((totalMl / targetMl) * 100));

  let statusText = "";
  if (totalMl >= targetMl) {
    statusText = `\n\n🎉 Tages-Wasserziel (3.5L) erfolgreich erreicht! Ausgezeichnete Hydration!`;
  } else {
    const remaining = targetMl - totalMl;
    statusText = `\n\n🎯 Noch ${remaining} ml bis zum Tagesziel von 3.5 Liter`;
  }

  let msg = `💧 Hydration-Tracking erfasst!\n\n`;
  msg += `🥤 Aufgenommen: +${amount} ml Wasser\n`;
  msg += `📊 Tages-Gesamt heute (${todayStr}):\n`;
  msg += `💧 ${totalMl} ml / ${targetMl} ml (${percent}%) 🚀${statusText}`;

  await sendTelegramMessage(chatId, msg, env);
}

// --- Morning Briefing Handler ---
async function sendMorningBriefing(chatId, env) {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

  const quotes = [
    "Das Hindernis auf dem Weg wird zum Weg. Vergiss nie: In jedem Hindernis steckt eine Chance. – Zen-Sprichwort",
    "Disziplin ist die Freiheit, deine Träume in die Realität umzusetzen.",
    "Du hast Macht über deinen Verstand – nicht über äußere Ereignisse. Erkenne dies, und du wirst Stärke finden. – Marcus Aurelius",
    "Wir leiden öfter in der Vorstellung als in der Realität. – Seneca",
    "Exzellenz ist keine Handlung, sondern eine Gewohnheit. – Aristoteles"
  ];
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  let routinesMsg = "";
  try {
    const { results } = await env.DB.prepare("SELECT text, time, weekdays FROM tasks WHERE is_routine = 1 ORDER BY time ASC").all();
    if (results && results.length > 0) {
      const now = new Date();
      const dow = now.getDay();
      const currentDow = dow === 0 ? 7 : dow; // Map Sunday from 0 to 7
      const filtered = results.filter(r => {
        if (!r.weekdays) return true;
        const days = String(r.weekdays).split(',').map(d => d.trim());
        return days.includes(String(currentDow));
      });
      routinesMsg = filtered.map(r => `• ${r.time || '08:00'} - ${r.text}`).join('\n');
    }
  } catch (e) {}

  const metricsRow = await env.DB.prepare("SELECT * FROM body_metrics_inputs WHERE id = 'user_default'").first();
  const targetCals = calculateTargetCaloriesFromRow(metricsRow);

  let msg = `🌅 MORGEN-BRIEFING (${todayStr})\n\n`;
  msg += `📜 Zitat des Tages:\n"${quote}"\n\n`;
  if (routinesMsg) {
    msg += `⚡ Anstehende Rituale heute:\n${routinesMsg}\n\n`;
  }
  msg += `🔥 Tages-Kalorienziel: ${targetCals} kcal (Defizit-Modus aktiv)\n`;
  msg += `💧 Wasserziel: 3500 ml\n\n`;
  msg += `💪 Machen wir heute zu einem meisterhaften Tag! YOU ARE THE MASTER! 🚀`;

  await sendTelegramMessage(chatId, msg, env);
}

// --- Evening Recap Handler ---
async function sendEveningRecap(chatId, env) {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

  let completedCount = 0;
  let totalCount = 0;
  try {
    const { results } = await env.DB.prepare("SELECT completed, weekdays FROM tasks WHERE is_routine = 1").all();
    if (results) {
      const now = new Date();
      const dow = now.getDay();
      const currentDow = dow === 0 ? 7 : dow; // Map Sunday from 0 to 7
      const filtered = results.filter(r => {
        if (!r.weekdays) return true;
        const days = String(r.weekdays).split(',').map(d => d.trim());
        return days.includes(String(currentDow));
      });
      totalCount = filtered.length;
      completedCount = filtered.filter(r => r.completed === 1).length;
    }
  } catch (e) {}

  const totals = await env.DB.prepare(
    `SELECT SUM(calories) as total_cals, SUM(protein) as total_prot, SUM(fat) as total_fat, SUM(carbs) as total_carbs
     FROM daily_macro_logs WHERE date = ?`
  ).bind(todayStr).first();

  const totalCals = Number(totals?.total_cals) || 0;
  const totalProt = Number(totals?.total_prot) || 0;
  const totalFat = Number(totals?.total_fat) || 0;
  const totalCarbs = Number(totals?.total_carbs) || 0;

  let totalMl = 0;
  try {
    const waterRow = await env.DB.prepare(
      `SELECT SUM(amount_ml) as total_ml FROM daily_water_logs WHERE date = ?`
    ).bind(todayStr).first();
    totalMl = Number(waterRow?.total_ml) || 0;
  } catch (e) {}

  const metricsRow = await env.DB.prepare("SELECT * FROM body_metrics_inputs WHERE id = 'user_default'").first();
  const targetCals = calculateTargetCaloriesFromRow(metricsRow);

  let statusMsg = "";
  if (totalCals > targetCals) {
    statusMsg = `⚠️ Kalorienziel überschritten (+${totalCals - targetCals} kcal)`;
  } else if (totalCals === 0) {
    statusMsg = `⚠️ Heute noch kein Essen getrackt.`;
  } else {
    statusMsg = `🎯 Punktlandung im Defizit! (Noch ${targetCals - totalCals} kcal Puffer)`;
  }

  let msg = `🌙 ABEND-RECAP (${todayStr})\n\n`;
  msg += `⚡ Rituale: ${completedCount} / ${totalCount} erfüllt (${totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%)\n`;
  msg += `🔥 Erfasste Kalorien: ${totalCals} / ${targetCals} kcal\n`;
  msg += `🥩 Eiweiß: ${totalProt}g | 🥑 Fett: ${totalFat}g | 🍚 Carbs: ${totalCarbs}g\n`;
  msg += `💧 Hydration: ${totalMl} ml / 3500 ml\n\n`;
  msg += `${statusMsg}\n\n`;
  msg += `😴 Erhole dich gut für den morgigen Tag! Gute Nacht Champion! 🏆`;

  await sendTelegramMessage(chatId, msg, env);
}

// --- Food Log Handler for Telegram ---
async function handleFoodLogTelegram(chatId, foodLog, env, photoUrl = null) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS daily_macro_logs (
      id TEXT PRIMARY KEY,
      date TEXT,
      time TEXT,
      meal_name TEXT,
      calories INTEGER DEFAULT 0,
      protein INTEGER DEFAULT 0,
      fat INTEGER DEFAULT 0,
      carbs INTEGER DEFAULT 0,
      photo_url TEXT,
      created_at TEXT
    )`
  ).run();

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  const nowTime = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date());

  const mealId = `meal_${Date.now()}`;
  const calories = Number(foodLog.calories) || 0;
  const protein = Number(foodLog.protein) || 0;
  const fat = Number(foodLog.fat) || 0;
  const carbs = Number(foodLog.carbs) || 0;
  const mealName = foodLog.meal_name || "Mahlzeit";

  await env.DB.prepare(
    `INSERT INTO daily_macro_logs (id, date, time, meal_name, calories, protein, fat, carbs, photo_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(mealId, todayStr, nowTime, mealName, calories, protein, fat, carbs, photoUrl, new Date().toISOString())
    .run();

  const totals = await env.DB.prepare(
    `SELECT SUM(calories) as total_cals, SUM(protein) as total_prot, SUM(fat) as total_fat, SUM(carbs) as total_carbs
     FROM daily_macro_logs WHERE date = ?`
  ).bind(todayStr).first();

  const totalCals = Number(totals?.total_cals) || calories;
  const totalProt = Number(totals?.total_prot) || protein;
  const totalFat = Number(totals?.total_fat) || fat;
  const totalCarbs = Number(totals?.total_carbs) || carbs;

  const metricsRow = await env.DB.prepare("SELECT * FROM body_metrics_inputs WHERE id = 'user_default'").first();
  const targetCals = calculateTargetCaloriesFromRow(metricsRow);

  let deficitNotice = "";
  if (totalCals > targetCals) {
    const surplus = totalCals - targetCals;
    deficitNotice = `\n\n⚠️ Kalorienziel überschritten (+${surplus} kcal über Ziel von ${targetCals} kcal)`;
  } else if (totalCals === targetCals) {
    deficitNotice = `\n\n🎯 Kalorienziel punktgenau erreicht! (${targetCals} kcal)`;
  } else {
    const remaining = targetCals - totalCals;
    deficitNotice = `\n\n🎯 Noch ${remaining} kcal offen bis zum Tagesziel (${targetCals} kcal)`;
  }

  let msg = `🥗 Ernährungstracking erfasst!\n\n`;
  msg += `🍽️ Mahlzeit: ${mealName}\n`;
  msg += `🔥 Kalorien: ~${calories} kcal\n`;
  msg += `🥩 Eiweiß: ~${protein}g | 🥑 Fett: ~${fat}g | 🍚 Carbs: ~${carbs}g\n\n`;
  msg += `📊 Tages-Gesamt heute (${todayStr}):\n`;
  msg += `🔥 ${totalCals} kcal | 🥩 ${totalProt}g Eiweiß | 🥑 ${totalFat}g Fett | 🍚 ${totalCarbs}g Carbs 🚀${deficitNotice}`;

  await sendTelegramMessage(chatId, msg, env);
}

// --- Body Metrics Handler for Telegram Voice & Text ---
async function handleBodyMetricsTelegram(chatId, metricsInput, env, photoUrl = null) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS body_metrics_inputs (
      id TEXT PRIMARY KEY DEFAULT 'user_default',
      gender TEXT DEFAULT 'male',
      age INTEGER DEFAULT 27,
      weight REAL DEFAULT 90,
      height REAL DEFAULT 186,
      neck REAL DEFAULT 44,
      waist REAL DEFAULT 100,
      hip REAL DEFAULT 100,
      target_kfa REAL DEFAULT 7.0,
      activity_level REAL DEFAULT 1.55,
      target_deficit_mode REAL DEFAULT 500,
      updated_at TEXT
    )`
  ).run();

  let existing = await env.DB.prepare("SELECT * FROM body_metrics_inputs WHERE id = 'user_default'").first();
  if (!existing) {
    existing = {
      gender: 'male', age: 27, weight: 90, height: 186, neck: 44, waist: 100, hip: 100,
      target_kfa: 7.0, activity_level: 1.55, target_deficit_mode: 500
    };
  }

  const gender = existing.gender || 'male';
  const age = Number(existing.age) || 27;
  const height = Number(existing.height) || 186;
  const weight = metricsInput.weight ? Number(metricsInput.weight) : (Number(existing.weight) || 90);
  const neck = metricsInput.neck ? Number(metricsInput.neck) : (Number(existing.neck) || 44);
  const waist = metricsInput.waist ? Number(metricsInput.waist) : (Number(existing.waist) || 100);
  const hip = metricsInput.hip ? Number(metricsInput.hip) : (Number(existing.hip) || 100);
  const targetKfa = Number(existing.target_kfa) || 7.0;
  const activityLevel = Number(existing.activity_level) || 1.55;
  const targetDeficitMode = Number(existing.target_deficit_mode) || 500;

  // Compute US Navy Body Fat KFA & Lean Mass
  let navyKfa = 0;
  if (gender === 'male') {
    if (waist > neck && height > 0) {
      const density = 1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height);
      navyKfa = (495 / density) - 450;
    }
  } else {
    if (waist + hip > neck && height > 0) {
      const density = 1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(height);
      navyKfa = (495 / density) - 450;
    }
  }
  if (navyKfa < 2) navyKfa = 2;
  if (navyKfa > 50) navyKfa = 50;

  const kfaFormatted = Number(navyKfa.toFixed(1));
  const fatMass = Number((weight * (kfaFormatted / 100)).toFixed(1));
  const leanMass = Number((weight - fatMass).toFixed(1));

  let category = 'Fitness';
  if (kfaFormatted < 6) category = 'Essentiell ⚡';
  else if (kfaFormatted < 14) category = 'Athlet (V-Shape Zone) 🔥';
  else if (kfaFormatted < 18) category = 'Fitness 🦾';
  else if (kfaFormatted < 25) category = 'Durchschnitt 📊';
  else category = 'Höherer KFA 🎯';

  const nowISO = new Date().toISOString();

  // Save updated inputs to D1
  await env.DB.prepare(
    `INSERT INTO body_metrics_inputs (id, gender, age, weight, height, neck, waist, hip, target_kfa, activity_level, target_deficit_mode, updated_at)
     VALUES ('user_default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       weight = excluded.weight,
       neck = excluded.neck,
       waist = excluded.waist,
       hip = excluded.hip,
       updated_at = excluded.updated_at`
  )
    .bind(gender, age, weight, height, neck, waist, hip, targetKfa, activityLevel, targetDeficitMode, nowISO)
    .run();

  // Auto Check-in: Save to workout_sessions for today (Europe/Berlin)
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS workout_sessions (date TEXT PRIMARY KEY, duration_seconds INTEGER DEFAULT 0, body_weight REAL, photo_url TEXT, body_fat REAL, neck REAL, waist REAL, hip REAL)`
  ).run();

  try { await env.DB.prepare("ALTER TABLE workout_sessions ADD COLUMN body_fat REAL").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE workout_sessions ADD COLUMN neck REAL").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE workout_sessions ADD COLUMN waist REAL").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE workout_sessions ADD COLUMN hip REAL").run(); } catch (e) {}

  await env.DB.prepare(
    `INSERT INTO workout_sessions (date, duration_seconds, body_weight, photo_url, body_fat, neck, waist, hip) VALUES (?, 0, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       body_weight = excluded.body_weight,
       body_fat = excluded.body_fat,
       neck = excluded.neck,
       waist = excluded.waist,
       hip = excluded.hip,
       photo_url = COALESCE(excluded.photo_url, workout_sessions.photo_url)`
  )
    .bind(todayStr, weight, photoUrl, kfaFormatted, neck, waist, hip)
    .run();

  let msg = `📊 V-Shape Körpermessung erfasst!\n\n`;
  msg += `⚖️ Gewicht: ${weight} kg\n`;
  msg += `📐 Nacken: ${neck} cm | Bauch: ${waist} cm\n`;
  msg += `🔥 KFA (US Navy): ${kfaFormatted}% (${category})\n`;
  msg += `💪 Mager-Masse: ${leanMass} kg | Fettmasse: ${fatMass} kg\n\n`;
  msg += `✅ Automatisch in deinen heutigen Check-in (${todayStr}) übernommen! 🚀`;

  await sendTelegramMessage(chatId, msg, env);
}

// --- AI Engine (Multi-modal) ---
function getGeminiApiKey(env) {
  if (!env) return '';
  return (
    env.PLANNER_KI_API ||
    env.GEMINI_API_KEY ||
    env.GEMINI_KEY ||
    env.GOOGLE_AI_KEY ||
    env.API_KEY ||
    ''
  ).trim();
}

async function parseWithAI(text, audioBase64, photoBase64, env) {

  // --- FAST PATH: Regex Pre-Parser (Water, Body Metrics & Tasks) ---
  if (text && !audioBase64 && !photoBase64) {
    const t = text.toLowerCase().trim();

    // 1. Water: "500ml", "1.5l", "2 liter", "habe 750 ml getrunken" etc.
    const waterMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(?:ml|l(?:iter)?|liter)/i);
    if (waterMatch) {
      let amount = parseFloat(waterMatch[1].replace(',', '.'));
      if (t.includes('liter') || (waterMatch[0].toLowerCase().endsWith('l') && !waterMatch[0].toLowerCase().endsWith('ml'))) amount *= 1000;
      if (amount >= 50 && amount <= 5000) {
        console.log(`Fast-path water: ${amount}ml`);
        return { type: 'water_log', amount_ml: Math.round(amount) };
      }
    }

    // 2. Body metrics: "gewicht 90 nacken 44 bauch 97" etc.
    const weightMatch = t.match(/gewicht\s+(\d+(?:[.,]\d+)?)/i);
    const neckMatch = t.match(/nacken?\s+(\d+(?:[.,]\d+)?)/i);
    const waistMatch = t.match(/(?:bauch|taille)\s+(\d+(?:[.,]\d+)?)/i);
    if (weightMatch || (neckMatch && waistMatch)) {
      return {
        type: 'body_metrics',
        weight: weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : null,
        neck: neckMatch ? parseFloat(neckMatch[1].replace(',', '.')) : null,
        waist: waistMatch ? parseFloat(waistMatch[1].replace(',', '.')) : null,
        hip: null
      };
    }

    // 3. Task / Reminder Fast Path: e.g. "Aufgabe 10:00 Boxenstopp Webseite optimieren"
    const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const hasTaskKeyword = /^(aufgabe|task|todo|erinnere|remind|routine|termin)/i.test(t);

    if (timeMatch || hasTaskKeyword) {
      const timeStr = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '09:00';
      let cleanTask = text
        .replace(/^(aufgabe|task|todo|erinnere\s+mich\s+(an\s+)?)\s*:?/i, '')
        .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, '')
        .replace(/\bum\b/gi, '')
        .trim();

      if (!cleanTask) cleanTask = text.trim();

      const isRoutine = /routine|jeden tag|täglich|jede woche/i.test(text);

      console.log(`Fast-path task: "${cleanTask}" at ${timeStr}`);
      return {
        type: 'task',
        task: cleanTask,
        time: timeStr,
        weekdays: null,
        is_routine: isRoutine
      };
    }
  }

  const prompt = `Analysiere die Nachricht (Text, Sprachnachricht oder Foto von Essen auf Deutsch).
Schätze die Nährwerte und Makros der Mahlzeit realistisch ein und antworte AUSSCHLIESSLICH im gültigen JSON-Format.

Klassifiziere die Eingabe in genau EINES der folgenden Formate:

1. ERNÄHRUNG / ESSEN (für alle gegessenen Mahlzeiten oder Lebensmittelfotos):
{
  "type": "food_log",
  "meal_name": "Name der Mahlzeit",
  "calories": 650,
  "protein": 35,
  "fat": 20,
  "carbs": 70
}

2. WASSER / HYDRATION:
{
  "type": "water_log",
  "amount_ml": 500
}

3. KÖRPERMESSUNGEN:
{
  "type": "body_metrics",
  "weight": 91.5,
  "neck": 44.0,
  "waist": 97.0,
  "hip": 100.0
}

4. AUFGABEN / REMINDER:
{
  "type": "task",
  "task": "Beschreibung der Aufgabe",
  "time": "HH:mm",
  "weekdays": "1,2..",
  "is_routine": boolean
}`;

  // Try Gemini with multi-model fallback chain: 2.0-flash -> 1.5-flash -> 2.0-flash-lite
  const apiKey = getGeminiApiKey(env);
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];
  let lastError = null;

  if (apiKey) {
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
        const parts = [{ text: prompt }];

        if (photoBase64) {
          parts.push({ inline_data: { mime_type: "image/jpeg", data: photoBase64 } });
        }
        if (audioBase64) {
          parts.push({ inline_data: { mime_type: "audio/ogg", data: audioBase64 } });
        }
        if (text) {
          parts[0].text += `\nNachricht/Beschreibung: "${text}"`;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] })
        });

        if (response.ok) {
          const data = await response.json();
          let content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            if (content.includes('```')) {
              content = content.replace(/```json|```/g, '').trim();
            }
            const firstBrace = content.indexOf('{');
            const lastBrace = content.lastIndexOf('}');
            if (firstBrace !== -1) content = content.slice(firstBrace, lastBrace + 1);
            return JSON.parse(content);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          lastError = errorData.error?.message || `HTTP ${response.status}`;
          console.log(`Model ${model} failed (${lastError}), trying next...`);
        }
      } catch (err) {
        lastError = err.message;
        console.log(`Model ${model} error (${err.message}), trying next...`);
      }
    }
  }

  // --- Fallback: Cloudflare Workers AI (100% Unlimited Free Edge AI) ---
  if (env.AI && text) {
    console.log('Gemini models rate-limited/unavailable — seamlessly failing over to Cloudflare Workers AI...');
    try {
      const fallbackPrompt = `Analysiere folgende Nachricht auf Deutsch: "${text}"

Antworte AUSSCHLIESSLICH im gültigen JSON-Format:
Wähle genau EINES dieser 4 Formate:
1. Aufgabe/Reminder: {"type":"task","task":"Beschreibung","time":"HH:mm","is_routine":false}
2. Mahlzeit/Essen: {"type":"food_log","meal_name":"Name","calories":400,"protein":25,"fat":15,"carbs":45}
3. Wasser: {"type":"water_log","amount_ml":500}
4. Körpermessung: {"type":"body_metrics","weight":90.0,"neck":44.0,"waist":97.0}`;

      const cfResult = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: 'Du bist ein KI-Assistent. Antworte AUSSCHLIESSLICH im JSON-Format.' },
          { role: 'user', content: fallbackPrompt }
        ],
        max_tokens: 300
      });

      let cfContent = typeof cfResult === 'string' ? cfResult : (cfResult?.response || JSON.stringify(cfResult));
      console.log('Cloudflare AI response:', cfContent);

      const jsonMatch = cfContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed) {
          if (parsed.task || parsed.type === 'task') {
            return {
              type: 'task',
              task: parsed.task || text,
              time: parsed.time || '09:00',
              weekdays: parsed.weekdays || null,
              is_routine: Boolean(parsed.is_routine)
            };
          }
          if (parsed.amount_ml || parsed.type === 'water_log') {
            return {
              type: 'water_log',
              amount_ml: Math.round(Number(parsed.amount_ml) || 250)
            };
          }
          if (parsed.weight || parsed.type === 'body_metrics') {
            return {
              type: 'body_metrics',
              weight: parsed.weight ? Number(parsed.weight) : null,
              neck: parsed.neck ? Number(parsed.neck) : null,
              waist: parsed.waist ? Number(parsed.waist) : null,
              hip: parsed.hip ? Number(parsed.hip) : null
            };
          }
          return {
            type: 'food_log',
            meal_name: parsed.meal_name || text,
            calories: Math.round(Number(parsed.calories) || 350),
            protein: Math.round(Number(parsed.protein) || 25),
            fat: Math.round(Number(parsed.fat) || 12),
            carbs: Math.round(Number(parsed.carbs) || 35)
          };
        }
      }
    } catch (cfErr) {
      console.log('Cloudflare AI fallback error:', cfErr.message);
    }
  }

  // --- Ultimate Deterministic Offline Fallback: Guarantee no breakdown ---
  if (text) {
    console.log('Using ultimate offline fallback for text input...');
    const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (timeMatch || /aufgabe|task|todo|erinnere|remind|routine/i.test(text)) {
      const timeStr = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '09:00';
      const cleanTask = text.replace(/^(aufgabe|task|todo|erinnere\s+mich\s+(an\s+)?)\s*:?/i, '').replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, '').trim() || text;
      return { type: 'task', task: cleanTask, time: timeStr, is_routine: false };
    }
    return {
      type: 'food_log',
      meal_name: text.trim(),
      calories: 350,
      protein: 25,
      fat: 12,
      carbs: 35
    };
  }

  throw new Error(`AI API Error: ${lastError || 'Quota exceeded'}`);
}

// --- Helper Functions ---
async function downloadTelegramFile(fileId, env) {
  const getFileUrl = `https://api.telegram.org/bot${env.PLANNER_TELEGRAM}/getFile?file_id=${fileId}`;
  const res = await fetch(getFileUrl);
  const data = await res.json();

  if (!data.ok) throw new Error('Telegram getFile failed');

  const filePath = data.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${env.PLANNER_TELEGRAM}/${filePath}`;

  const fileRes = await fetch(downloadUrl);
  const arrayBuffer = await fileRes.arrayBuffer();

  // Convert ArrayBuffer to Base64 for Gemini
  return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
}

async function sendTelegramMessage(chatId, text, env) {
  const url = `https://api.telegram.org/bot${env.PLANNER_TELEGRAM}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}

async function sendTelegramAction(chatId, action, env) {
  const url = `https://api.telegram.org/bot${env.PLANNER_TELEGRAM}/sendChatAction`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: action })
  });
}

function calculateTargetCaloriesFromRow(row) {
  if (!row) return 2090;

  const gender = row.gender || 'male';
  const height = Number(row.height) || 186;
  const weight = Number(row.weight) || 90;
  const neck = Number(row.neck) || 44;
  const waist = Number(row.waist) || 100;
  const hip = Number(row.hip) || 100;
  const activityLevel = Number(row.activity_level) || 1.55;
  const targetDeficitMode = Number(row.target_deficit_mode) || 500;

  let navyKfa = 0;
  if (gender === 'male') {
    if (waist > neck && height > 0) {
      const density = 1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height);
      navyKfa = (495 / density) - 450;
    }
  } else {
    if (waist + hip > neck && height > 0) {
      const density = 1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(height);
      navyKfa = (495 / density) - 450;
    }
  }
  if (navyKfa < 2) navyKfa = 2;
  if (navyKfa > 50) navyKfa = 50;

  const fatMass = weight * (navyKfa / 100);
  const leanMass = weight - fatMass;

  // Katch-McArdle BMR & TDEE calculation
  const bmr = 370 + (21.6 * leanMass);
  const tdee = bmr * activityLevel;
  return Math.max(1200, Math.round(tdee - targetDeficitMode));
}

