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

A SECOND sanctioned exception: the pick'em **contest backend** in `worker/` — a Cloudflare
Worker + D1 holding contest entries, picks and the contest's own copy of the schedule and
results, deployed by `.github/workflows/deploy-worker.yml`. It exists because a PRIZE
contest needs identity, server-enforced kickoff locks and a shared leaderboard, none of
which a browser can provide. And it comes with the one scheduled data job in the repo:
`.github/workflows/sync-contest.yml` runs `scripts/sync-contest.mjs` (every 15 min on game
days) to copy each week's kickoffs and finals from ESPN into the Worker's `games` table —
because ESPN's edge (Akamai) answers 403 to the Workers runtime whatever the headers
(verified Sep 2026), so the Worker can't read ESPN itself, and a contest's locks and
grading must not hang on a feed that refuses the server. Neither piece feeds the widget: the
tracker still reads ESPN live in the browser, and with `CONTEST.api` unset the tab runs as
bragging rights only. Don't extend the Worker or the sync into a general data layer.

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
  here and nowhere else. The SALES DEMO MODE block at the bottom fills open sponsor slots
  with "Your Brand Here" placeholders — and the game-day guide (`WATCH_VENUES`, sold per
  listing) with placeholder venues — when the URL carries `?demo`: a sales preview, never
  shown to ordinary readers and never overriding a sold slot. Don't remove it as dead code.
- `src/theme.js` — palette + Fraunces/Public Sans pairing (matches the Brewers tracker and
  the "Follow the Money" design system). TWO golds, one role each: `gold` (#ffb612,
  Packers-bright) for fills/badges/bars only; `goldText` (darkened) for kickers and small
  text accents — the bright gold fails contrast as text on white.
- `src/games.js` — pure derivations over normalized games/summaries (race rows, game flow,
  chunk plays, this-day ranking). No fetching.
- `src/analytics.js` — opt-in, cookieless Plausible loader + `track()` for sponsor ROI.
  Off by default until `ANALYTICS.domain` is set. Analytics only — NOT the forbidden cache.
- `src/contest.js` — the only file that talks to the contest API (`worker/`): the entry
  token in localStorage, enter/resume, mirroring picks, the leaderboard. Fails fast like
  the ESPN client. `CONTEST` in config.js (API URL, prizes, eligibility, contact, the
  rules-approved flag) is the switch — `api: null` and none of it renders.
- `rules.html` + `src/rules.jsx` → `RulesPage` — the contest's official rules, generated
  from `CONTEST` so the prize and eligibility live in one place; wears a draft ribbon until
  `rulesApproved` is flipped.
- `mini*.html` + `src/mini*.jsx` — extra Vite entries: compact sidebar/in-article embeds,
  each its own page so they stay lightweight. `MiniGame.jsx` (featured-game scoreboard w/
  kickoff countdown, live situation + win probability, player of the game),
  `MiniStandings.jsx` (NFC North table), `MiniDigest.jsx` (newsletter combo: last final w/
  top performers, next kickoff w/ TV, standings). Each card is one link to the full
  tracker; the embed's `?to=` param overrides the destination (http/https only — shared
  `src/embed.js` `destination()`). Clicks fire a `Mini Click` event tagged with `widget`.
  Keep them tiny — no service worker, no recharts.
- Sections are grouped into tabs in `App.jsx` (`TABS` + `TabBar.jsx`): Season (hero +
  storylines + matchup + pulse + standings/vs-North + race + playoff odds + road ahead),
  Schedule (game-day guide + full season list w/ box scores + next-at-Lambeau + injuries +
  WPR coverage + sponsor band + this-day), Season stats (id `leaders`: milestone watch +
  offense/defense boards + team profile), Film room (per-game win probability + scoring
  plays + chunk plays + season chunk board + drive DNA), Pick'em (the week's full NFL
  slate — picks in localStorage only, NO backend/accounts by design; graded from the
  scoreboard feed; the reader's opponent is ESPN's FPI model, scored head-to-head on the
  same calls; a week rail opens any regular-season week (past to review, next to call
  early); a tiebreaker on the Packers game; two canvas share cards; past weeks settle
  into stored results so the season tally never re-fans-out — store + season math in
  `src/pickem.js`; sponsorable slot `pickem`). Tab labels carry `short` variants for
  phones. `sponsors.html` is the hosted
  media-kit page
  (config-driven inventory status + live mini embeds). Only the active tab renders, and
  `api.js`
  memoizes the heavier reads (`cached()`, short TTL) so flipping back is instant.
  Masthead, banner + title sponsor, the updated stamp, and the footer stay pinned across
  tabs. Tab switches fire a Plausible `Tab` event.
- `src/autosize.js` — when embedded, posts document height to the host on every change
  (ResizeObserver) so the iframe fits the active tab. The host embed listens for
  `{ type: 'wpr-packers-height' }`; tab switches also post `{ type: 'wpr-packers-scroll' }`
  so the host scrolls the widget's top back into view (snippet in README). No-op standalone.
- `src/components/` — one file per concern (separation of concerns):
  - `Masthead`, `PackersBanner`, `Section`, `TabBar` — chrome.
  - `Figures` — the house treatment for a set of headline numbers: a rule-framed strip
    (2px green above, hairline below), values in the serif, labels beneath. Used by `Pulse` and
    `DriveDNA`. It replaced rows of identically bordered tiles — the dashboard default, which
    also left an orphan in the last row on a phone. Reach for this before inventing stat boxes.
  - `BookmarkButton` — stickiness nudge pinned in the top bar (⌘/Ctrl+D + copy-link).
  - `Pulse`, `Standings` — consume the shared standings bundle fetched once in `App`.
  - `Race` — games back of the division lead, week by week, from the four division teams'
    schedules; direct end-of-line labels (logo + GB) instead of a legend.
  - `Matchup`, `NextAtLambeau`, `InjuryReport`, `VsNorth`, `PlayoffOdds`, `RoadAhead`,
    `Coverage`, `ThisDay`, `TeamProfile`, `Storylines`, `MilestoneWatch`, `ChunkLeaders`,
    `DriveDNA` —
    fail-soft sections that OWN their `Section` chrome: on error/empty the heading
    disappears with the content (never render an orphaned title over blank space — follow
    this pattern for any new fail-soft section). `Storylines` is the data-written editorial
    lede (deterministic template sentences, phase-aware); `MilestoneWatch` waits for a live
    season (paces need games remaining); `ChunkLeaders` aggregates the season's summaries
    (parses runner/receiver from GSIS play text — games.js `chunkLeaders`).
  - `PlayerCard` — tap-any-player modal. One `<PlayerCardHost/>` mounts in App; any
    surface calls the exported `openPlayerCard(id)` (module-level hook, no prop
    threading). Card = roster bio + last-5 game log.
  - `Pickem` (the tab: week resolution, store writes, the sheet, share cards) +
    `PickemLedger` (week rail + season figures + the FPI head-to-head sentence) +
    `PickRow` (one game: two sides w/ record + win %, kickoff/live/final column, the
    tiebreaker input on the Packers game). Store, settling and season math: `src/pickem.js`.
    `ContestEntry` (the contest's front door: four fields + a PIN, or resume) and
    `Leaderboard` (week/season standings, top 25 + the reader's own row, the winner once a
    week is final; fail-soft, owns its Section) render only when `CONTEST.api` is set.
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
- Standings: `site.api…/apis/v2/…/standings?season=YYYY&level=3&seasontype=2` —
  division-grouped, every stat (incl. playoffSeed, division/home/road records) inline. NOT
  published for a season until it exists; `fetchStandings` throws then (callers on the
  current season treat that as "not yet"). KEEP `seasontype=2` pinned: the bare call
  follows the league clock and serves PRESEASON records in August (GB 2–1 under
  `season=2026`, verified Sep 2026) — it would poison the Pulse the evening the tracker
  flips to the new season.
- Summary: `site.api…/summary?event=ID` carries box score, drives (w/ per-play
  `statYardage` + `type`), `winprobability` (per play, home %), `scoringPlays`, per-team
  `leaders`, and header linescores — one cached read powers the hero final state, box
  score modal, film room and digest.
- Team leaders: `sports.core.api…/seasons/YYYY/types/2/teams/9/leaders` — values inline,
  athletes as `$ref`s; ids parse out of the URL and resolve through the roster (leaders
  who left the club get one pooled athlete read each).
- League leaders (rank chips): `sports.core.api…/seasons/YYYY/types/2/leaders?limit=5`.
- Team statistics (+NFL ranks!): `sports.core.api…/seasons/YYYY/types/2/teams/ID/statistics`.
- Athlete statistics, SEASON-PINNED: `sports.core.api…/seasons/YYYY/types/2/athletes/ID/statistics`
  — the source for the leader boards' supporting lines and the player card's season tiles
  (`fetchAthleteSeasonStats`, keyed `category.stat` because names collide: a QB's
  `passing.sacks` is sacks TAKEN, `defensive.sacks` is sacks made). Use THIS, not the overview
  feed's "Regular Season" split: that split follows the LEAGUE clock rather than the season the
  page is describing, so all offseason it returns a row of `-` for most of the roster (it
  rendered "- TD · - INT" under the boards and emptied the player card until Sept 2026). The
  overview feed is still correct for the CAREER split, which is what the card's career line uses.
- FPI pregame projection: `sports.core.api…/events/ID/competitions/ID/predictor` —
  `homeTeam/awayTeam.statistics` carry `gameProjection` (win %). Regular/postseason only;
  labeled as ESPN's model wherever shown, never blended with the house Monte Carlo.
  `fetchProjection` caches BOTH sides per game (the hero's `fetchPredictor` derives the
  Packers side from it); `fetchWeekProjections` pools a whole slate for the pick'em. The
  pregame figure STAYS published after the final (verified Sep 2026), so a finished week
  grades against the model with no stored copy.
  (The sibling `…/odds` endpoint works too — spread/O-U from DraftKings — but is UNUSED
  pending WPR's editorial call on betting content.)
- League scoreboard: `site.api…/scoreboard` — bare call reports where the league clock
  stands (`season.type` 1/2/3 + `week.number`); `?seasontype=2&week=N&dates=YYYY` pins one
  regular-season week (16ish events, both competitors inline). Feeds the pick'em via
  `normalizeLeagueGame` (neutral, both sides — NOT normalizeEvent's one-team perspective).
  Scheduled games carry placeholder "0" scores — normalize them to null. While a game is
  on, `competitions[0].situation.lastPlay.probability.homeWinPercentage` is the live win
  probability (`homeWinPct` on the normalized game — the pick rows show it in place of
  FPI). Future weeks' slates (and their FPI projections) are published all season, which
  is what lets the pick'em open the next week early.
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

House conventions, so a new surface doesn't invent a fourth grammar:

- **Gold accents sit on TOP.** Every card, callout and modal marks itself with
  `borderTop: 3–4px solid gold` (hero, sponsor lockups, storylines, this-day, next-at-Lambeau,
  the turning point, player/box-score modals, the minis). There is no gold side border. A
  colored LEFT border is reserved for encoding data, not for decoration — `Schedule` uses a
  green left edge to mark home games, and that is the only one.
- **Numbers are tabular.** `body { font-variant-numeric: tabular-nums }` in styles.css; don't
  fight it, and don't re-declare it per component.
- **The browser's own surfaces are themed** in styles.css — selection, scrollbar, focus ring,
  underline offset, and `.field` for the one native `<select>`. A new native control gets
  `.field`, not a fresh inline border.

## Dev / deploy

```bash
npm install
npm run dev        # http://localhost:5173/wpr-packers-tracker/
npm run build
```
Push to `main` → auto-deploys via `.github/workflows/deploy.yml`. Set Pages source to
"GitHub Actions" once in repo Settings.

Contest backend (only when working on the contest):
```bash
cd worker && npm install && npm run migrate:local && npm run dev   # http://localhost:8787
```
`VITE_CONTEST_API=http://localhost:8787` in `.env.local` points the tracker at it. Pushes
touching `worker/` deploy via `.github/workflows/deploy-worker.yml` (needs the two Cloudflare
repo secrets — setup in `worker/README.md`).

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

`docs/sponsor-deck.pptx` (the sales deck) is generated by `scripts/sponsor-deck.cjs`
(pptxgenjs + react-icons from the GLOBAL npm root — see the script header) and pulls its
screenshots from `docs/media/`, which `scripts/media-shots.mjs` regenerates (Playwright
shots of the built site in demo mode — run `npm run build` first). Rerun both after
inventory or branding changes.

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
strength of schedule, full-season schedule w/ box scores + home-game ticket links (feed's
Vivid Seats deep links; `TICKETS_OVERRIDE_URL` swaps in a WPR affiliate destination),
next-at-Lambeau w/ forecast, injury report, WPR newsroom feed, this-day-in-history,
offense/defense leaders w/ NFL rank chips + supporting stat lines, team profile as a
league-ladder dot plot, film room (win probability + scoring plays + chunk plays) +
season chunk-play leaderboard + drive-DNA panel, player cards w/ season tiles +
game-by-game spark bars + full-season game logs, shareable canvas stat cards
(src/share-card.js — Pulse + MilestoneWatch; carries the title sponsor into feeds),
hero rivalry ledger on division games (fetchRecentMeetings),
data-written storylines lede, milestone watch (activates Week 1), FPI line on the hero,
deep-linkable tabs (`?tab=`), three minis + the email digest PNG.)

- Betting line on the hero/matchup (the odds endpoint is probed and works — DraftKings via
  ESPN) — needs WPR's editorial sign-off on gambling content first.
  (The pick'em shipped Aug 2026 as its own tab — full weekly NFL slate, WPR-approved;
  Sep 2026 added the FPI head-to-head, week rail, tiebreaker and share cards.)
- Pick'em extensions, each small: confidence points (rank the calls 1–16); an
  against-the-spread mode (the scoreboard's `odds` carries the DraftKings line — same
  editorial sign-off as above); a `?week=` deep link into the rail.
- Plausible public dashboard links per sponsor once the account is live.

Keep each as a small, self-contained addition.
