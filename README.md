# wpr-packers-tracker

Live Green Bay Packers stats widget for **Wausau Pilot & Review** — a tabbed, chart-led
page covering the season pulse, NFC North standings, the division race week by week, the
schedule, team leaders, and a per-game film room. Embedded into the WPR WordPress site via
iframe from GitHub Pages.

This is the Packers sibling of `wpr-brewers-tracker` — same design system (WPR masthead,
Fraunces/Public Sans, sponsor slots), same architecture, football-native modules.

## How this differs from the other WPR widgets

Every scraper-based widget (`wpr-gas-prices`, `wpr-woodchucks-widget`, `marathon-meetings`,
etc.) runs the standard pipeline: **Python scraper → GitHub Actions cron → static JSON →
React/Vite → Pages**. That layer exists because those sources are scrape-fragile.

This one does **not** — like the Brewers tracker before it. ESPN's public NFL API
(`site.api.espn.com` and friends) is keyless, stable, and CORS-open
(`access-control-allow-origin: *`), so the widget fetches it **directly in the browser**.
No scraper, no cron, no committed JSON. The only GitHub Action here builds and deploys.
This is deliberate — see `CLAUDE.md`.

## The offseason is a first-class state

Football is dark seven months a year, so the tracker is phase-aware: before Week 1 the
standings, leaders, race chart and film room show the **previous season's final numbers,
clearly labeled**, the hero counts down to kickoff, and everything flips to the new season
automatically once Week 1 has a final. No hand-holding at season rollover — `SEASON` in
`src/config.js` is the only dial.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/wpr-packers-tracker/
npm run build      # outputs to dist/
npm run preview    # serve the production build locally
```

## Deploy

Push to `main`. The `Deploy to GitHub Pages` workflow builds and publishes automatically.
In the repo Settings → Pages, set the source to **GitHub Actions** once.

Live URL: `https://rowanflynnpilot.github.io/wpr-packers-tracker/`

## Embed

The tool is organized into tabs (Season / Schedule / Season stats / Film room) and
**auto-resizes**: it posts its height to the host page on every change, so the iframe
always fits the active tab with no inner scroll. Paste BOTH the iframe and the little
script into a WordPress **Custom HTML** block:

```html
<iframe id="wpr-packers" src="https://rowanflynnpilot.github.io/wpr-packers-tracker/"
        style="width:100%;border:0;height:1600px" loading="lazy"
        allow="web-share; clipboard-write"
        title="The Packers, by the numbers — live stats tracker"></iframe>
<script>
window.addEventListener('message', function (e) {
  if (e.origin !== 'https://rowanflynnpilot.github.io') return
  if (e.data && e.data.type === 'wpr-packers-height') {
    var f = document.getElementById('wpr-packers')
    if (f && e.data.height) f.style.height = e.data.height + 'px'
  }
})
</script>
```

The `height` in the style is just a first-paint fallback (the script takes over once it
loads). `allow` lets the share button use the native share sheet / clipboard inside the
iframe. Embedded views are tracked automatically (they appear in Plausible with
wausaupilotandreview.com as the source); tab switches fire a `Tab` event, and the
"Bookmark" button fires a `Bookmark` event.

### Mini scoreboard (sidebar / in-article)

A compact featured-game card at `/mini.html` — countdown before kickoff, score + situation
+ win probability live, final + player of the game after. The whole card is a link into
the full tracker; the `to` parameter sets where a tap lands (the tracker's page on the
news site). Without it, the card links to the standalone tracker.

```html
<iframe src="https://rowanflynnpilot.github.io/wpr-packers-tracker/mini.html?to=https://wausaupilotandreview.com/category/sports/green-bay-packers/"
        style="width:100%;border:0;height:280px" loading="lazy"
        title="Packers scoreboard — tap for the full tracker"></iframe>
```

Mini impressions show in Plausible as the `/wpr-packers-tracker/mini.html` page; clicks
fire a `Mini Click` event tagged with the `widget` (add it as a goal to report on it).

### Mini standings (sidebar / in-article)

A compact NFC North standings card at `/mini-standings.html`. Same `to` + click behavior.

```html
<iframe src="https://rowanflynnpilot.github.io/wpr-packers-tracker/mini-standings.html?to=https://wausaupilotandreview.com/category/sports/green-bay-packers/"
        style="width:100%;border:0;height:260px" loading="lazy"
        title="NFC North standings — tap for the full tracker"></iframe>
```

### Mini digest (newsletter snapshot)

A taller combo card at `/mini-digest.html` — the last final (score + top performers), the
next game (kickoff, TV, venue), and the NFC North standings in one card. Built for
newsletter / sidebar use. Same `to` + click behavior.

```html
<iframe src="https://rowanflynnpilot.github.io/wpr-packers-tracker/mini-digest.html?to=https://wausaupilotandreview.com/category/sports/green-bay-packers/"
        style="width:100%;border:0;height:480px" loading="lazy"
        title="Packers digest — tap for the full tracker"></iframe>
```

Note: email clients strip `<iframe>`, so the iframe above renders on web pages (the
WordPress site or a "view in browser" newsletter), not inside an emailed newsletter. For
**email**, use the daily image below instead.

#### Digest as a daily email image

Email can't run the live widget, so the digest is also published as a static PNG that the
deploy workflow regenerates **twice a day** (≈6:30 AM & 3:30 PM Central — see `cron` in
`.github/workflows/deploy.yml`). It's a headless screenshot of `mini-digest.html`
(`scripts/render-digest.mjs`), so the image always matches the live card. Drop this into
the newsletter's HTML (works in every email client) — the image links to the WPR Packers
page:

```html
<a href="https://wausaupilotandreview.com/category/sports/green-bay-packers/">
  <img src="https://rowanflynnpilot.github.io/wpr-packers-tracker/digest.png"
       alt="Packers digest — last game, next game and the NFC North standings"
       width="600" style="width:100%;max-width:600px;height:auto;border:0;display:block" />
</a>
<p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;text-align:center">
  <a href="https://wausaupilotandreview.com/category/sports/green-bay-packers/"
     style="color:#203731;font-weight:bold;text-decoration:none">See the full live Packers tracker →</a>
</p>
```

The image itself is also linked (tapping it opens the tracker), but the text link below
makes the call-to-action obvious — the image drops its "Full tracker" button, since a
region inside an image can't carry its own link. The PNG is ~840px wide (2× for retina),
so it stays sharp displayed up to 600px. To change the refresh times, edit the two `cron`
lines in the workflow.

## Configure

Everything tweakable lives in `src/config.js`: season, team, division, sponsor slots, the
WPR news category, and `USE_TEAM_LOGO`. To repoint at a different NFL team, change
`TEAM_ID`, `TEAM_ABBR`, the `DIVISION*` maps, `FRANCHISE_BEST`, and the Lambeau
coordinates in `src/weather.js`.

## Sales demo mode

Append `?demo` to any page URL (the tracker or any mini) and every **open** sponsor slot
fills with a "Your Brand Here" placeholder — the fastest way to show a prospect exactly
what their sponsorship looks like on the live page, real scores included. Sold slots are
never overridden, and readers without the parameter never see it.

Demo link: `https://rowanflynnpilot.github.io/wpr-packers-tracker/?demo`

## Sales kit

- `docs/sponsor-deck.pptx` — the sponsorship deck. Regenerate after inventory/branding
  changes with `node scripts/sponsor-deck.cjs` (needs `npm i -g pptxgenjs react react-dom
  react-icons sharp`).
- `docs/SPONSOR_PITCH.md` — the email-able one-pager.
- `docs/media/` — placement screenshots (real page, live data, demo mode) used by both.

## Launch checklist (before Week 1)

Code-side items ship with the repo; these need a human:

1. **Plausible**: add `rowanflynnpilot.github.io` as a site in the WPR Plausible account —
   until then every event is silently dropped and there is no reach number for sales.
   Then add the goals: `Sponsor Click`, `Mini Click`, `Tab`, `Share`, `Box Score`,
   `Player Card`, `Coverage Click`, `Bookmark`, `Widget Error`.
2. **Custom domain (recommended)**: point `packers.wausaupilotandreview.com` at Pages
   before the sales push — the deck, pitch, OG tags, and Plausible domain all bake the
   URL in, so moving later is costly. The github.io URL redirects automatically once set.
3. **Keep-alive is automatic** (the deploy workflow resets GitHub's 60-day schedule
   auto-disable timer on every scheduled run) — but if the workflow is ever paused
   manually, remember the twice-daily digest refresh dies with it.
4. **Team-logo clearance**: confirm the WPR/league posture in writing before the title
   slot sells (`USE_TEAM_LOGO = false` is the colors-only fallback).
5. **Embed + newsletter**: paste the iframe snippets below into the WP page and the
   `digest.png` image block into the newsletter template.

## Trademark note

The Packers logo and player headshots are referenced from ESPN's public CDN, not redrawn.
The footer carries a non-affiliation line. A team mark on a sponsored surface can imply
endorsement — confirm with WPR/the league before going paid, or set `USE_TEAM_LOGO =
false` for a colors-only header.

## If `.github/` or `.gitignore` went missing from the zip

Some Windows unzip tools strip dotfiles. If they're absent after extracting:
`.gitignore` should contain `node_modules`, `dist`, `.DS_Store`, `*.local`, `.vite`.
The workflow file is reproduced in `docs/deploy.yml.txt` as a backup.
