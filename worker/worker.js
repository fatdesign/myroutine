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
          const adminPass = env.ADMIN_PASSWORD || 'sanktum2026';
          if (password && String(password).trim() === String(adminPass).trim()) {
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
          return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
            "CREATE TABLE IF NOT EXISTS workout_sessions (date TEXT PRIMARY KEY, duration_seconds INTEGER DEFAULT 0, body_weight REAL, photo_url TEXT)"
          ).run();

          const { results } = await env.DB.prepare("SELECT * FROM workout_sessions ORDER BY date ASC").all();
          return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      if (path.startsWith('/workout-sessions/')) {
        const date = path.split('/').pop();
        if (request.method === 'PUT') {
          const { durationSeconds, bodyWeight, photoUrl } = await request.json();
          
          await env.DB.prepare(
            "CREATE TABLE IF NOT EXISTS workout_sessions (date TEXT PRIMARY KEY, duration_seconds INTEGER DEFAULT 0, body_weight REAL, photo_url TEXT)"
          ).run();

          await env.DB.prepare(
            `INSERT INTO workout_sessions (date, duration_seconds, body_weight, photo_url) VALUES (?, ?, ?, ?)
             ON CONFLICT(date) DO UPDATE SET
               duration_seconds = COALESCE(excluded.duration_seconds, workout_sessions.duration_seconds),
               body_weight = COALESCE(excluded.body_weight, workout_sessions.body_weight),
               photo_url = COALESCE(excluded.photo_url, workout_sessions.photo_url)`
          )
            .bind(date, durationSeconds ?? 0, bodyWeight ?? null, photoUrl ?? null)
            .run();

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // --- Telegram Webhook ---
      if ((path === '/webhook' || path === '/webhook/') ) {
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
        } catch(e) { console.log("Budget check failed", e.message); }

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
            await sendTelegramMessage(chatIdResult.value, `🚀 **JETZT FÄLLIG:**\n"${reminderText}"`, env);
          }
          if (task.time === targetTimeStr) {
            await sendTelegramMessage(chatIdResult.value, `⏰ **IN 10 MINUTEN:**\n"${reminderText}"`, env);
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

    // Save Chat ID for future reminders
    await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('telegram_chat_id', ?)")
      .bind(String(chatId))
      .run();

    if (update.message.text === '/start') {
      await sendTelegramMessage(chatId, "Hallo! 🤖 Ich bin dein Planner AI Assistent.\n\nDu kannst mir schreiben oder einfach eine **Sprachnachricht** schicken, z.B.:\n- 'Morgen um 08:30 Uhr Joggen'\n- 'Erinnere mich an Pizza bestellen um 19:00 Uhr'", env);
      return new Response('OK');
    }

    let userText = update.message.text;
    let audioData = null;

    // Handle Voice Messages
    if (update.message.voice) {
      console.log('Voice message detected!');
      await sendTelegramAction(chatId, 'record_voice', env); // Visual feedback
      const fileId = update.message.voice.file_id;
      audioData = await downloadTelegramFile(fileId, env);
      userText = "[Voice Message - See Audio]";
    }

    if (!userText && !audioData) return new Response('OK');

    // AI Parsing (Handles both text and audio)
    console.log('Parsing with Gemini Multi-modal...');
    const aiResponse = await parseWithAI(userText, audioData, env);
    console.log('AI Response:', JSON.stringify(aiResponse));

    if (aiResponse && aiResponse.task) {
      const time = aiResponse.time || '09:00';
      const type = aiResponse.type || inferType(time);
      await env.DB.prepare("INSERT INTO tasks (text, time, is_routine, weekdays, type) VALUES (?, ?, ?, ?, ?)")
        .bind(aiResponse.task, time, aiResponse.is_routine ? 1 : 0, aiResponse.weekdays || null, type)
        .run();

      const dayText = aiResponse.weekdays ? ` am Wochentag (${aiResponse.weekdays})` : "";
      await sendTelegramMessage(chatId, `✅ Eingetragen: "${aiResponse.task}" um ${aiResponse.time}${dayText}.`, env);
    } else {
      await sendTelegramMessage(chatId, "Entschuldige, ich konnte keine Aufgabe erkennen. Bitte probier es nochmal!", env);
    }

  } catch (e) {
    console.error('Telegram Update Error:', e.message);
    try {
      const updateFallback = await clonedRequest.json();
      const fallbackChatId = updateFallback?.message?.chat?.id;
      if (fallbackChatId) {
        await sendTelegramMessage(fallbackChatId, `❌ Fehler: ${e.message}`, env);
      }
    } catch (innerError) {}
  }

  return new Response('OK');
}

// --- AI Engine (Multi-modal) ---
async function parseWithAI(text, audioBase64, env) {
  const prompt = `Extrahiere Aufgabe, Uhrzeit (HH:mm), relevante Wochentage und die Tagesphase aus der Nachricht.
  Antworte NUR in diesem JSON Format: {"task": "...", "time": "HH:mm", "weekdays": "1,2..", "is_routine": boolean, "type": "morning" | "evening"}.
  Uhrzeit: Fallback "09:00".
  Wochentage: 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa, 7=So. Wenn täglich/immer, lass das Feld leer oder null.
  Routine: Markiere als true, wenn es eine wiederkehrende Regel ist (z.B. "Jeden Montag", "Täglich").
  Phase (type): "morning" für Aufgaben vor 12:00 Uhr oder die zu einer Morgenroutine gehören, sonst "evening".
  Sprache: Deutsch.`;

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${env.PLANNER_KI_API}`;

  const parts = [];
  parts.push({ text: prompt });

  if (audioBase64) {
    parts.push({
      inline_data: {
        mime_type: "audio/ogg",
        data: audioBase64
      }
    });
  } else {
    parts[0].text += `\nNachricht: "${text}"`;
  }

  const contents = [{ parts }];

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents })
  });

  if (!response.ok) {
    let errorMessage = 'Unbekannter API Fehler';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || JSON.stringify(errorData);
    } catch (e) {
      errorMessage = await response.text();
    }
    throw new Error(`AI API Error: ${errorMessage}`);
  }

  const data = await response.json();
  let content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (content.includes('```')) {
    content = content.replace(/```json|```/g, '').trim();
  }

  return JSON.parse(content);
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
