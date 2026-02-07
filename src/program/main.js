import { createRawStateStore } from "../shared/rawStateStore.js";
import { createScoreboardClient } from "../shared/scoreboardClient.js";
import { buildOverlayModel, formatClockMs } from "../shared/overlayModel.js";

const store = createRawStateStore();

const HIDE_CLOCK_TICKS = true;

function safeRender() {
  try {
    render();
  } catch (err) {
    console.error("[program] render crashed:", err);
  }
}

function shouldLogWsKey(key) {
  if (!HIDE_CLOCK_TICKS) return true;

  // Hide noisy clock tick fields
  if (
    key.includes("ScoreBoard.CurrentGame.Clock(") &&
    (key.endsWith(".Time") || key.endsWith(".InvertedTime"))
  ) {
    return false;
  }

  return true;
}

const clockNames = ["Period", "Jam", "Lineup", "Timeout", "Intermission"];
const POSITION_BIND_KEYS = {
  Jammer: "jammer",
  Pivot: "pivot",
  Blocker1: "blocker1",
  Blocker2: "blocker2",
  Blocker3: "blocker3",
};

function bindTeamSkaters(team, prefix) {
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

const paths = [
  ...clockNames.map((c) => `ScoreBoard.CurrentGame.Clock(${c})`),
  "ScoreBoard.CurrentGame.Team(1)",
  "ScoreBoard.CurrentGame.Team(2)",
  "ScoreBoard.CurrentGame.State",
];


const client = createScoreboardClient({
  paths,
  onUpdate: ({ key, value }) => {
    if (
      !(key.includes("ScoreBoard.CurrentGame.Clock(") &&
        (key.endsWith(".Time") || key.endsWith(".InvertedTime")))
    ) {
      console.log("WS", key, value);
    }
    // console.log("WS", key, value);

    store.setDeep(key, value);
  },
});

client.start();

const lastText = new Map();

function ordinalSuffix(n) {
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

function setText(bindKey, value) {
  const next = String(value ?? "");

  if (lastText.get(bindKey) === next) return;
  lastText.set(bindKey, next);

  const nodes = document.querySelectorAll(`[data-bind="${bindKey}"]`);
  for (const el of nodes) el.textContent = next;

  const legacy = document.getElementById(bindKey);
  if (legacy) legacy.textContent = next;
}

function applyTextBinds(binds) {
  for (const [key, value] of Object.entries(binds)) {
    setText(key, value ?? "");
  }
}

function byPos(team, pos) {
  return team?.onTrack?.find(p => p.pos === pos) ?? null;
}

function getJammingSkater(team) {
  if (!team?.onTrack) return null;

  const byPos = Object.fromEntries(team.onTrack.map(p => [p.pos, p]));

  const starPass = !!team?.jamStatus?.starPass;

  return starPass ? byPos.Pivot : byPos.Jammer;
}

function render() {
  const m = buildOverlayModel(store.get);

  const pNum = m?.period?.number ?? 0;

  const t1 = m?.teams?.[0] ?? {};
  const t2 = m?.teams?.[1] ?? {};

  const t1Jamming = getJammingSkater(t1);
  const t2Jamming = getJammingSkater(t2);

  applyTextBinds({
    // --- Period / Jam numbers
    "period.number": pNum,
    "period.suffix": ordinalSuffix(pNum),   // optional
    "jam.number": m?.jam?.number ?? 0,

    // --- Clocks
    "main.time": formatClockMs(m.mainClock?.timeMs ?? 0),
    "secondary.time": formatClockMs(m.secondaryClock?.timeMs ?? 0),
    "status.label": m.statusLabel ?? "",


    // --- Teams
    "t1.name.long": t1.name || "",
    "t1.name.short": t1.initials || "",
    "t1.score": t1.score ?? 0,
    "t1.jamScore": t1.jamScore ?? 0,
    "t1.jam.status": t1.jamStatusLabel ?? "",


    "t2.name.long": t2.name || "",
    "t2.name.short": t2.initials || "",
    "t2.score": t2.score ?? 0,
    "t2.jamScore": t2.jamScore ?? 0,
    "t2.jam.status": t2.jamStatusLabel ?? "",

    // --- Skaters (example: jammer)
    ...bindTeamSkaters(t1, "t1"),
    ...bindTeamSkaters(t2, "t2"),

    // actively jamming?
    "t1.jamming.name": t1Jamming?.name ?? "",
    "t1.jamming.number": t1Jamming?.number ?? "",

    "t2.jamming.name": t2Jamming?.name ?? "",
    "t2.jamming.number": t2Jamming?.number ?? "",
  });

  // Later:
  // setShown("secondary", !!m.secondaryClock);
}

let scheduled = false;
function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    safeRender();
  });
}

// Re-render on any store update (throttled)
store.subscribe(scheduleRender);

console.log("[program] main.js loaded");

setTimeout(() => {
  console.log("[program] initial model snapshot");
  console.log(buildOverlayModel(store.get));
}, 500);

// paint
safeRender();
