# Handoff to Claude Code

Everything Claude Code needs is in `CLAUDE.md`. This file is the startup checklist and the
first prompt to run.

## Pre-flight (before opening Claude Code)

- [ ] Node 18+ installed (`node -v`). The deploy workflow uses Node 20.
- [ ] Extracted to `C:\Users\rpfly\Projects\wpr-packers-tracker`.
- [ ] `gh auth status` is logged in (for `gh repo create` / push later).
- [ ] Open the folder in your terminal, then run `claude`.

## First prompt to paste into Claude Code

> Read CLAUDE.md first. Then run `npm install` and `npm run dev`, and confirm the dev
> server starts at /wpr-packers-tracker/. Don't change any code yet — I want to verify the
> Season tab (hero countdown, matchup, pulse, standings, race chart), the Schedule tab,
> the Leaders tab, and the Film room all load live data in the browser first. It's the
> offseason, so the numbers should read as clearly-labeled final-2025 figures with a
> kickoff countdown. Report what you see, including any console errors. Note: this repo
> is intentionally client-side only — do NOT add a scraper, cron, or cached JSON layer.

## Setup is done when

- [ ] `npm run dev` serves with no build errors.
- [ ] Season tab renders real data (hero with the next kickoff + countdown, matchup
      comparison, pulse tiles, full NFC North table, a multi-line race chart).
- [ ] Schedule tab shows the full 2026 slate (preseason group, weeks 1–18 with the bye
      row, kickoff times + TV) and completed games open a box score.
- [ ] Leaders tab shows offense + defense tables with headshots; Film room replays a 2025
      game with the win-probability chart.
- [ ] Player headshots and both logos load (WPR + Packers).
- [ ] `npm run build` succeeds.

## Dev-only gotchas (so they don't get "fixed" by mistake)

- **Double fetch in dev is expected.** React 18 StrictMode runs effects twice in
  development only. It does not happen in the production build. Leave StrictMode on.
- **Fonts need network.** Fraunces + Public Sans load from Google Fonts at runtime; an
  offline machine falls back to Georgia/system sans. That's fine.
- **PowerShell 5.1 chains with `;`,** not `&&`.
- **One source of truth is `src/config.js`.** Season rollover, sponsor slots, and the
  logo toggle all live there — don't scatter those values into components.
- **"Final 2025" labels in July are correct,** not a bug — the tracker is phase-aware and
  flips to 2026 automatically after Week 1 (see CLAUDE.md, "Phase-awareness").

## Deploy (after verifying locally)

```
gh repo create wpr-packers-tracker --public --source=. --push
```
Then repo Settings -> Pages -> source = "GitHub Actions" (one time). Keep the repo name
`wpr-packers-tracker` or update `base` in `vite.config.js` to match.

## First real work (pick one, keep it self-contained)

- Fill the title-sponsor slot in `config.js` when WPR sells it (one object, one place).
- Season-long chunk-play leaderboard in the film room.
- The pick'em (needs WPR sign-off first — see CLAUDE.md).
