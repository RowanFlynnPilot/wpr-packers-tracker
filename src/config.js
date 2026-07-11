// Single source of truth for the tweakable bits. Change a team or sponsor here, nowhere else.

export const SEASON = 2026            // the season the tracker follows (kicks off September 2026)
export const TEAM_ID = 9              // Green Bay Packers (ESPN team id)
export const TEAM_ABBR = 'GB'
export const CONFERENCE = 'NFC'
export const DIVISION_NAME = 'NFC North'
export const GAMES_IN_SEASON = 17

// NFC North, used by the standings + division-race modules.
export const DIVISION = { 9: 'Packers', 3: 'Bears', 8: 'Lions', 16: 'Vikings' }
export const DIVISION_ABBR = { 9: 'GB', 3: 'CHI', 8: 'DET', 16: 'MIN' }

// Line colors for the race chart. The home team is emphasized in the component, not here.
// Calmer, distinct hues for the rivals so the Packers-green line stays the focus.
export const TEAM_COLORS = { 9: '#203731', 3: '#5a6b8c', 8: '#4e88b8', 16: '#8a6fae' }

// ESPN team id → abbreviation + short club name, all 32 clubs. Abbreviations key the logo CDN;
// names label opponents where a feed only carries an id.
export const TEAM_ABBRS = {
  1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
  9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN',
  17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
  25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU',
}
export const TEAM_NAMES = {
  1: 'Falcons', 2: 'Bills', 3: 'Bears', 4: 'Bengals', 5: 'Browns', 6: 'Cowboys',
  7: 'Broncos', 8: 'Lions', 9: 'Packers', 10: 'Titans', 11: 'Colts', 12: 'Chiefs',
  13: 'Raiders', 14: 'Rams', 15: 'Dolphins', 16: 'Vikings', 17: 'Patriots', 18: 'Saints',
  19: 'Giants', 20: 'Jets', 21: 'Eagles', 22: 'Cardinals', 23: 'Steelers', 24: 'Chargers',
  25: '49ers', 26: 'Seahawks', 27: 'Buccaneers', 28: 'Commanders', 29: 'Panthers',
  30: 'Jaguars', 33: 'Ravens', 34: 'Texans',
}

// Accent hue per NFL club for the mini scoreboard's split top edge — each team's most
// recognizable color, tuned to read against Packers green. Decorative, not official marks.
export const TEAM_ACCENT = {
  1: '#a71930', 2: '#00338d', 3: '#0b162a', 4: '#fb4f14', 5: '#ff3c00', 6: '#041e42',
  7: '#fb4f14', 8: '#0076b6', 9: '#203731', 10: '#4b92db', 11: '#002c5f', 12: '#e31837',
  13: '#a5acaf', 14: '#003594', 15: '#008e97', 16: '#4f2683', 17: '#002244', 18: '#d3bc8d',
  19: '#0b2265', 20: '#125740', 21: '#004c54', 22: '#97233f', 23: '#ffb612', 24: '#0080c6',
  25: '#aa0000', 26: '#69be28', 27: '#d50a0a', 28: '#5a1414', 29: '#0085ca', 30: '#006778',
  33: '#241773', 34: '#03202f',
}

// Packers logo is referenced from ESPN's CDN, not redrawn.
// A team mark on a sponsored surface can imply endorsement — set false for a colors-only header
// if WPR/NFL sign-off isn't in hand.
export const USE_TEAM_LOGO = true
export const teamLogo = (teamId) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500/${(TEAM_ABBRS[teamId] || 'gb').toLowerCase()}.png`
export const TEAM_LOGO = teamLogo(TEAM_ID)
export const headshot = (athleteId) => `https://a.espncdn.com/i/headshots/nfl/players/full/${athleteId}.png`

// WPR brand assets (the publication's own logo).
export const WPR_LOGO = 'https://wausaupilotandreview.com/wp-content/uploads/2024/04/WausauPilotandReviewLogo.png'
export const WPR_TAGLINE = 'Where Locals Look First For News'
export const WPR_URL = 'https://wausaupilotandreview.com/'

// Franchise-best regular-season win total — the Pulse pace bar measures the current pace against
// it. Packers: 15–1 in 2011. Update if the club sets a new mark.
export const FRANCHISE_BEST = { wins: 15, year: 2011 }

// Canonical URL of the standalone tracker — used by the share button, the calendar-event
// description, and the social-card tags in index.html.
export const SITE_URL = 'https://rowanflynnpilot.github.io/wpr-packers-tracker/'

// WPR's own Packers coverage, pulled live from the WordPress REST API (keyless + CORS-open,
// same rules as the ESPN/weather clients). `categoryId` is the "Green Bay Packers" category
// (slug green-bay-packers); `archive` is its public page. Set WPR_NEWS to null to hide the
// "From the newsroom" section.
export const WPR_NEWS = {
  base: 'https://wausaupilotandreview.com/wp-json/wp/v2',
  categoryId: 567084995,
  archive: 'https://wausaupilotandreview.com/category/sports/green-bay-packers/',
}

// Sellable sponsor surfaces. One title slot (the green banner) plus two inline section slots.
// A slot is either a sponsor object or null (renders as an "available" upsell card).
// Sponsor shape: { name, logo, url, tagline? } — logo optional (falls back to the name in serif).
export const SPONSORS = {
  // Title sponsor — open inventory at launch (set to a sponsor object to fill it).
  header: null,
  // Open inventory. Set to a sponsor object (same shape as above) to fill the slot.
  race: null,
  leaders: null,
  // Kickoff-forecast credit (a compact "Presented by" line in the hero — no upsell card
  // when empty; the forecast simply renders unsponsored until this is sold).
  forecast: null,
}

// Where to send sponsorship inquiries (shown on empty slots — the upsell).
export const SPONSOR_INQUIRY = 'sales@wausaupilotandreview.com'

// Home-game ticket links. The ESPN schedule feed carries a per-game resale deep link (Vivid
// Seats — ESPN's ticketing partner) with a live "from $X" price; that's the one source used.
// The Packers don't run their own affiliate program, so if WPR joins a marketplace program
// (Vivid Seats / SeatGeek / StubHub via Impact/CJ), set TICKETS_OVERRIDE_URL to the affiliate
// destination and every ticket link points there instead. Clicks fire a `Tickets Click` event
// either way, so the click-through volume is provable before any deal is signed.
export const TICKETS_OVERRIDE_URL = null

// "Where to watch" — the game-day guide: bar/restaurant listings sold PER LISTING (each card
// is its own sponsorship). Hidden until at least one venue is sold: an empty list renders no
// section. Every field is venue-provided; each entry looks like:
//   {
//     name: 'The Tap House',                          // venue name
//     tagline: "Wausau's home for Packers football",  // short pitch line
//     images: ['https://…/bar.jpg', 'https://…/patio.jpg'],  // first is the hero shot, up to
//                                                     // three more show as thumbnails ([''] or
//                                                     // [] shows a placeholder block)
//     url: 'https://…',                               // venue website / menu
//     address: '312 Third St, Wausau',
//     phone: '715-555-0140',
//     features: ['20 HDTVs', '10+ Wisconsin taps', 'Heated patio'],      // amenity chips
//     specials: ['$3 game-day taps', 'Half-price wings while the Packers play'],
//   }
// (`let`, not `const`: sales demo mode below fills it with placeholder listings.)
export let WATCH_VENUES = []

// Shown in the footer when a gaming brand is the title sponsor. Editable; set to '' to hide.
export const SPONSOR_DISCLAIMER = ''

// Privacy-light analytics (Plausible — cookieless, no consent banner). For sponsor ROI:
// page views = impressions, plus a 'Sponsor Click' event per slot = click-throughs.
// Set `domain` to '' to disable entirely (no script loads). Data only flows once this domain
// is also added as a site in the WPR Plausible account — until then events are sent and dropped.
export const ANALYTICS = {
  domain: 'rowanflynnpilot.github.io',
  src: 'https://plausible.io/js/script.js',
}

// ---------------------------------------------------------------------------
// SALES DEMO MODE — append ?demo to any page URL (the tracker or a mini) and every OPEN slot
// fills with a "Your brand here" placeholder, so WPR sales can show a prospect exactly what
// their sponsorship looks like on the live page: real scores, their name on the marquee.
// Sold slots are never overridden, ordinary readers never see it (no ?demo, no placeholders),
// and nothing here runs outside the browser.
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')) {
  const demo = {
    name: 'Your Brand Here',
    logo: null,
    url: null,
    tagline: `This placement is open for the ${SEASON} season — ${SPONSOR_INQUIRY}`,
  }
  SPONSORS.header = SPONSORS.header || demo
  SPONSORS.race = SPONSORS.race || demo
  SPONSORS.leaders = SPONSORS.leaders || demo
  SPONSORS.forecast = SPONSORS.forecast || { name: 'Your Brand Here' }
  if (!WATCH_VENUES.length) {
    WATCH_VENUES = [
      {
        name: 'Your Bar Here',
        tagline: "Wausau's home for Packers football — this listing is available",
        images: [],
        url: null,
        address: `Ask about this placement: ${SPONSOR_INQUIRY}`,
        phone: '',
        features: ['20 HDTVs', '10+ Wisconsin taps', 'Sound on for every snap'],
        specials: ['$3 game-day taps', 'Half-price wings while the Packers play'],
      },
      {
        name: 'Your Restaurant Here',
        tagline: 'The family game-day headquarters — kitchen open through the 4th quarter',
        images: [],
        url: null,
        address: `Ask about this placement: ${SPONSOR_INQUIRY}`,
        phone: '',
        features: ['Big-screen wall', 'Kids eat free Sundays', 'Tailgate takeout packs'],
        specials: ['Tailgate platter for four, $29', 'Bloody Mary bar until kickoff'],
      },
    ]
  }
}
