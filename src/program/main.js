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

function applyVisibilityBinds(binds) {
  for (const [selector, visible] of Object.entries(binds)) {
    const el = document.querySelector(selector);
    if (!el) continue;
    el.classList.toggle("is-hidden", !visible);
  }
}


function render() {
  if (!model) return;
  const m = model;

  const t1 = m.teams[0];
  const t2 = m.teams[1];
  const pNum = m?.period?.number ?? 0;

  const t1Jamming = getJammingSkater(t1);
  const t2Jamming = getJammingSkater(t2);

  applyTextBinds({
    "period.number": pNum,
    "period.suffix": ordinalSuffix(pNum),

    "status.label": m.statusLabel ?? "",
    "jam.number": String(m?.jam?.number ?? ""),

    "main.time": formatClockMs(m.mainClock?.timeMs ?? 0),
    "secondary.time": formatClockMs(m.secondaryClock?.timeMs ?? 0),

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

    ...bindTeamSkaters(t1, "t1"),
    ...bindTeamSkaters(t2, "t2"),

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

  // --- Visibility
  // If SSE model doesn't include ui yet, fall back to label-based jam detection:
  const label = String(m.statusLabel ?? "").trim();
  const showJam = (m.ui?.showJamNum ?? /^Jam\b/i.test(String(m.statusLabel ?? "").trim()));

  document.querySelector(".gameStatusStrip .jamNum")
    ?.classList.toggle("is-hidden", !showJam);

/*   document.querySelector("#jam-row")
    ?.classList.toggle("is-hidden", !(m.ui?.showJamRow ?? showJam)); */
}
