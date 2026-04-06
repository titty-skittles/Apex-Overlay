export function getJammingSkater(team) {
  if (!team?.onTrack) return null;

  const byPos = Object.fromEntries(team.onTrack.map(p => [p.pos, p]));

  const starPass = !!team?.jamStatus?.starPass;

  return starPass ? byPos.Pivot : byPos.Jammer;
}


export function ordinalSuffix(n) {
  const x = Number(n) || 0;
  const mod100 = x % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (x % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}


const POSITION_BIND_KEYS = {
  Jammer: "jammer",
  Pivot: "pivot",
  Blocker1: "blocker1",
  Blocker2: "blocker2",
  Blocker3: "blocker3",
};

export function bindTeamSkaters(team, prefix) {
  const binds = {};

  for (const key of Object.values(POSITION_BIND_KEYS)) {
    binds[`${prefix}.${key}.name`] = "";
    binds[`${prefix}.${key}.number`] = "";
  }

  if (!team?.onTrack) return binds;

  for (const skater of team.onTrack) {
    const key = POSITION_BIND_KEYS[skater.pos];
    if (!key) continue;

    binds[`${prefix}.${key}.name`] = skater.name ?? "";
    binds[`${prefix}.${key}.number`] = skater.number ?? "";
  }

  return binds;
}

export function readTeamSkater(get, teamNum, skaterId) {
  if (!skaterId) return null;
  const base = `ScoreBoard.CurrentGame.Team(${teamNum}).Skater(${skaterId})`;

  const name = String(get(`${base}.Name`), "");
  const number = String(get(`${base}.RosterNumber`), "") || String(get(`${base}.Number`), "");

  return { id: String(skaterId), name, number };
}

export function readPrevJamFielding(get, { periodNum, jamNum, teamNum, pos /* "Jammer"|"Pivot" */ }) {
  const base = `ScoreBoard.CurrentGame.Period(${periodNum}).Jam(${jamNum}).TeamJam(${teamNum}).Fielding(${pos})`;
  const skaterId = String(get(`${base}.Skater`) ?? "");
  const number = String(get(`${base}.SkaterNumber`) ?? "");

  if (!skaterId) return {
    name: "",
    number: "",
    skaterId: "",
  };

  const name =
    String(get(`ScoreBoard.CurrentGame.Team(${teamNum}).Skater(${skaterId}).Name`) ?? "");

  return {
    pos,
    skaterId,
    name,
    number,
  };
}

// Try jamNum first, else jamNum-1 (scoreboards vary on when Jam.Number increments)
export function pickPrevJamNumber(get, periodNum, jamNum, teamNum) {
  const has = (j) => !!get(`ScoreBoard.CurrentGame.Period(${periodNum}).Jam(${j}).TeamJam(${teamNum}).Fielding(Jammer).Skater`);
  if (has(jamNum)) return jamNum;
  if (jamNum > 0 && has(jamNum - 1)) return jamNum - 1;
  return jamNum;
}
