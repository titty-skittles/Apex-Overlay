import { createRawStateStore } from "../shared/rawStateStore.js";
import { createScoreboardClient } from "../shared/scoreboardClient.js";
import { buildOverlayModel, formatClockMs } from "../shared/overlayModel.js";

const store = createRawStateStore();




const HIDE_CLOCK_TICKS = true;

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

const client = createScoreboardClient({
  paths: [
    "ScoreBoard.CurrentGame.Clock(Period)",
    "ScoreBoard.CurrentGame.Clock(Jam)",
    "ScoreBoard.CurrentGame.Clock(Lineup)",
    "ScoreBoard.CurrentGame.Clock(Timeout)",
    "ScoreBoard.CurrentGame.Clock(Intermission)",
    "ScoreBoard.CurrentGame.Team(1)",
    "ScoreBoard.CurrentGame.Team(2)",
    "ScoreBoard.CurrentGame.State",
  ],
  onUpdate: ({ key, value }) => {
    if (shouldLogWsKey(key)) console.log("WS", key, value);
    store.set(key, value);
  },
});

client.start();

function setText(bindKey, value) {
  const v = value ?? "";

  // New: data-bind hooks
  const nodes = document.querySelectorAll(`[data-bind="${bindKey}"]`);
  for (const el of nodes) el.textContent = String(v);

  // Optional legacy support while migrating:
  // if your bindKey matches an id you used earlier, it will still work.
  const legacy = document.getElementById(bindKey);
  if (legacy) legacy.textContent = String(v);
}

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

function render() {
  const m = buildOverlayModel(store.get);

  // Safety: if model not ready yet, don't crash.
  const t1 = m?.teams?.[0] ?? {};
  const t2 = m?.teams?.[1] ?? {};

  setText("t1.name.long", t1.name || "");
  setText("t1.name.short", t1.initials || "");
  setText("t1.score", t1.score ?? 0);
  setText("t1.jamScore", t1.jamScore ?? 0);

  setText("t2.name.long", t2.name || "");
  setText("t2.name.short", t2.initials || "");
  setText("t2.score", t2.score ?? 0);
  setText("t2.jamScore", t2.jamScore ?? 0);

  // Period
  const pNum = m?.period?.number ?? 0;
  setText("period.number", pNum);
  setText("period.suffix", ordinalSuffix(pNum));
  setText("period.time", formatClockMs(m?.period?.timeMs ?? 0));

  // Jam
  setText("jam.number", m?.jam?.number ?? 0);
  setText("jam.time", formatClockMs(m?.jam?.timeMs ?? 0));

  // Optional: if your overlayModel exposes lineup/timeout/intermission, wire them too:
  if (m?.lineup) setText("lineup.time", formatClockMs(m.lineup.timeMs ?? 0));
  if (m?.timeout) setText("timeout.time", formatClockMs(m.timeout.timeMs ?? 0));
  if (m?.intermission) setText("intermission.time", formatClockMs(m.intermission.timeMs ?? 0));

  // If you have a derived "clock type" string (Jam/Lineup/Timeout/etc)
  if (m?.clockType) setText("clock.type", m.clockType);
}

/**
  * Throttle renders to at most once per animation frame.
  * This keeps it smooth even if WS sends bursts.
  */
let scheduled = false;
function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    render();
  });
}

// Re-render on any store update (throttled)
store.subscribe(scheduleRender);

console.log("[program] main.js loaded");
// store.subscribe(() => console.log("[program] store updated"));
// console.log(JSON.stringify(buildOverlayModel(store.get), null, 2));

setTimeout(() => {
  console.log("[program] initial model snapshot");
  console.log(buildOverlayModel(store.get));
}, 500);


render();
