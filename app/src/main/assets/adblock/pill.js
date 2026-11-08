/* AMTube - the round download button shown on the bottom-right corner of a playing video in the in-app browser.
   Tapping it tells the app (AMPage.onVideo) which page the video is on; the app then shows the quality list. */
(function () {
  "use strict";
  if (window.__amtPill) return;
  window.__amtPill = true;
  const cfg = window.__AMT || {};
  const accent = cfg.accent || "#FFC400", ink = cfg.onAccent || "#111111";
  let host = null, btn = null, vid = null;

  function make() {
    host = document.createElement("div");
    host.setAttribute("data-amt", "pill");
    host.style.cssText = "all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = '<style>button{all:initial;position:fixed;width:48px;height:48px;border-radius:50%;background:' + accent +
      ';display:none;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(0,0,0,.45);cursor:pointer}' +
      'button.on{display:flex}svg{width:26px;height:26px}</style><button aria-label="Download"><svg viewBox="0 0 24 24" fill="none" stroke="' + ink +
      '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M7.4 10.8 12 15.4l4.6-4.6"/><path d="M5 20h14"/></svg></button>';
    btn = root.querySelector("button");
    const fire = e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      try { window.AMPage.onVideo(location.href, vid && /^https?:/.test(vid.currentSrc || "") ? vid.currentSrc : ""); } catch (x) { /* not inside the app */ } };
    ["click", "touchend"].forEach(n => btn.addEventListener(n, fire, true));
    ["touchstart", "mousedown", "pointerdown"].forEach(n => btn.addEventListener(n, e => e.stopPropagation(), true));
    document.documentElement.appendChild(host);
  }
  function pick() {
    let best = null, score = 0;
    document.querySelectorAll("video").forEach(v => {
      const r = v.getBoundingClientRect(); if (r.width < 180 || r.height < 100) return;
      const cs = getComputedStyle(v); if (cs.visibility === "hidden" || cs.display === "none") return;
      const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)), h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      const s = w * h * (v.paused ? 1 : 1.4); if (w * h < r.width * r.height * 0.3) return; if (s > score) { score = s; best = v; }
    });
    return best;
  }
  function tick() {
    vid = pick();
    if (vid && !host) make();
    if (!host) return;
    if (!vid) { btn.classList.remove("on"); return; }
    const r = vid.getBoundingClientRect();
    const x = Math.min(r.right, innerWidth) - 62, y = Math.min(r.bottom, innerHeight) - 62;
    btn.style.left = Math.max(x, Math.max(r.left, 0) + 6) + "px"; btn.style.top = Math.max(y, Math.max(r.top, 0) + 6) + "px";
    btn.classList.add("on");
  }
  setInterval(tick, 500);
  window.addEventListener("scroll", tick, { passive: true, capture: true });
  window.addEventListener("resize", tick, { passive: true });
  tick();
})();
