-- Planner AI - D1 Initial Schema
-- This will create the table for tasks and routines

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  time TEXT NOT NULL, -- HH:mm format
  completed INTEGER DEFAULT 0, -- 0 = active, 1 = done
  is_routine INTEGER DEFAULT 0, -- 1 = daily routine, 0 = one-time task
  weekdays TEXT, -- e.g. "1,2,3,4,5" (1=Mo, 7=So)
  last_completed_date TEXT, -- YYYY-MM-DD format for routines
  type TEXT DEFAULT 'morning', -- 'morning' | 'evening' (myroutine phase)
  media_url TEXT, -- optional YouTube/Instagram vision link (myroutine)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings table for Telegram Chat ID and other configs
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Daily history snapshot: streak graph, journal (Grimoire) and Grid Broken state (myroutine)
CREATE TABLE IF NOT EXISTS history (
  date TEXT PRIMARY KEY, -- YYYY-MM-DD
  completed_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  level INTEGER DEFAULT 0, -- 0-4 for GitHub style graph
  journal TEXT
);

-- Optional: Initial Routine Data
INSERT INTO tasks (text, time, is_routine) VALUES
('Morgen-Meditation & Kaffee', '07:00', 1),
('Workout / Fitness', '08:30', 1),
('Daily Standup AI', '10:00', 1);
