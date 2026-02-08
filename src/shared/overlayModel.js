import { readPrevJamFielding, pickPrevJamNumber } from "./overlayUtils.js";

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
    name: s(get(`${base}.Name`), ""),
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
  if (m.lineup?.running) {
    const nm = String(m.lineup?.name ?? "").trim();
    return { mode: "lineup", label: nm || "Lineup", clock: m.lineup };
  }
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

function timeoutOwnerToTeamIndex(ownerRaw) {
  const owner = String(ownerRaw ?? "").trim().toUpperCase();
  if (!owner) return null;

  // old format
  if (owner === "1") return 0;
  if (owner === "2") return 1;

  // v5+ format: "<gameId>_1" / "<gameId>_2"
  if (owner.endsWith("_1")) return 0;
  if (owner.endsWith("_2")) return 1;

  return null; // "O" or unknown
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
    timeoutOwner: s(get("ScoreBoard.CurrentGame.TimeoutOwner"), ""),
    officialReview: bool(get("ScoreBoard.CurrentGame.OfficialReview")),
    officialScore: bool(get("ScoreBoard.CurrentGame.OfficialScore")),
    inhibitFinalScore: bool(get("ScoreBoard.CurrentGame.InhibitFinalScore")),


    teams: [1, 2].map((t) => {
      const o = settings?.teams?.[t] || {};

      const lead = bool(get(`ScoreBoard.CurrentGame.Team(${t}).Lead`));
      const lost = bool(get(`ScoreBoard.CurrentGame.Team(${t}).Lost`));
      const starPass = bool(get(`ScoreBoard.CurrentGame.Team(${t}).StarPass`));

      const timeouts = n(get(`ScoreBoard.CurrentGame.Team(${t}).Timeouts`), 0);
      const officialReviews = n(get(`ScoreBoard.CurrentGame.Team(${t}).OfficialReviews`), 0);

      const inTimeout = bool(get(`ScoreBoard.CurrentGame.Team(${t}).InTimeout`));
      const inOfficialReview = bool(get(`ScoreBoard.CurrentGame.Team(${t}).InOfficialReview`));
      
      const timeoutDots = buildDotsRemaining({ remaining: timeouts, total: 3, isActive: inTimeout });
      const reviewDot = buildDotsRemaining({
        remaining: officialReviews,
        total: 1,
        isActive: inOfficialReview,
        extraClass: "OfficialReview",
      })[0];

      const wsNameLong = get(`ScoreBoard.CurrentGame.Team(${t}).Name`);
      const wsNameShort = get (`ScoreBoard.CurrentGame.Team(${t}).Initials`);

      const nameLong =
        o.nameLong && o.nameLong.trim() !== ""
          ? o.nameLong
          : wsNameLong;

      const nameShort =
        o.nameShort && o.nameShort.trim() !== ""
          ? o.nameShort
          : wsNameShort;

      const team = {
        idx: t,
        name: s(nameLong, `Team ${t}`),
        initials: s(nameShort, ""),

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

  function computeStatusLabel(m) {
    // console.log("[computeStatusLabel] called", {
    //   intermission: !!m.intermission?.running,
    //   secondaryMode: m.secondaryClock?.mode,
    //   secondaryLabel: m.secondaryClock?.label,
    //   timeoutRunning: !!m.timeout?.running,
    //   officialReview: m.officialReview,
    // });

    const inIntermission = !!m.intermission?.running;
    //if (Number(m.period?.number) === 0) return "Time to Derby";
    if (inIntermission && Number(m.period?.number) === 0) return "Time to Derby";

    // --- End of game / score states
    const isFinished = String(m.state ?? "").toLowerCase() === "finished";
    // Period 2 not running is the “game ended” signal in your feed
    const gameEnded = (m.period?.number >= 2) && (m.period?.running === false);
    if (m.officialScore || isFinished) {
      return "Official Score";
    }
    // If the game has ended but isn’t official yet, show Unofficial Score
    if (gameEnded) {
      return "Unofficial Score";
    }

    if (inIntermission) return "Intermission";

    const lineupName = String(m.lineup?.name ?? "").trim();
    if (m.lineup?.running && /^post timeout$/i.test(lineupName)) {
      return "Post Timeout";
    }

    if (m.timeout?.running) {
      if (m.teams?.[0]?.inOfficialReview) return `Official Review - ${m.teams?.[0]?.name ?? "Team 1"}`;
      if (m.teams?.[1]?.inOfficialReview) return `Official Review - ${m.teams?.[1]?.name ?? "Team 2"}`;
      if (m.officialReview) return "Official Review";

      const ownerRaw = String(m.timeoutOwner ?? "").trim();
      const teamIdx = timeoutOwnerToTeamIndex(ownerRaw);
      if (teamIdx != null) {
        const teamName = m.teams?.[teamIdx]?.name ?? `Team ${teamIdx + 1}`;
        return `Timeout - ${teamName}`;
      }

      const owner = ownerRaw.toUpperCase();
      if (owner === "O") return "Official Timeout";
      return "Timeout";
    }

    if (m.lineup?.running) {
      const nm = String(m.lineup?.name ?? "").trim();
      return nm || "Lineup";
    }

    // 3) JAM when JAM CLOCK is running
    if (m.jam?.running) {
      const n = m.jam?.number;
      return n ? `Jam ${n}` : "Jam";
    }
          // fallback
    return m.mainClock?.label ?? "Live";
  }

  model.statusLabel = computeStatusLabel(model);
  // console.log("[phase]", {
  //   label: model.statusLabel,
  //   timeoutRunning: model.timeout?.running,
  //   lineupRunning: model.lineup?.running,
  //   lineupName: model.lineup?.name,
  //   timeoutOwner: model.timeoutOwner,
  //   officialReview: model.officialReview,
  // });



  // --- UI flags
  const label = (model.statusLabel ?? "").trim();

  const isJam = model.jam?.running === true;
  const isTimeout = model.timeout?.running === true;  
  const isLineup = model.lineup?.running === true && !isJam && !isTimeout;
  const isIntermission = model.intermission?.running === true;
  const isOfficialScore = model.statusLabel === "Official Score";
  const isPregame = model.statusLabel === "Time to Derby";

  const periodNum = Number(model.period?.number ?? 0);
  const jamNum = Number(model.jam?.number ?? 0);

  // --- Jammer row display bundle (prevents "next jammer + previous jamScore/status")

  model.display = model.display || {};
  model.display.jammerRow = {};

  // helper to read current jammer from onTrack (respects star pass)
  function currentJammer(team) {
    if (!team?.onTrack) return { name: "", number: "" };
    const jammer = team.onTrack.find(p => p.pos === "Jammer");
    const pivot  = team.onTrack.find(p => p.pos === "Pivot");
    const use = team?.jamStatus?.starPass ? pivot : jammer;
    return { name: use?.name ?? "", number: use?.number ?? "" };
  }

  for (const teamNum of [1, 2]) {
    const teamIdx = teamNum - 1;
    const team = model.teams?.[teamIdx];

    let jammer = currentJammer(team);
    let status = team?.jamStatusLabel ?? "";

    if (isLineup) {
      const prevJam = pickPrevJamNumber(get, periodNum, jamNum, teamNum);

      // Use previous jam fielding for jammer identity
      const prev = readPrevJamFielding(get, { periodNum, jamNum: prevJam, teamNum, pos: "Jammer" });

      jammer = { name: prev.name, number: prev.number };

      // Optional: blank status in lineup to avoid stale/misleading flags
      status = "";

      // Targeted debug only when name lookup fails
      if (!jammer.name && jammer.number) {
        console.log("[jammerRow] name missing (lineup)", {
          teamNum,
          periodNum,
          jamNum,
          prevJam,
          ...prev._debug,
          triedTeamSkaterKey: prev.skaterId
            ? `ScoreBoard.CurrentGame.Team(${teamNum}).Skater(${prev.skaterId}).Name`
            : null,
        });
      }
    }

    model.display.jammerRow[`t${teamNum}`] = {
      jammer,
      jamScore: team?.jamScore ?? 0, // ✅ keep LIVE for post-jam point adjustments
      status,
    };
  }



  model.ui = {
    showJamNum: isJam,
    showJamRow: isJam,
    showLineupRow: isLineup,
    showTimeoutRow: isTimeout,
    showIntermissionRow: isIntermission,
    showPregameRow: isPregame,
    showOfficialScoreRow: isOfficialScore,
  };

  return model;
}


export function formatClockMs(ms) {
  const total = Math.max(0, Math.floor(n(ms) / 1000));
  const m = Math.floor(total / 60);
  const s2 = total % 60;
  return `${m}:${String(s2).padStart(2, "0")}`;
}
