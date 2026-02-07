const POSITIONS = ["Jammer", "Pivot", "Blocker1", "Blocker2", "Blocker3"];

function readPosition(get, teamNum, pos) {
  const base = `ScoreBoard.CurrentGame.Team(${teamNum}).Position(${pos})`;
  return {
    pos, // "Jammer", "Pivot", ...
    name: s(get(`${base}.Name`), ""),
    number: s(get(`${base}.RosterNumber`), ""),
  };
}

function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function s(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function readClock(get, name) {
  const base = `ScoreBoard.CurrentGame.Clock(${name})`;
  return {
    number: n(get(`${base}.Number`), 0),
    timeMs: n(get(`${base}.Time`), 0),
    running: !!get(`${base}.Running`),
  };
}

function pickPrimaryClock(m) {
  const candidates = [
    // { mode: "timeout",      label: "TIMEOUT",      clock: m.timeout },
    { mode: "intermission", label: "Intermission", clock: m.intermission },
    // { mode: "jam",          label: "JAM",          clock: m.jam },
    // { mode: "lineup",       label: "LINEUP",       clock: m.lineup },
    { mode: "period",       label: "Period",       clock: m.period },
  ];

  const isActive = (c) => c && c.running;

  return candidates.find(x => isActive(x.clock)) ?? candidates[candidates.length - 1];
}

function pickSecondaryClock(m) {
  if (m.timeout?.running) return { mode: "timeout", label: "Timeout", clock: m.timeout };
  if (m.jam?.running) return { mode: "jam", label: "Jam", clock: m.jam };
  if (m.lineup?.running) return { mode: "lineup", label: "Lineup", clock: m.lineup };

  return null;
}

function bool(v) { 
  if (v === true ) return true;
  if (v === false || v == null ) return false;
  if (typeof v === "string"){
    const x = v.trim().toLowerCase();
    if (x === "true" ) return true;
    if (x === "false" ) return false;
  }
  return !!v; 
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Build dot class strings from a "remaining" counter (timeouts/reviews).
 * Assumes remaining decrements at START of the event.
 * While active: the consumed dot flashes (Current) but is NOT marked Used until event ends.
 */
function buildDotsRemaining({ remaining, total, isActive = false, extraClass = "" }) {
  const r = clamp(Number(remaining ?? 0), 0, total);
  const usedCount = total - r;                 // remaining -> used

  const pendingIndex = isActive ? usedCount : -1;                 // 1..total
  const solidUsedCount = isActive ? Math.max(0, usedCount - 1) : usedCount;

  return Array.from({ length: total }, (_, i) => {
    const idx = i + 1;
    const used = idx <= solidUsedCount;
    const current = idx === pendingIndex;

    return ["Dot", extraClass, used ? "Used" : "", current ? "Current" : ""]
      .filter(Boolean)
      .join(" ");
  });
}




function jamStatusLabel({ starPass, lead, lost }) {
  if (starPass) return "STAR PASS";
  if (lost) return "LOST";
  if (lead) return "LEAD";
  return "";
}

export function buildOverlayModel(get, settings = {}) {
  // console.log("[model] buildOverlayModel settings", settings);
  const model = {
    state: s(get("ScoreBoard.CurrentGame.State"), "Unknown"),

    period: readClock(get, "Period"),
    jam: readClock(get, "Jam"),
    lineup: readClock(get, "Lineup"),
    timeout: readClock(get, "Timeout"),
    intermission: readClock(get, "Intermission"),

    teams: [1, 2].map((t) => {
      const o = settings?.teams?.[t] || {};

      const lead = bool(get(`ScoreBoard.CurrentGame.Team(${t}).Lead`));
      const lost = bool(get(`ScoreBoard.CurrentGame.Team(${t}).Lost`));
      const starPass = bool(get(`ScoreBoard.CurrentGame.Team(${t}).StarPass`));

      const timeouts = n(get(`ScoreBoard.CurrentGame.Team(${t}).Timeouts`), 0);
      const officialReviews = n(get(`ScoreBoard.CurrentGame.Team(${t}).OfficialReviews`), 0);

      const inTimeout = bool(get(`ScoreBoard.CurrentGame.Team(${t}).InTimeout`));
      // If your WS exposes this, add it; otherwise default false.
      const inOfficialReview = bool(get(`ScoreBoard.CurrentGame.Team(${t}).InOfficialReview`));
      
      const timeoutDots = buildDotsRemaining({ remaining: timeouts, total: 3, isActive: inTimeout });
      const reviewDot = buildDotsRemaining({
        remaining: officialReviews,
        total: 1,
        isActive: inOfficialReview,
        extraClass: "OfficialReview",
      })[0];

      const team = {
        idx: t,
        name: s(o.nameLong ?? get(`ScoreBoard.CurrentGame.Team(${t}).Name`), `Team ${t}`),
        initials: s(o.nameShort ?? get(`ScoreBoard.CurrentGame.Team(${t}).Initials`), ""),

        colors: {
          primary: o.colors?.primary ?? null,
          secondary: o.colors?.secondary ?? null,
          text: o.colors?.text ?? null,
        },

        score: n(get(`ScoreBoard.CurrentGame.Team(${t}).Score`), 0),
        jamScore: n(get(`ScoreBoard.CurrentGame.Team(${t}).JamScore`), 0),

        onTrack: POSITIONS.map((pos) => readPosition(get, t, pos)),

        jamStatus: { lead, lost, starPass },
        jamStatusLabel: jamStatusLabel({ lead, lost, starPass }),

        timeouts,
        officialReviews,
        inTimeout,
        inOfficialReview,

        timeoutDots,
        reviewDot,
      };


      return team;
    }),
  };

  const primary = pickPrimaryClock(model);

  model.mainClock = {
    mode: primary.mode,
    label: primary.label,
    timeMs: primary.clock?.timeMs ?? 0,
  };

  if (primary.mode === "period") {
    const secondary = pickSecondaryClock(model);
    model.secondaryClock = secondary
      ? { mode: secondary.mode, label: secondary.label, timeMs: secondary.clock?.timeMs ?? 0 }
      : null;
  } else {
    // Intermission: no secondary clock
    model.secondaryClock = null;
  }

  // model.layout = primary.mode === "intermission" ? "single" : "dual";

  function computeStatusLabel(m) {
    const inIntermission = !!m.intermission?.running;
    const pregame = inIntermission && (Number(m.period?.number) === 0);
    const unofficialScore = inIntermission && (Number(m.period?.number) === "");
    const officialScore = inIntermission && false;


    if (pregame) return "Time to Derby";
    if (unofficialScore) return "Unofficial Score";
    if (officialScore) return "Final Score";
    if (inIntermission) return "Intermission";

    // Otherwise: use whatever your secondary clock represents
    if (m.secondaryClock?.label) return m.secondaryClock.label;

    // Optional fallback
    return "Live";
  }

  model.statusLabel = computeStatusLabel(model);




  return model;
}


export function formatClockMs(ms) {
  const total = Math.max(0, Math.floor(n(ms) / 1000));
  const m = Math.floor(total / 60);
  const s2 = total % 60;
  return `${m}:${String(s2).padStart(2, "0")}`;
}
