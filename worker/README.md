# The pick'em contest API

The one server in this repo: a Cloudflare Worker (`src/index.js`) over a D1 database, holding
contest entries, picks, and the contest's own copy of the NFL schedule and results. The
tracker itself still reads ESPN live in the browser — this exists only because a prize
contest needs identity, kickoff locks the browser can't enforce, and a shared leaderboard.
Routes are documented at the top of `src/index.js`.

The Worker never calls ESPN: ESPN's edge (Akamai) answers 403 to the Workers runtime whatever
the headers (verified Sep 2026). `scripts/sync-contest.mjs` — run by the
`sync-contest.yml` GitHub Action every 15 minutes on game days — reads ESPN and POSTs each
week's games to `/admin/games`. Locks use the kickoff times it stored; grading uses the
finals it stored. Until the first sync lands, the Worker has no slate and says so.

## One-time setup (WPR's Cloudflare account)

1. `npm install` in this folder, then `npx wrangler login`.
2. Create the database: `npx wrangler d1 create wpr-packers-pickem` — paste the `database_id`
   it prints into `wrangler.toml`.
3. Secrets: `npx wrangler secret put PIN_SALT` (any long random string — changing it later
   invalidates every entrant's PIN) and `npx wrangler secret put ADMIN_KEY` (the export and
   sync password; treat it like one).
4. First deploy: `npm run migrate:remote`, then `npm run deploy`. Wrangler prints the Worker's
   URL (`https://wpr-packers-pickem.<account>.workers.dev`).
5. Repo secrets (GitHub → Settings → Secrets → Actions): `CONTEST_API` (that URL) and
   `CONTEST_ADMIN_KEY` (the same ADMIN_KEY) so the sync runs; `CLOUDFLARE_API_TOKEN` (a token
   with Workers Scripts: Edit and D1: Edit) and `CLOUDFLARE_ACCOUNT_ID` so pushes under
   `worker/` auto-deploy via `deploy-worker.yml`. Then run "Sync the pick'em contest schedule"
   once by hand from the Actions tab to seed the current week.
6. Turn the contest on in the tracker: set `CONTEST.api` in `src/config.js` to the Worker's
   URL — and set the real prizes, eligibility and contact there first; have counsel review
   `rules.html`, then flip `rulesApproved`. Until `api` is set the tab runs as bragging rights
   only.

## Running it locally

```bash
cp .dev.vars.example .dev.vars
npm run migrate:local
npm run dev            # http://localhost:8787
```

Seed it with the real schedule from the repo root (PowerShell: set the two variables with
`$env:` first):

```bash
CONTEST_API=http://localhost:8787 CONTEST_ADMIN_KEY=local-admin-key node scripts/sync-contest.mjs
```

With `VITE_CONTEST_API=http://localhost:8787` in the repo root's `.env.local`, the tracker's
`npm run dev` talks to it.

## WPR's exports (the business end)

- Entrants: `https://<worker>/admin/export?season=2026&key=<ADMIN_KEY>` — CSV of first, last,
  email, ZIP, entered-at.
- A week's standings with emails, for picking and contacting the winner:
  `…/admin/standings?season=2026&week=3&key=<ADMIN_KEY>` (add `&scope=season` for the season
  race). Ranked exactly as the public leaderboard is — most correct, closest tiebreaker,
  earliest entry — and rows tied on all three share a rank, where the rules call for a random
  drawing.

Treat a link with the key in it as a password: anyone holding it can download the list.

## How it behaves

- Picks lock per game at kickoff, server-side. A save that arrives after a kickoff comes back
  with that game in `locked`, and the tracker tells the reader it didn't count.
- The leaderboard and the winner card follow the sync: finals show up within the sync's
  cadence (15 minutes on game days). A week counts as complete when every game is final — or,
  two weeks behind the league clock, once anything has finished, so a postponed game never
  holds a week open.
- Computed leaderboards sit in the edge cache for 30 seconds and are dropped when the sync
  writes, so a thousand open tabs cost one ranking pass.
- Identity is email + a four-digit PIN, with a 15-minute lockout after five misses. It is a
  convenience for resuming on another device, not a password — nothing sits behind it but
  picks. Winners are verified by email before a prize is awarded.
- Free tier: Workers' and D1's limits are far above a newspaper contest's traffic.
