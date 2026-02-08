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

  if (!team?.onTrack) return binds;

  for (const skater of team.onTrack) {
    const key = POSITION_BIND_KEYS[skater.pos];
    if (!key) continue;

    binds[`${prefix}.${key}.name`] = skater.name ?? "";
    binds[`${prefix}.${key}.number`] = skater.number ?? "";
  }

  return binds;
}
