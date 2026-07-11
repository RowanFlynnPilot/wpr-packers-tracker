// Generates docs/sponsor-deck.pptx — the WPR Packers Tracker sponsorship sales deck.
// Rerun after inventory/branding changes:  node scripts/sponsor-deck.cjs
// (needs `npm i -g pptxgenjs react react-dom react-icons sharp`)
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

// Resolve everything from the GLOBAL npm root — mixing the project's React with the global
// react-icons produces two React instances and a render crash.
const G = execSync("npm root -g").toString().trim();
const req = (m) => require(require.resolve(m, { paths: [G] }));
const React = req("react");
const ReactDOMServer = req("react-dom/server");
const sharp = req("sharp");
const pptxgen = req("pptxgenjs");
const {
  FaBolt, FaTable, FaChartPie, FaCalendarAlt, FaCloudSun, FaVideo, FaMedal, FaBell,
  FaCalendarCheck, FaMobileAlt, FaShareAlt, FaEnvelopeOpenText, FaChartBar, FaMousePointer, FaLink, FaTag,
} = req("react-icons/fa");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "sponsor-deck.pptx");
const OG_CARD = path.join(ROOT, "public", "og-card.png");
const MEDIA = (f) => path.join(ROOT, "docs", "media", f);

const GREEN = "203731", GOLD = "FFB612", GOLD_TEXT = "8A6D00", INK = "1A1A1A", MUTED = "6B6B6B";
const WASH = "F7F5F0", RULE = "E3DDD0", SAGE = "CFD8D3", WHITE = "FFFFFF";
const SERIF = "Georgia", SANS = "Calibri";

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

// Icon inside a small green circle (the deck's repeating motif, echoing the widget's chips).
function iconChip(slide, data, x, y, d = 0.42) {
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: GREEN } });
  const pad = d * 0.26;
  slide.addImage({ data, x: x + pad, y: y + pad, w: d - pad * 2, h: d - pad * 2 });
}

function title(slide, kicker, text) {
  slide.addText(kicker.toUpperCase(), { x: 0.65, y: 0.38, w: 8.7, h: 0.3, fontFace: SANS, fontSize: 11, bold: true, color: GOLD_TEXT, charSpacing: 3, margin: 0 });
  slide.addText(text, { x: 0.62, y: 0.62, w: 8.7, h: 0.62, fontFace: SERIF, fontSize: 27, bold: true, color: GREEN, valign: "top", margin: 0 });
}

// Fit an image into a white frame, preserving aspect (reads the PNG's true size from its IHDR).
function framedImage(slide, imgPath, x, y, w) {
  const ihdr = fs.readFileSync(imgPath).slice(16, 24);
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const h = (w * height) / width;
  slide.addShape("rect", { x: x - 0.08, y: y - 0.08, w: w + 0.16, h: h + 0.16, fill: { color: WHITE }, line: { color: RULE, width: 1 }, shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.18 } });
  slide.addImage({ path: imgPath, x, y, w, h });
  return h;
}

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "Wausau Pilot & Review";
  pres.title = "The Packers, by the numbers — sponsorship";

  // ---------------------------------------------------------------- 1 · cover
  let s = pres.addSlide();
  s.background = { color: GREEN };
  s.addText("WAUSAU PILOT & REVIEW  ·  SPONSORSHIP KIT", { x: 0.75, y: 0.85, w: 8.5, h: 0.3, fontFace: SANS, fontSize: 12, bold: true, color: GOLD, charSpacing: 3, margin: 0 });
  s.addText([
    { text: "The Packers,", options: { breakLine: true } },
    { text: "by the numbers" },
  ], { x: 0.7, y: 1.3, w: 5.4, h: 1.7, fontFace: SERIF, fontSize: 40, bold: true, color: WHITE, lineSpacing: 48, margin: 0 });
  s.addText("A live, season-long Green Bay Packers stats experience inside Wisconsin's most local news brand — with your name on it.", {
    x: 0.75, y: 3.15, w: 4.6, h: 1.1, fontFace: SANS, fontSize: 14, color: SAGE, lineSpacing: 20, margin: 0,
  });
  s.addText("wausaupilotandreview.com   ·   sales@wausaupilotandreview.com", { x: 0.75, y: 4.95, w: 6, h: 0.3, fontFace: SANS, fontSize: 10.5, color: SAGE, margin: 0 });
  // The real social share card, framed in white so it reads as an object on the green bg.
  s.addShape("rect", { x: 5.62, y: 2.78, w: 3.86, h: 2.13, fill: { color: WHITE } });
  s.addImage({ path: OG_CARD, x: 5.7, y: 2.86, w: 3.7, h: 1.97 });

  // ------------------------------------------------- 2 · why this sells
  s = pres.addSlide();
  s.background = { color: WHITE };
  title(s, "The opportunity", "Wisconsin's biggest weekly audience");
  const stats = [
    ["7 days", "of anticipation around every game — countdown, injuries, matchup, film room"],
    ["30s", "data refresh — score, situation and win probability are always live"],
    ["5", "sponsor slots on one page, from a section credit to the title"],
    ["0", "cookies — no consent banner between a reader and your brand"],
  ];
  stats.forEach(([num, label], i) => {
    const x = 0.62 + i * 2.28;
    s.addShape("rect", { x, y: 1.5, w: 2.08, h: 1.62, fill: { color: WHITE }, line: { color: RULE, width: 1 } });
    s.addShape("rect", { x, y: 1.5, w: 0.045, h: 1.62, fill: { color: GOLD } });
    s.addText(num, { x: x + 0.16, y: 1.62, w: 1.8, h: 0.62, fontFace: SERIF, fontSize: 32, bold: true, color: GREEN, valign: "top", margin: 0 });
    s.addText(label, { x: x + 0.16, y: 2.28, w: 1.8, h: 0.78, fontFace: SANS, fontSize: 10.5, color: MUTED, lineSpacing: 13, valign: "top", margin: 0 });
  });
  s.addText("Green and gold is the state religion", { x: 0.62, y: 3.5, w: 4.2, h: 0.3, fontFace: SANS, fontSize: 13.5, bold: true, color: INK, margin: 0 });
  s.addText("Wausau Pilot & Review is where central Wisconsin looks first for news — and no team owns this state's attention like the Packers. This page puts your brand inside that Sunday habit, not beside it.", {
    x: 0.62, y: 3.84, w: 4.2, h: 1.3, fontFace: SANS, fontSize: 12, color: MUTED, lineSpacing: 17, margin: 0,
  });
  s.addText("Editorial quality, not ad clutter", { x: 5.2, y: 3.5, w: 4.2, h: 0.3, fontFace: SANS, fontSize: 13.5, bold: true, color: INK, margin: 0 });
  s.addText("One designed page — no programmatic ads, no pop-ups. Sponsor lockups are part of the page's design language, so your brand reads as the patron of the coverage, the way print sponsorship used to work.", {
    x: 5.2, y: 3.84, w: 4.2, h: 1.3, fontFace: SANS, fontSize: 12, color: MUTED, lineSpacing: 17, margin: 0,
  });

  // ------------------------------------------------- 3 · what readers get
  s = pres.addSlide();
  s.background = { color: WHITE };
  title(s, "The product", "What readers get, all season");
  const feats = [
    [FaBolt, "Live game hero", "Score, down & distance, win probability and latest plays, refreshed every 30 seconds"],
    [FaTable, "Standings + the race", "NFC North with form strips, and the division race charted week by week"],
    [FaChartPie, "Playoff odds", "A 4,000-simulation forecast of the January picture, run right in the browser"],
    [FaCalendarAlt, "The full schedule", "All 18 weeks with kickoff, TV and venue; every final opens a box score"],
    [FaCloudSun, "Lambeau forecast", "Kickoff weather for home games — half the story of December football"],
    [FaVideo, "The film room", "Every game replayed: win-probability chart, scoring plays, 20+ yard chunk plays"],
    [FaMedal, "Leaders + player cards", "Offense and defense leaders with NFL rank chips; tap any player for their card"],
    [FaBell, "Alerts + calendar", "Kickoff alerts and a one-click season calendar download"],
  ];
  const featIcons = await Promise.all(feats.map(([C]) => icon(C, "#" + GOLD)));
  feats.forEach(([, h, b], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.62 + col * 4.52, y = 1.5 + row * 0.97;
    iconChip(s, featIcons[i], x, y + 0.06, 0.4);
    s.addText(h, { x: x + 0.56, y: y, w: 3.9, h: 0.28, fontFace: SANS, fontSize: 12.5, bold: true, color: INK, margin: 0 });
    s.addText(b, { x: x + 0.56, y: y + 0.27, w: 3.85, h: 0.6, fontFace: SANS, fontSize: 10.5, color: MUTED, lineSpacing: 13, margin: 0 });
  });

  // ------------------------------------------------- 4 · inventory
  s = pres.addSlide();
  s.background = { color: WHITE };
  title(s, "The inventory", "Five slots, sold like print");
  // Page wireframe, left — gold = the flagship, gold outline = open, gray = editorial.
  const wf = [
    ["Masthead + Packers banner", "edit"],
    ["TITLE SPONSOR LOCKUP", "flag"],
    ["Live game hero · credit", "flag"],
    ["Lambeau forecast · credit", "open"],
    ["Season pulse + standings", "edit"],
    ["Division race chart", "open"],
    ["Schedule + box scores", "edit"],
    ["Game-day guide · venue listings", "open"],
    ["Leaders + film room", "open"],
  ];
  s.addShape("rect", { x: 0.62, y: 1.42, w: 2.95, h: 3.72, fill: { color: WASH }, line: { color: RULE, width: 1 } });
  wf.forEach(([label, kind], i) => {
    const y = 1.52 + i * 0.4;
    const fill = kind === "flag" ? { color: GOLD } : { color: WHITE };
    const line = kind === "edit" ? { color: RULE, width: 1 } : { color: GOLD, width: kind === "flag" ? 0 : 1.25 };
    s.addShape("rect", { x: 0.78, y, w: 2.63, h: 0.3, fill, line });
    s.addText(label, { x: 0.88, y: y + 0.01, w: 2.5, h: 0.28, fontFace: SANS, fontSize: 8.5, bold: kind !== "edit", color: kind === "flag" ? GREEN : kind === "edit" ? MUTED : INK, valign: "middle", margin: 0 });
  });
  s.addText([
    { text: "■", options: { color: GOLD, fontSize: 10 } },
    { text: " title package    ", options: { color: MUTED, fontSize: 9.5 } },
    { text: "□", options: { color: GOLD_TEXT, fontSize: 10 } },
    { text: " open slots    ", options: { color: MUTED, fontSize: 9.5 } },
    { text: "□", options: { color: MUTED, fontSize: 10 } },
    { text: " editorial", options: { color: MUTED, fontSize: 9.5 } },
  ], { x: 0.62, y: 5.24, w: 3.2, h: 0.22, fontFace: SANS, margin: 0 });
  // Slot list, right.
  const slots = [
    ["Title sponsorship — the flagship", "Banner lockup + hero credit + email digest logo", "OPEN"],
    ["Lambeau kickoff forecast", "“Presented by” credit on the hero's weather line", "OPEN"],
    ["Division race section", "Lockup beside the season-long NFC North race chart", "OPEN"],
    ["Leaders section", "Lockup beside the offense & defense leader boards", "OPEN"],
    ["Game-day guide", "Venue listings sold per listing: photos, amenity chips, game-day specials", "OPEN"],
  ];
  slots.forEach(([h, b, status], i) => {
    const y = 1.42 + i * 0.74;
    s.addShape("rect", { x: 3.95, y, w: 5.45, h: 0.64, fill: { color: WHITE }, line: { color: RULE, width: 1 } });
    s.addShape("rect", { x: 3.95, y, w: 0.045, h: 0.64, fill: { color: GOLD } });
    s.addText(h, { x: 4.12, y: y + 0.06, w: 3.6, h: 0.26, fontFace: SANS, fontSize: 12, bold: true, color: INK, valign: "top", margin: 0 });
    s.addText(b, { x: 4.12, y: y + 0.32, w: 3.9, h: 0.28, fontFace: SANS, fontSize: 9.5, color: MUTED, valign: "top", margin: 0 });
    s.addText(status, {
      x: 8.42, y: y + 0.18, w: 0.82, h: 0.28, fontFace: SANS, fontSize: 9.5, bold: true, align: "center", valign: "middle",
      color: GREEN, fill: { color: WHITE }, line: { color: GOLD_TEXT, width: 1 }, margin: 0,
    });
  });
  s.addText("Every slot is one config line to activate — and one link to preview: add ?demo to the page URL and your prospect sees their placement filled, live.", {
    x: 3.95, y: 5.12, w: 5.45, h: 0.34, fontFace: SANS, fontSize: 9.5, italic: true, color: MUTED, lineSpacing: 12, margin: 0 });

  // ------------------------------------------------- 5 · see it live
  s = pres.addSlide();
  s.background = { color: WASH };
  title(s, "See it live", "Your brand in place, on live data");
  try {
    framedImage(s, MEDIA("banner-demo.png"), 0.62, 1.5, 5.3);   // title lockup, demo mode
    framedImage(s, MEDIA("hero.png"), 0.62, 3.4, 4.55);         // featured-game hero
    framedImage(s, MEDIA("mini-digest.png"), 6.55, 1.5, 2.55);  // newsletter digest card
  } catch (e) {
    s.addText("(Add docs/media screenshots and rerun to fill this slide.)", { x: 0.62, y: 2.4, w: 8.7, h: 0.4, fontFace: SANS, fontSize: 12, italic: true, color: MUTED, margin: 0 });
  }
  s.addText("Left: the title lockup + game hero in sales-demo mode (?demo). Right: the newsletter digest — your logo rides along twice a day.", {
    x: 0.62, y: 5.4, w: 8.8, h: 0.22, fontFace: SANS, fontSize: 9.5, italic: true, color: MUTED, margin: 0 });

  // ------------------------------------------------- 6 · reach that compounds
  s = pres.addSlide();
  s.background = { color: WHITE };
  title(s, "Distribution", "Reach that compounds beyond the page");
  const reach = [
    [FaCalendarCheck, "Lives in their calendar", "The season-schedule download carries the title sponsor's credit into every kickoff on readers' own phones"],
    [FaMobileAlt, "Installs like an app", "Add-to-home-screen and opt-in kickoff alerts pull fans back every game day"],
    [FaShareAlt, "Spreads on social", "One-tap share plus a branded card preview wherever links land — Facebook, texts, group chats"],
    [FaEnvelopeOpenText, "Rides the newsletter", "The digest is baked into a fresh image twice a day for email — your logo included, in every inbox"],
  ];
  const reachIcons = await Promise.all(reach.map(([C]) => icon(C, "#" + GOLD)));
  reach.forEach(([, h, b], i) => {
    const y = 1.52 + i * 0.94;
    iconChip(s, reachIcons[i], 0.62, y + 0.04, 0.44);
    s.addText(h, { x: 1.24, y: y, w: 4.1, h: 0.28, fontFace: SANS, fontSize: 13, bold: true, color: INK, valign: "top", margin: 0 });
    s.addText(b, { x: 1.24, y: y + 0.28, w: 4.25, h: 0.62, fontFace: SANS, fontSize: 10.5, color: MUTED, lineSpacing: 13, valign: "top", margin: 0 });
  });
  s.addShape("rect", { x: 5.86, y: 1.9, w: 3.62, h: 2.0, fill: { color: WHITE }, line: { color: RULE, width: 1 }, shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.18 } });
  s.addImage({ path: OG_CARD, x: 5.94, y: 1.98, w: 3.46, h: 1.84 });
  s.addText("The share card readers post — every share is a branded impression.", {
    x: 5.86, y: 4.02, w: 3.62, h: 0.5, fontFace: SANS, fontSize: 10, italic: true, color: MUTED, align: "center", lineSpacing: 13, margin: 0 });

  // ------------------------------------------------- 7 · measurement
  s = pres.addSlide();
  s.background = { color: WHITE };
  title(s, "Accountability", "Measured, not promised");
  const meas = [
    [FaChartBar, "Privacy-first analytics", "Plausible — cookieless, GDPR-clean, no consent banner. Page views are your impressions."],
    [FaMousePointer, "Click-throughs per slot", "Every sponsor click is tagged with its placement, so you see exactly which surface works"],
    [FaLink, "Your own live dashboard", "A public link to your numbers — check impressions and clicks any day of the season"],
    [FaTag, "UTM-tagged traffic", "Visits from the tracker arrive labeled in your own analytics, end to end"],
  ];
  const measIcons = await Promise.all(meas.map(([C]) => icon(C, "#" + GOLD)));
  meas.forEach(([, h, b], i) => {
    const y = 1.52 + i * 0.94;
    iconChip(s, measIcons[i], 0.62, y + 0.04, 0.44);
    s.addText(h, { x: 1.24, y: y, w: 4.1, h: 0.28, fontFace: SANS, fontSize: 13, bold: true, color: INK, valign: "top", margin: 0 });
    s.addText(b, { x: 1.24, y: y + 0.28, w: 4.25, h: 0.62, fontFace: SANS, fontSize: 10.5, color: MUTED, lineSpacing: 13, valign: "top", margin: 0 });
  });
  // Illustrative report card.
  s.addShape("rect", { x: 5.86, y: 1.62, w: 3.62, h: 2.9, fill: { color: WASH }, line: { color: RULE, width: 1 } });
  s.addShape("rect", { x: 5.86, y: 1.62, w: 0.05, h: 2.9, fill: { color: GOLD } });
  s.addText("YOUR SLOT · MONTHLY REPORT", { x: 6.1, y: 1.82, w: 3.2, h: 0.24, fontFace: SANS, fontSize: 9.5, bold: true, color: GOLD_TEXT, charSpacing: 2, margin: 0 });
  s.addText("14,800", { x: 6.1, y: 2.14, w: 3.2, h: 0.55, fontFace: SERIF, fontSize: 30, bold: true, color: GREEN, margin: 0 });
  s.addText("sponsored impressions", { x: 6.1, y: 2.66, w: 3.2, h: 0.24, fontFace: SANS, fontSize: 10.5, color: MUTED, margin: 0 });
  s.addText("360", { x: 6.1, y: 3.04, w: 3.2, h: 0.55, fontFace: SERIF, fontSize: 30, bold: true, color: GREEN, margin: 0 });
  s.addText("click-throughs to your site", { x: 6.1, y: 3.56, w: 3.2, h: 0.24, fontFace: SANS, fontSize: 10.5, color: MUTED, margin: 0 });
  s.addText("Illustrative figures", { x: 6.1, y: 4.12, w: 3.2, h: 0.22, fontFace: SANS, fontSize: 8.5, italic: true, color: MUTED, margin: 0 });

  // ------------------------------------------------- 8 · close
  s = pres.addSlide();
  s.background = { color: GREEN };
  s.addText("NEXT STEPS", { x: 0.75, y: 1.05, w: 8.5, h: 0.3, fontFace: SANS, fontSize: 12, bold: true, color: GOLD, charSpacing: 3, margin: 0 });
  s.addText("Put your brand in the huddle.", { x: 0.7, y: 1.45, w: 8.6, h: 0.8, fontFace: SERIF, fontSize: 34, bold: true, color: WHITE, margin: 0 });
  s.addText("Packages run from a single-section credit to title sponsorship of the page. Slots activate the same day they're sold — before Week 1 puts the whole state on this page — and your live dashboard link comes with the first invoice.", {
    x: 0.75, y: 2.45, w: 7.6, h: 0.8, fontFace: SANS, fontSize: 14, color: SAGE, lineSpacing: 20, margin: 0,
  });
  s.addShape("rect", { x: 0.75, y: 3.6, w: 5.6, h: 1.1, fill: { color: WHITE } });
  s.addShape("rect", { x: 0.75, y: 3.6, w: 0.05, h: 1.1, fill: { color: GOLD } });
  s.addText("sales@wausaupilotandreview.com", { x: 1.0, y: 3.76, w: 5.2, h: 0.3, fontFace: SANS, fontSize: 14, bold: true, color: GREEN, margin: 0 });
  s.addText("715-301-5539   ·   602 Ruder St., Wausau, WI 54403", { x: 1.0, y: 4.1, w: 5.2, h: 0.28, fontFace: SANS, fontSize: 11, color: MUTED, margin: 0 });
  s.addText("Wausau Pilot & Review — Where Locals Look First For News", { x: 0.75, y: 5.05, w: 8.5, h: 0.28, fontFace: SANS, fontSize: 10, italic: true, color: SAGE, margin: 0 });

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
}

main().catch((e) => { console.error(e); process.exit(1) });
