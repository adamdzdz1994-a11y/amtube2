/* AMTube - YouTube ad blocker (runs inside the in-app browser only).
   Three independent parts, each switchable from Settings (window.__AMT = {yt, prune, css, skip}):
   1. prune: removes ad data from the player responses before YouTube's own code sees it
   2. css:   hides ad elements on the page
   3. skip:  clicks "Skip", and fast-forwards any ad that still plays */
(function () {
  "use strict";
  if (window.__amtYt) return;
  const cfg = window.__AMT || { yt: true, prune: true, css: true, skip: true };
  if (!cfg.yt) return;
  if (!/(^|\.)youtube\.com$/.test(location.hostname) && !window.__AMT_FORCE) return;
  window.__amtYt = true;

  const AD_KEYS = ["adPlacements", "playerAds", "adSlots", "adBreakHeartbeatParams", "adBreakParams"];
  function prune(o) {
    if (!o || typeof o !== "object") return o;
    if (o.playerResponse) prune(o.playerResponse);
    if (o.streamingData || o.videoDetails || o.playabilityStatus) AD_KEYS.forEach(k => { if (k in o) delete o[k]; });
    return o;
  }

  if (cfg.prune) {
    const P = JSON.parse;
    JSON.parse = function () { return prune(P.apply(this, arguments)); };
    if (window.Response && Response.prototype.json) {
      const R = Response.prototype.json;
      Response.prototype.json = function () { return R.apply(this, arguments).then(prune); };
    }
    let ipr;
    try {
      Object.defineProperty(window, "ytInitialPlayerResponse", { configurable: true, get() { return ipr; }, set(v) { ipr = prune(v); } });
    } catch (e) { /* already defined */ }
  }

  if (cfg.css) {
    const css = [".video-ads", ".ytp-ad-module", ".ytp-ad-overlay-container", ".ytp-ad-image-overlay", ".ytp-ad-text-overlay",
      ".ytp-suggested-action", "#player-ads", "#masthead-ad", ".masthead-ad", "ytd-ad-slot-renderer", "ytd-banner-promo-renderer",
      "ytd-promoted-sparkles-web-renderer", "ytd-display-ad-renderer", "ytd-in-feed-ad-layout-renderer", "ytd-companion-slot-renderer",
      "ytm-promoted-sparkles-web-renderer", "ytm-promoted-video-renderer", "ytm-companion-slot", "ytm-statement-banner-renderer",
      "ad-slot-renderer", "ytm-ad-slot-renderer", ".ytm-promoted-sparkles-text-search-renderer", ".ad-container", ".ad-div",
      "[id^='google_ads']", "ins.adsbygoogle"].join(",") + "{display:none!important}";
    // at document start there may be no <html> yet, so keep trying until the page exists
    const add = () => { if (document.getElementById("amt-yt-css")) return true; const root = document.head || document.documentElement; if (!root) return false;
      const s = document.createElement("style"); s.id = "amt-yt-css"; s.textContent = css; root.appendChild(s); return true; };
    if (!add()) { const iv = setInterval(() => { if (add()) clearInterval(iv); }, 15); document.addEventListener("DOMContentLoaded", add); }
  }

  if (cfg.skip) {
    let active = false, saved = null;
    const SKIP = ".ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,.ytp-ad-skip-button-container button,.ytp-ad-overlay-close-button";
    setInterval(() => {
      const pl = document.querySelector("#movie_player, .html5-video-player");
      const v = document.querySelector("video.html5-main-video, video");
      const ad = !!(pl && (pl.classList.contains("ad-showing") || pl.classList.contains("ad-interrupting")));
      document.querySelectorAll(SKIP).forEach(b => { try { b.click(); } catch (e) { /* ignore */ } });
      if (ad && v) {
        if (!active) { saved = { muted: v.muted, rate: v.playbackRate }; active = true; }
        v.muted = true; v.playbackRate = 16;
        if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.1) v.currentTime = v.duration - 0.05;
      } else if (active && v) {
        v.muted = saved ? saved.muted : false; v.playbackRate = saved ? saved.rate : 1; active = false; saved = null;
      }
    }, 300);
  }
})();
