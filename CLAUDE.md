# wpr-packers-tracker — Claude Code context

Read this first. Persistent context for working in this repo.

## What this is

A live Green Bay Packers stats widget for **Wausau Pilot & Review** (WPR). Tabbed,
chart-led editorial page: featured game → matchup → season pulse → NFC North standings →
division race → playoff odds → schedule → leaders → film room. Wrapped in WPR's masthead +
tagline; Packers green/gold banner. Embedded into the WPR WordPress site via iframe from
GitHub Pages.

The Packers sibling of `wpr-brewers-tracker` — same design system and architecture,
football-native modules. WPR covers all major Wisconsin sports despite being hyperlocal;
this is the "Wisconsin pride / traffic magnet" angle, sold as a standalone sponsorship
surface.

## CRITICAL: this repo intentionally breaks the standard WPR pattern

Other WPR widgets run: Python scraper → GitHub Actions cron → static JSON → React/Vite →
Pages. **Do NOT add that here.** ESPN's public NFL API is keyless and CORS-open
(`access-control-allow-origin: *`), so the browser fetches it directly. No scraper, no
cron, no committed JSON. The only workflow builds and deploys.

If a future task seems to call for "caching the data" or "adding a scraper for
reliability" — don't. That contradicts the design. The API serves short cache headers and
is built to be hit from browsers. Keeping it client-side is the whole point (simplest
path, one source of truth, nothing to keep in sync).

ONE sanctioned exception, and it is NOT a data cron: the deploy workflow runs on a
twice-daily `schedule` to regenerate the **email image** (`public`-served `digest.png`).
Email clients strip iframes and can't run JS, so the digest is snapshotted to a PNG
(headless screenshot of `mini-digest.html` via `scripts/render-digest.mjs`). This bakes an
*image* for email; it does NOT cache the widget's data or feed the widget — the tracker
still fetches the API live in the browser. Don't delete the schedule thinking it's drift,
and don't extend it to caching data.

## Architecture

```
ESPN NFL API (site.api / sports.core.api / site.web.api .espn.com)
  → fetch() in browser → React/Vite → GitHub Pages → WP iframe
```

- `src/api.js` — the only place that talks to the API. Functions fail fast (throw on
  non-200); the calling component renders its own error state. No fallbacks.
  `normalizeEvent()` turns every schedule/scoreboard event into one plain game shape —
  nothing downstream touches raw ESPN payloads for games.
- `src/config.js` — single source of truth for season, team, division, all-32 team maps
  (abbrs/names/accents), sponsors, `USE_TEAM_LOGO`, and brand asset URLs. Change a team
  here and nowhere else.
- `src/theme.js` — palette + Fraunces/Public Sans pairing (matches the Brewers tracker and
  the "Follow the Money" design system). TWO golds, one role each: `gold` (#ffb612,
  Packers-bright) for fills/badges/bars only; `goldText` (darkened) for kickers and small
  text accents — the bright gold fails contrast as text on white.
- `src/games.js` — pure derivations over normalized games/summaries (race rows, game flow,
  chunk plays, this-day ranking). No fetching.
- `src/analytics.js` — opt-in, cookieless Plausible loader + `track()` for sponsor ROI.
  Off by default until `ANALYTICS.domain` is set. Analytics only — NOT the forbidden cache.
- `mini*.html` + `src/mini*.jsx` — extra Vite entries: compact sidebar/in-article embeds,
  each its own page so they stay lightweight. `MiniGame.jsx` (featured-game scoreboard w/
  kickoff countdown, live situation + win probability, player of the game),
  `MiniStandings.jsx` (NFC North table), `MiniDigest.jsx` (newsletter combo: last final w/
  top performers, next kickoff w/ TV, standings). Each card is one link to the full
  tracker; the embed's `?to=` param overrides the destination (http/https only — shared
  `src/embed.js` `destination()`). Clicks fire a `Mini Click` event tagged with `widget`.
  Keep them tiny — no service worker, no recharts.
- Sections are grouped into tabs in `App.jsx` (`TABS` + `TabBar.jsx`): Season (hero +
  matchup + pulse + standings/vs-North + race + playoff odds + road ahead), Schedule (full
  season list w/ box scores + next-at-Lambeau + injuries + WPR coverage + sponsor band +
  this-day), Leaders (offense + defense + team profile), Film room (per-game win
  probability + scoring plays + chunk plays). Only the active tab renders, and `api.js`
  memoizes the heavier reads (`cached()`, short TTL) so flipping back is instant.
  Masthead, banner + title sponsor, the updated stamp, and the footer stay pinned across
  tabs. Tab switches fire a Plausible `Tab` event.
- `src/autosize.js` — when embedded, posts document height to the host on every change
  (ResizeObserver) so the iframe fits the active tab. The host embed listens for
  `{ type: 'wpr-packers-height' }` (snippet in README). No-op when standalone.
- `src/components/` — one file per concern (separation of concerns):
  - `Masthead`, `PackersBanner`, `Section`, `TabBar` — chrome.
  - `BookmarkButton` — stickiness nudge pinned in the top bar (⌘/Ctrl+D + copy-link).
  - `Pulse`, `Standings` — consume the shared standings bundle fetched once in `App`.
  - `Race` — games back of the division lead, week by week, from the four division teams'
    schedules; direct end-of-line labels (logo + GB) instead of a legend.
  - `Matchup`, `NextAtLambeau`, `InjuryReport`, `VsNorth`, `PlayoffOdds`, `RoadAhead`,
    `Coverage`, `ThisDay`, `TeamProfile` — fail-soft sections that OWN their `Section`
    chrome: on error/empty the heading disappears with the content (never render an
    orphaned title over blank space — follow this pattern for any new fail-soft section).
  - `PlayerCard` — tap-any-player modal. One `<PlayerCardHost/>` mounts in App; any
    surface calls the exported `openPlayerCard(id)` (module-level hook, no prop
    threading). Card = roster bio + last-5 game log.
  - `FilmRoom` — game picker; hands one cached summary to `GameFlow` (win-probability
    chart), `ScoringPlays`, `BigPlays`.
  - `PlayoffOdds` runs a 4,000-sim rest-of-season Monte Carlo IN THE BROWSER (regressed
    win%, normal-approx binomial, 4 division winners + 3 wild cards) — a deliberate house
    model, labeled as such; not a data cron. It waits for Week 1 (a coin-flip preseason
    sim would be noise).
  - `Status` — `Loading` + `ErrorState`.

## Phase-awareness (the offseason is a first-class state)

`fetchStatsSeason()` in api.js: the numbers describe `SEASON` once it has a completed
regular-season game, else `SEASON - 1`. Standings/leaders/race/film room show last
season's finals (each labels itself "Final 2025 …"), the hero counts down to kickoff, and
everything flips automatically after Week 1. `PlayoffOdds` and `VsNorth`'s current-season
mode simply wait. This is one deterministic source per phase — NOT a fallback chain. Don't
"simplify" it away and don't special-case dates.

## Data notes (verified July 2026)

- Packers `TEAM_ID = 9`, abbr `gb`. NFC North ids: GB 9, CHI 3, DET 8, MIN 16.
- Schedule: `site.api…/teams/gb/schedule?season=YYYY&seasontype=1|2|3` (pre/reg/post).
  Postseason/preseason 404 or come back empty until published — `fetchSeasonGames()`
  tolerates that for types 1/3 only; the regular season fails fast.
- Standings: `site.api…/apis/v2/…/standings?season=YYYY&level=3` — division-grouped, every
  stat (incl. playoffSeed, division/home/road records) inline. NOT published for a season
  until it exists; `fetchStandings` throws then (callers on the current season treat that
  as "not yet").
- Summary: `site.api…/summary?event=ID` carries box score, drives (w/ per-play
  `statYardage` + `type`), `winprobability` (per play, home %), `scoringPlays`, per-team
  `leaders`, and header linescores — one cached read powers the hero final state, box
  score modal, film room and digest.
- Team leaders: `sports.core.api…/seasons/YYYY/types/2/teams/9/leaders` — values inline,
  athletes as `$ref`s; ids parse out of the URL and resolve through the roster (leaders
  who left the club get one pooled athlete read each).
- League leaders (rank chips): `sports.core.api…/seasons/YYYY/types/2/leaders?limit=5`.
- Team statistics (+NFL ranks!): `sports.core.api…/seasons/YYYY/types/2/teams/ID/statistics`.
- Roster: `site.api…/teams/9/roster` — bios + in-season injury tags ride along (that's the
  injury report's source; the dedicated injuries endpoints are ref-soup or 404).
- Game logs: `site.web.api…/athletes/ID/gamelog?season=YYYY` — parallel `names`/`labels`
  arrays; columns are primary-category-first per player.
- Logos: `https://a.espncdn.com/i/teamlogos/nfl/500/{abbr}.png` (abbr map in config).
  Headshots: `https://a.espncdn.com/i/headshots/nfl/players/full/{id}.png`.
- `timeValid: false` on an event = kickoff not set yet (late-season flex) → render "TBD",
  never a fake midnight time.
- Do NOT read `/teams/9/transactions` (returns `{}`) or the core injuries list (70 refs =
  fan-out soup). The roster injuries field is the one correct source.
- ESPN's schedule archive is solid back to 1999 — that's `ThisDay`'s range. Jan/Feb dates
  also sweep seasontype=3 (playoff games land in the season's following calendar year).

## Design principles in force

Surgical changes; one correct path, no fallbacks; fail fast; clarity over compatibility;
each component one responsibility; don't overengineer. Match these when editing.

## Dev / deploy

```bash
npm install
npm run dev        # http://localhost:5173/wpr-packers-tracker/
npm run build
```
Push to `main` → auto-deploys via `.github/workflows/deploy.yml`. Set Pages source to
"GitHub Actions" once in repo Settings.

## Windows (rpfly machine) reminders

- PowerShell 5.1 chains with `;` not `&&`.
- If `.github/` or `.gitignore` vanished on unzip, restore from `docs/deploy.yml.txt`
  and the README.
- Project path: `C:\Users\rpfly\Projects\wpr-packers-tracker`.

## Second external API (deliberate, not drift)

`src/weather.js` talks to Open-Meteo (free, keyless, CORS-open) for the kickoff forecast
on upcoming HOME games — Lambeau weather is half the story of December football. Same
rules as the ESPN client: browser fetch, fail fast, no caching, and the hero/mini render
nothing on failure. Don't add more external APIs without the same justification (keyless +
CORS-open + fail-soft + small).

`public/og-card.png` (social share card) is generated by `scripts/og-card.py`
(Python/Pillow, downloads brand fonts at run time) — rerun it only when branding changes.

`digest.png` (the email-newsletter image) is generated in CI by
`scripts/render-digest.mjs` (Playwright headless screenshot of `mini-digest.html`) and
published to the Pages root. It is NOT committed — it's built fresh on every deploy and on
the twice-daily `schedule` in `deploy.yml`. The newsletter embeds it as
`<img src=".../digest.png">` (snippet in README); the live data still comes from the
browser, this is just the email-safe rendering of the same card.

## Third external API (deliberate, not drift)

`src/wpr.js` reads WPR's own recent Packers coverage from the WordPress REST API
(`/wp-json/wp/v2/posts?categories=<Green Bay Packers>`), rendered by `Coverage.jsx`. Same
rules as the other clients: browser fetch, keyless, CORS-open (WP echoes the Origin —
note Cloudflare 403s server-side/datacenter requests but allows genuine browsers),
fail-soft (the section renders nothing on error), deferred until near the viewport, and
`_fields`-trimmed so the payload stays small. This is a live read of WPR's CMS, NOT the
forbidden scraper/committed-JSON pattern. Category id + endpoints live in `config.js`
(`WPR_NEWS`; set null to hide the section). Article links use `target=_top` to drive
readers into WPR's coverage.

## Possible next features

(Shipped at v1: featured-game hero w/ countdown + live situation + win probability +
linescore + top performers, matchup comparison, phase-aware pulse w/ kickoff countdown +
pace bar, standings w/ form strips + vs-North, week-by-week race chart, playoff-odds sim,
strength of schedule, full-season schedule w/ box scores + .ics export, next-at-Lambeau w/
forecast, injury report, WPR newsroom feed, this-day-in-history, offense/defense leaders
w/ NFL rank chips, team profile, film room (win probability + scoring plays + chunk
plays), player cards, three minis + the email digest PNG.)

- A localStorage "pick'em" (call Sunday's game, graded after the final) — sponsorable.
  Owner wants to clear this with WPR before building.
- Season-long chunk-play leaderboard (17 cached summary reads, pooled — cheap in football).
- Plausible public dashboard links per sponsor once the account is live.

Keep each as a small, self-contained addition.
