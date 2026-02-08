import { createSseClient } from "../shared/sseClient.js";
import { ordinalSuffix, getJammingSkater, bindTeamSkaters } from "../shared/overlayUtils.js";
import { formatClockMs } from "../shared/overlayModel.js"
import { applyTextBinds, applyClassBinds  } from "./binds.js";

let model = null;

const sse = createSseClient("/sse");

sse.onStatus(console.log);
sse.onJson("model", (m) => {
  model = m;
  render();
});
sse.connect();

function render() {
  if (!model) return;
  const m = model;

  const t1 = model.teams[0];
  const t2 = model.teams[1];

  const pNum = m?.period?.number ?? 0;


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
  

  applyClassBinds({
  "t1.timeout.1": t1.timeoutDots?.[0] ?? "Dot",
  "t1.timeout.2": t1.timeoutDots?.[1] ?? "Dot",
  "t1.timeout.3": t1.timeoutDots?.[2] ?? "Dot",
  "t1.review.1":  t1.reviewDot ?? "Dot OfficialReview",

  "t2.timeout.1": t2.timeoutDots?.[0] ?? "Dot",
  "t2.timeout.2": t2.timeoutDots?.[1] ?? "Dot",
  "t2.timeout.3": t2.timeoutDots?.[2] ?? "Dot",
  "t2.review.1":  t2.reviewDot ?? "Dot OfficialReview",
  });


  // Later:
  // setShown("secondary", !!m.secondaryClock);
  // applyTeamColors(t1, t2);
}
