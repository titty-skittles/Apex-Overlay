function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function s(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

export function buildOverlayModel(rawGet) {
  // rawGet(key) returns latest value from your rawStateStore
  const model = {
    state: s(rawGet("ScoreBoard.CurrentGame.State"), "Unknown"),

    period: {
      number: n(rawGet("ScoreBoard.CurrentGame.Clock(Period).Number"), 0),
      timeMs: n(rawGet("ScoreBoard.CurrentGame.Clock(Period).Time"), 0),
      running: !!rawGet("ScoreBoard.CurrentGame.Clock(Period).Running"),
    },

    jam: {
      number: n(rawGet("ScoreBoard.CurrentGame.Clock(Jam).Number"), 0),
      timeMs: n(rawGet("ScoreBoard.CurrentGame.Clock(Jam).Time"), 0),
      running: !!rawGet("ScoreBoard.CurrentGame.Clock(Jam).Running"),
    },

    teams: [1, 2].map((t) => ({
      idx: t,
      name: s(rawGet(`ScoreBoard.CurrentGame.Team(${t}).Name`), `Team ${t}`),
      initials: s(rawGet(`ScoreBoard.CurrentGame.Team(${t}).Initials`), ""),
      score: n(rawGet(`ScoreBoard.CurrentGame.Team(${t}).Score`), 0),
      timeouts: n(rawGet(`ScoreBoard.CurrentGame.Team(${t}).Timeouts`), 0),
      officialReviews: n(rawGet(`ScoreBoard.CurrentGame.Team(${t}).OfficialReviews`), 0),
    })),
  };

  return model;
}

export function formatClockMs(ms) {
  const total = Math.max(0, Math.floor(n(ms) / 1000));
  const m = Math.floor(total / 60);
  const s2 = total % 60;
  return `${m}:${String(s2).padStart(2, "0")}`;
}
