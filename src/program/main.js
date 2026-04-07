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

let lastStatusLabel = "";
let lastStatusWidth = 0;

function updateStatusMarquee(force = false) {
  const outer = document.querySelector(".gameStatusInner");
  const text = document.querySelector(".gameStatusText");
  if (!outer || !text) return;

  const label = text.textContent ?? "";
  const width = outer.clientWidth;

  if (!force && label === lastStatusLabel && width === lastStatusWidth) {
    return;
  }

  lastStatusLabel = label;
  lastStatusWidth = width;

  text.classList.remove("is-marquee");
  outer.classList.remove("is-marquee");
  text.style.removeProperty("--marquee-distance");
  text.style.removeProperty("--marquee-duration");
  text.style.transform = "";

  const outerStyle = getComputedStyle(outer);
  const padLeft = parseFloat(outerStyle.paddingLeft) || 0;
  const padRight = parseFloat(outerStyle.paddingRight) || 0;
  const visibleWidth = outer.clientWidth - padLeft - padRight;

  const overflow = Math.ceil(text.scrollWidth - visibleWidth);

  if (overflow > 0) {
    const pxPerSecond = 36;
    const duration = Math.max(9, (overflow / pxPerSecond) * 2 + 2);

    text.style.setProperty("--marquee-distance", `${overflow}px`);
    text.style.setProperty("--marquee-duration", `${duration}s`);

    void text.offsetWidth; // restart cleanly
    text.classList.add("is-marquee");
    outer.classList.add("is-marquee");
  }
}


function render() {
  if (!model) return;
  const m = model;

  const t1 = m.teams[0];
  const t2 = m.teams[1];
  const pNum = m?.period?.number ?? 0;

  // console.log("[PROGRAM colors]", t1?.colors, t2?.colors);

  const t1Jamming = getJammingSkater(t1);
  const t2Jamming = getJammingSkater(t2);

  const isPregame = String(m.statusLabel ?? "").trim() === "Time to Derby";
  const isIntermission = m.intermission?.running === true;
  const isComingUp = (m.statusLabel ?? "").trim() === "Coming Up";
  const prevStatus = lastStatusLabel;

  const jr1 = m.display?.jammerRow?.t1 ?? {};
  const jr2 = m.display?.jammerRow?.t2 ?? {};

  const label = String(m.statusLabel ?? "").trim();
  const showJam = (m.ui?.showJamNum ?? /^Jam\b/i.test(String(m.statusLabel ?? "").trim()));

  //console.log("[program bg model]", m.background);

  if (document.body) {
    document.body.style.backgroundColor = m.background?.color ?? "transparent";
  }

  document.querySelector(".gameStatusStrip .jamNum")
    ?.classList.toggle("is-hidden", !showJam);

  document.querySelector(".periodBadge")
    ?.classList.toggle("is-hidden", isPregame || isIntermission );

  document.querySelector(".secondaryTime")
    ?.classList.toggle("is-hidden", isPregame ||  isIntermission );
  
  document.querySelectorAll(".jammerRow").forEach((el) => {
    el.classList.toggle("is-hidden", isPregame || isIntermission || isComingUp );
  });

  applyTextBinds({
    "period.number": pNum,
    "period.suffix": ordinalSuffix(pNum),

    "status.label": m.statusLabel ?? "",
    "jam.number": String(m?.jam?.number ?? ""),

    "main.time": formatClockMs(m.mainClock?.timeMs ?? 0),
    "secondary.time": formatClockMs(m.secondaryClock?.timeMs ?? 0),

    "t1.name.long": t1.name || "",
    "t1.name.short": t1.initials || "",
    "t1.name.long.crg": t1.crgNameLong || "",
    "t1.name.short.crg": t1.crgNameShort || "",
    "t1.score": t1.score ?? 0,
    "t1.jamScore": t1.jamScore ?? 0,
    "t1.jam.status": t1.jamStatusLabel ?? "",

    "t2.name.long": t2.name || "",
    "t2.name.short": t2.initials || "",
    "t2.name.long.crg": t2.crgNameLong || "",
    "t2.name.short.crg": t2.crgNameShort || "",
    "t2.score": t2.score ?? 0,
    "t2.jamScore": t2.jamScore ?? 0,
    "t2.jam.status": t2.jamStatusLabel ?? "",

    ...bindTeamSkaters(t1, "t1"),
    ...bindTeamSkaters(t2, "t2"),

    // use jamming binds for jam row as they are sticky to the previous jam during lineup
    "t1.jamming.number": jr1.jammer?.number ?? "",
    "t1.jamming.name": jr1.jammer?.name ?? "",
    "t2.jamming.number": jr2.jammer?.number ?? "",
    "t2.jamming.name": jr2.jammer?.name ?? "",
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

  document.documentElement.style.setProperty("--t1-primary-bg", t1?.colors?.primaryBg || "");
  document.documentElement.style.setProperty("--t1-primary-text", t1?.colors?.primaryText || "");
  document.documentElement.style.setProperty("--t1-secondary-bg", t1?.colors?.secondaryBg || "");
  document.documentElement.style.setProperty("--t1-secondary-text", t1?.colors?.secondaryText || "");

  document.documentElement.style.setProperty("--t2-primary-bg", t2?.colors?.primaryBg || "");
  document.documentElement.style.setProperty("--t2-primary-text", t2?.colors?.primaryText || "");
  document.documentElement.style.setProperty("--t2-secondary-bg", t2?.colors?.secondaryBg || "");
  document.documentElement.style.setProperty("--t2-secondary-text", t2?.colors?.secondaryText || "");
  
  // --- Visibility
  // If SSE model doesn't include ui yet, fall back to label-based jam detection:

  if ((m.statusLabel ?? "") !== prevStatus) {
    updateStatusMarquee(true);
  }


  document.querySelector(".gameStatusStrip .jamNum")
    ?.classList.toggle("is-hidden", !showJam);

/*   document.querySelector("#jam-row")
    ?.classList.toggle("is-hidden", !(m.ui?.showJamRow ?? showJam)); */
}
