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

function jamStatusLabel({ starPass, lead, lost }) {
  if (starPass) return "Star Pass";
  if (lost) return "Lost";
  if (lead) return "Lead";
  return "";
}

export function buildOverlayModel(get) {
  const model = {
    state: s(get("ScoreBoard.CurrentGame.State"), "Unknown"),

    period: readClock(get, "Period"),
    jam: readClock(get, "Jam"),
    lineup: readClock(get, "Lineup"),
    timeout: readClock(get, "Timeout"),
    intermission: readClock(get, "Intermission"),

    teams: [1, 2].map((t) => {
      const lead = bool(get(`ScoreBoard.CurrentGame.Team(${t}).Lead`));
      const lost = bool(get(`ScoreBoard.CurrentGame.Team(${t}).Lost`));
      const starPass = bool(get(`ScoreBoard.CurrentGame.Team(${t}).StarPass`));

      return {
        idx: t,
        name: s(get(`ScoreBoard.CurrentGame.Team(${t}).Name`), `Team ${t}`),
        initials: s(get(`ScoreBoard.CurrentGame.Team(${t}).Initials`), ""),
        score: n(get(`ScoreBoard.CurrentGame.Team(${t}).Score`), 0),
        jamScore: n(get(`ScoreBoard.CurrentGame.Team(${t}).JamScore`), 0),

        onTrack: POSITIONS.map((pos) => readPosition(get, t, pos)),

        jamStatus: { lead, lost, starPass },
        jamStatusLabel: jamStatusLabel({ lead, lost, starPass }),

        timeouts: n(get(`ScoreBoard.CurrentGame.Team(${t}).Timeouts`), 0),
        officialReviews: n(get(`ScoreBoard.CurrentGame.Team(${t}).OfficialReviews`), 0),
      };
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
