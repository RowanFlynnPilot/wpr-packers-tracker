-- The pick'em contest's tables. Entrants are one per email per season; `name` is the
-- leaderboard display ("Rowan F."). Picks and tiebreakers are the live sheet (mirrored on
-- every save for open games; locked games never change). `games` is the contest's own copy of
-- the NFL schedule and results, written by scripts/sync-contest.mjs — the Worker never reads
-- ESPN itself (see src/index.js). `meta` holds the league clock the sync last saw.
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  email TEXT NOT NULL,
  first TEXT NOT NULL,
  last TEXT NOT NULL,
  name TEXT NOT NULL,
  zip TEXT,
  pin_hash TEXT NOT NULL,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (season, email)
);

CREATE TABLE IF NOT EXISTS picks (
  entry_id TEXT NOT NULL REFERENCES entries(id),
  season INTEGER NOT NULL,
  week INTEGER NOT NULL,
  game_id TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (entry_id, season, week, game_id)
);
CREATE INDEX IF NOT EXISTS picks_week ON picks (season, week);

CREATE TABLE IF NOT EXISTS tiebreaks (
  entry_id TEXT NOT NULL REFERENCES entries(id),
  season INTEGER NOT NULL,
  week INTEGER NOT NULL,
  points INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (entry_id, season, week)
);
CREATE INDEX IF NOT EXISTS tiebreaks_week ON tiebreaks (season, week);

CREATE TABLE IF NOT EXISTS games (
  season INTEGER NOT NULL,
  week INTEGER NOT NULL,
  game_id TEXT NOT NULL,
  kickoff TEXT NOT NULL,
  home_id INTEGER NOT NULL,
  away_id INTEGER NOT NULL,
  state TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  winner_id INTEGER,
  total INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (season, week, game_id)
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
