/* AMTube UI */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ic = (n, s) => AMIcons.svg(n, s);
  const F = AMFormats;

  const DEFAULTS = {
    lang: null, theme: "auto", accent: "#FFC400", quality: "ask", audio: "mp3", parallel: 2, wifiOnly: false, subs: false,
    adblock: { youtube: true, prune: true, css: true, skip: true, web: false },
    cat: "music",
    shortcuts: [
      { id: "yt", name: "YouTube", url: "https://m.youtube.com", c: "#d9363e" }, { id: "fb", name: "Facebook", url: "https://m.facebook.com", c: "#3b6fd4" },
      { id: "ig", name: "Instagram", url: "https://www.instagram.com", c: "#b83a8f" }, { id: "x", name: "X", url: "https://x.com", c: "#1d2230" },
      { id: "tt", name: "TikTok", url: "https://www.tiktok.com", c: "#12a8a0" }, { id: "vm", name: "Vimeo", url: "https://vimeo.com", c: "#2a9fd0" },
      { id: "dm", name: "Dailymotion", url: "https://www.dailymotion.com", c: "#2b6be0" }, { id: "sc", name: "SoundCloud", url: "https://m.soundcloud.com", c: "#e8601c" }]
  };
  const CATS = ["music", "gaming", "news", "sports", "tech", "comedy", "food", "movies"];
  const SWATCHES = ["#FFC400", "#FF8A00", "#FF4D4D", "#E91E8C", "#9B5CFF", "#4C6FFF", "#00A3FF", "#00C2B8", "#2FB36D", "#8BC34A", "#A67C52", "#8D96A8"];

  const S = { settings: null, downloads: [], engine: {}, night: false, lang: "en", tab: "home", results: [], loading: false, err: "",
    editSites: false, libTab: "video", sheets: [], locale: "en", version: "" };
  const merge = (d, s) => { const o = Array.isArray(d) ? d.slice() : Object.assign({}, d);
    for (const k in s) o[k] = (d && typeof d[k] === "object" && d[k] && !Array.isArray(d[k]) && s[k] && typeof s[k] === "object") ? merge(d[k], s[k]) : s[k]; return o; };
  const t = (k, v) => AMI18N.t(S.lang, k, v);
  const save = () => AMN.call("setSettings", S.settings).catch(() => {});
  const getK = (o, p) => p.split(".").reduce((a, k) => a && a[k], o);
  const setK = (o, p, v) => { const ks = p.split("."); const l = ks.pop(); const r = ks.reduce((a, k) => a[k], o); r[l] = v; };

  // ------------------------------------------------------------ theme / language / accent
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const lum = h => { const [r, g, b] = hexRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  function hslToHex(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))); return "#" + [f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase(); }
  function hexToHsl(hex) { let [r, g, b] = hexRgb(hex).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0, s = 0; const l = (mx + mn) / 2;
    if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]; }
  const validHex = h => /^#[0-9a-fA-F]{6}$/.test(h);

  function applyAccent(hex) {
    const st = document.documentElement.style, [r, g, b] = hexRgb(hex);
    st.setProperty("--accent", hex); st.setProperty("--on-accent", lum(hex) > .38 ? "#111111" : "#ffffff");
    st.setProperty("--accent-soft", `rgba(${r},${g},${b},.16)`);
  }
  function resolvedTheme() { const th = S.settings.theme; if (th !== "auto") return th;
    const dark = S.night || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); return dark ? "dark" : "light"; }
  function applyAll() {
    const h = document.documentElement, rt = resolvedTheme();
    h.dataset.theme = rt; h.lang = S.lang; h.dir = S.lang === "ar" ? "rtl" : "ltr"; applyAccent(S.settings.accent);
    const bg = getComputedStyle(h).getPropertyValue("--bg").trim() || "#ffffff";
    AMN.call("applyTheme", { dark: rt !== "light", bg }).catch(() => {});
  }

  // ------------------------------------------------------------ small helpers
  let toastT;
  function toast(msg) { const o = $("#overlay"); const old = $(".toast", o); if (old) old.remove(); const d = document.createElement("div"); d.className = "toast"; d.textContent = msg; o.appendChild(d);
    clearTimeout(toastT); toastT = setTimeout(() => d.remove(), 2200); }
  const isUrl = s => /^(https?:\/\/)\S+$/i.test(s) || /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s);
  const fixUrl = s => /^https?:\/\//i.test(s) ? s : "https://" + s;
  const cleanErr = e => String(e && e.message || e || "").replace(/\x1b\[[0-9;]*m/g, "").replace(/^(ERROR:\s*)+/i, "").slice(0, 260);
  const thumbOf = e => e.thumbnail || (e.id && /^[\w-]{11}$/.test(e.id) ? "https://i.ytimg.com/vi/" + e.id + "/mqdefault.jpg" : "");
  const qOf = c => t("q_" + c);

  // ------------------------------------------------------------ sheets
  function openSheet(html, opts) {
    const w = document.createElement("div"); w.className = "wrap"; w.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`;
    w.addEventListener("click", e => { if (e.target === w) closeSheet(); });
    $("#overlay").appendChild(w); const rec = { el: w, onClose: opts && opts.onClose }; S.sheets.push(rec); return rec;
  }
  function closeSheet(silent) { const r = S.sheets.pop(); if (!r) return false; r.el.remove(); if (!silent && r.onClose) r.onClose(); return true; }
  const topSheet = () => S.sheets[S.sheets.length - 1];

  function choose(title, options, current) {
    return new Promise(res => {
      const rows = options.map(o => `<button class="opt ${o.v === current ? "on" : ""}" data-act="pick" data-v="${esc(o.v)}"><span class="rd"></span><span class="lb">${esc(o.l)}</span></button>`).join("");
      const rec = openSheet(`<h3 style="margin:2px 0 12px">${esc(title)}</h3>${rows}`, { onClose() { res(undefined); } });
      rec.el.addEventListener("click", e => { const b = e.target.closest("[data-act=pick]"); if (b) { rec.onClose = null; closeSheet(true); res(b.dataset.v); } });
    });
  }

  // ------------------------------------------------------------ views
  function brandLogo() { return `<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="var(--accent)"/><path d="M11 8.5v15l12.5-7.5z" fill="var(--on-accent)"/><path d="M21 21.2v5.6m-2.6-2.6 2.6 2.6 2.6-2.6" stroke="var(--on-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`; }
  function setupNav() {
    const act = S.downloads.filter(d => d.state === "running" || d.state === "queued").length;
    $("#nav").innerHTML = [["home", "home"], ["sites", "sites"], ["library", "library"], ["settings", "settings"]].map(([k, i]) =>
      `<button data-act="tab" data-v="${k}" class="${S.tab === k ? "on" : ""}">${ic(i, 24)}<span>${t(k)}</span>${k === "library" && act ? `<span class="bdg">${act}</span>` : ""}</button>`).join("");
  }
  function render() { setupNav(); const v = $("#view"); const keep = v.scrollTop;
    ({ home: renderHome, sites: renderSites, library: renderLibrary, settings: renderSettings })[S.tab](v); v.scrollTop = keep; }

  function renderHome(v) {
    const cats = CATS.map(c => `<button class="chip ${S.settings.cat === c ? "on" : ""}" data-act="cat" data-v="${c}">${t("cat_" + c)}</button>`).join("");
    let body;
    if (S.loading) body = `<div class="spin"></div>`;
    else if (S.err) body = `<div class="empty">${ic("alert", 40)}<b>${t("err_generic")}</b>${esc(S.err)}<br><button class="retry" data-act="retry">${t("try_again")}</button></div>`;
    else if (!S.results.length) body = `<div class="empty">${ic("search", 44)}<b>${t("app")}</b>${t("results_hint")}</div>`;
    else body = `<div class="list">${S.results.map((e, i) => `<div class="card" data-act="open" data-i="${i}"><div class="thumb">${thumbOf(e) ? `<img loading="lazy" src="${esc(thumbOf(e))}" alt="">` : ""}${e.duration ? `<span class="dur">${F.fmtDur(e.duration)}</span>` : ""}<button class="fab" data-act="dl" data-i="${i}" aria-label="${t("download")}">${ic("download", 24)}</button></div><div class="meta"><div class="ttl">${esc(e.title)}</div><div class="sub">${esc(e.uploader || e.channel || "")}</div></div></div>`).join("")}</div>`;
    v.innerHTML = `<div class="head"><div class="brand">${brandLogo()}<span>${t("app")}</span></div></div>
      <form class="search" id="qform" autocomplete="off"><span>${ic("search", 22)}</span><input id="q" type="text" inputmode="url" enterkeyhint="go" placeholder="${esc(t("search_ph"))}" value="${esc(S.q || "")}">
      <button type="button" class="sbtn" data-act="paste" aria-label="${t("paste")}">${ic("paste", 20)}</button><button type="submit" class="sbtn sgo" aria-label="${t("go")}">${ic("chevron", 20)}</button></form>
      ${S.engine && S.engine.ready === false ? `<div class="note">${t("engine_wait")}</div>` : ""}<div class="chips">${cats}</div>${body}`;
  }

  function renderSites(v) {
    const sc = S.settings.shortcuts;
    const tiles = sc.map((s, i) => `<div class="site" data-act="${S.editSites ? "none" : "site"}" data-i="${i}"><div class="av" style="background:${esc(s.c || "#555")}">${esc((s.name || "?").trim().charAt(0).toUpperCase())}</div><span>${esc(s.name)}</span>
      ${S.editSites ? `<button class="badge-x" data-act="sdel" data-i="${i}" aria-label="${t("delete")}">${ic("close", 13)}</button><div class="mv"><button data-act="smv" data-i="${i}" data-d="-1">${ic("back", 13)}</button><button data-act="smv" data-i="${i}" data-d="1">${ic("chevron", 13)}</button></div>` : ""}</div>`).join("");
    v.innerHTML = `<div class="head"><div class="htitle">${t("sites_title")}</div><button class="hbtn" data-act="sedit" aria-label="${t("edit")}">${ic(S.editSites ? "check" : "edit", 20)}</button></div>
      <div class="grid">${tiles}<button class="site add" data-act="sadd"><div class="av">${ic("plus", 26)}</div><span>${t("add_site")}</span></button></div>`;
  }

  function dlMeta(d) { const bits = [];
    bits.push(d.kind === "audio" ? (d.audioFmt || "mp3").toUpperCase() : (d.height ? d.height + "p" : "")); if (d.size) bits.push(F.fmtSize(d.size, false)); return bits.filter(Boolean).join(" · "); }
  function renderLibrary(v) {
    const act = S.downloads.filter(d => d.state !== "done");
    const done = S.downloads.filter(d => d.state === "done");
    const tabs = [["video", "lib_video", done.filter(d => d.kind !== "audio").length], ["audio", "lib_audio", done.filter(d => d.kind === "audio").length], ["active", "lib_active", act.length]];
    let list;
    if (S.libTab === "active") list = act; else list = done.filter(d => (S.libTab === "audio") === (d.kind === "audio"));
    const items = list.map(d => {
      const p = d.progress >= 0 ? Math.round((d.progress || 0) * 100) : -1;
      const st = { running: t("running"), queued: t("queued"), paused: t("paused"), failed: t("failed"), done: t("finished") }[d.state] || d.state;
      const th = d.thumb ? `<img loading="lazy" src="${esc(d.thumb)}" alt="">` : ic(d.kind === "audio" ? "music" : "video", 26);
      let extra = "", acts = "";
      if (d.state === "done") acts = `<button class="ib pri" data-act="play" data-id="${esc(d.id)}" aria-label="${t("play")}">${ic("play", 20)}</button><button class="ib" data-act="share" data-id="${esc(d.id)}" aria-label="${t("share")}">${ic("share", 20)}</button><button class="ib dng" data-act="del" data-id="${esc(d.id)}" aria-label="${t("delete")}">${ic("trash", 20)}</button>`;
      else { extra = `<div class="bar ${p < 0 && d.state === "running" ? "ind" : ""}"><i style="width:${Math.max(p, 0)}%"></i></div>`;
        if (d.state === "failed" && d.error) extra += `<div class="err">${esc(d.error)}</div>`;
        acts = (d.state === "running" ? `<button class="ib" data-act="pause" data-id="${esc(d.id)}" aria-label="${t("pause")}">${ic("pause", 20)}</button>` : `<button class="ib pri" data-act="resume" data-id="${esc(d.id)}" aria-label="${t("resume")}">${ic("play", 20)}</button>`) + `<button class="ib dng" data-act="cancel" data-id="${esc(d.id)}" aria-label="${t("cancel_dl")}">${ic("close", 20)}</button>`; }
      const sub = d.state === "done" ? dlMeta(d) : `${st}${p >= 0 ? " · " + p + "%" : ""}${d.state === "running" && d.speed ? " · " + F.fmtSize(d.speed) + "/s" : ""}`;
      return `<div class="item"><div class="th">${th}</div><div class="b"><div class="t">${esc(d.title)}</div><div class="m">${sub}</div>${extra}<div class="acts">${acts}</div></div></div>`; }).join("");
    v.innerHTML = `<div class="head"><div class="htitle">${t("library")}</div></div>
      <div class="seg">${tabs.map(([k, l, n]) => `<button data-act="libtab" data-v="${k}" class="${S.libTab === k ? "on" : ""}">${t(l)}${n ? `<span class="cnt">${n}</span>` : ""}</button>`).join("")}</div>
      ${items || `<div class="empty">${ic("library", 44)}<b>${t("lib_empty")}</b>${t("lib_empty_hint")}</div>`}`;
  }

  function renderSettings(v) {
    const s = S.settings, e = S.engine || {};
    const row = (icon, title, sub, right, attrs) => `<button class="row" ${attrs || ""}><span class="ri">${ic(icon, 20)}</span><span class="rt"><div>${title}</div>${sub ? `<div class="rs">${sub}</div>` : ""}</span>${right || ""}</button>`;
    const tog = (k) => `<span class="sw" role="switch" aria-pressed="${!!getK(s, k)}"></span>`;
    const trow = (icon, title, k, sub) => row(icon, title, sub, tog(k), `data-act="tog" data-k="${k}"`);
    const themeL = { auto: t("theme_auto"), light: t("theme_light"), dark: t("theme_dark"), amoled: t("theme_amoled") }[s.theme];
    const qL = s.quality === "ask" ? t("ask_every_time") : s.quality + "p";
    const st = ok => `<span class="rv">${ok ? t("ready") : t("missing")}</span>`;
    v.innerHTML = `<div class="head"><div class="htitle">${t("settings")}</div></div>
      <div class="sec">${t("set_appearance")}</div><div class="rows">
        ${row("language", t("set_language"), "", `<span class="rv">${S.lang === "ar" ? "العربية" : "English"}</span>`, 'data-act="chlang"')}
        ${row(resolvedTheme() === "light" ? "sun" : "moon", t("set_theme"), "", `<span class="rv">${themeL}</span>`, 'data-act="chtheme"')}
        ${row("palette", t("set_accent"), "", `<span class="dot"></span>`, 'data-act="chcolor"')}</div>
      <div class="sec">${t("set_downloads")}</div><div class="rows">
        ${row("video", t("set_quality"), "", `<span class="rv">${qL}</span>`, 'data-act="chquality"')}
        ${row("music", t("set_audio"), "", `<span class="rv">${s.audio.toUpperCase()}</span>`, 'data-act="chaudio"')}
        ${row("queue", t("set_parallel"), "", `<span class="rv">${s.parallel}</span>`, 'data-act="chparallel"')}
        ${trow("wifi", t("set_wifi"), "wifiOnly")}${trow("edit", t("set_subs"), "subs")}</div>
      <div class="sec">${t("set_adblock")}</div><div class="rows">
        ${trow("shield", t("adblock_on"), "adblock.youtube", t("adblock_note"))}
        ${s.adblock.youtube ? trow("check", t("ab_prune"), "adblock.prune") + trow("check", t("ab_css"), "adblock.css") + trow("check", t("ab_skip"), "adblock.skip") : ""}
        ${trow("shield", t("ab_web"), "adblock.web")}</div>
      <div class="sec">${t("set_engine")}</div><div class="rows">
        ${row("download", t("engine_ytdlp"), e.ytdlp ? "yt-dlp " + esc(e.ytdlp) : "", st(e.ready))}
        ${row("music", t("engine_ffmpeg"), "", st(e.ffmpeg))}
        ${row("play", t("engine_js"), "", st(e.js))}
        ${row("update", t("update_engine"), "", "", 'data-act="upd"')}</div>
      <div class="sec">${t("set_about")}</div><div class="rows">
        ${row("info", t("app") + " " + t("version"), t("no_ads_note"), `<span class="rv">${esc(S.version || "1.0.0")}</span>`)}
        ${row("alert", t("rights_note"), "", "")}</div>`;
    $(".dot", v).style.background = s.accent;
  }

  // ------------------------------------------------------------ download sheet
  function pickDefault(opts) {
    const q = S.settings.quality, vids = opts.filter(o => o.type === "video"); if (!vids.length) return opts.findIndex(o => o.available !== false);
    if (q === "ask") return -1;
    const h = parseInt(q, 10), exact = vids.filter(o => o.height <= h)[0]; return opts.indexOf(exact || vids[vids.length - 1]);
  }
  async function showFormats(url, o) {
    o = o || {}; S.cur = { url, fromBrowser: !!o.fromBrowser, sel: -1, info: null };
    const rec = openSheet(`<div class="spin"></div><div style="text-align:center;color:var(--muted)">${t("fetching")}</div>`, { onClose() { if (o.fromBrowser) AMN.call("showBrowser").catch(() => {}); } });
    let info;
    try { info = await AMN.call("info", { url }); } catch (e) {
      if (o.alt && o.alt !== url) { rec.el.remove(); S.sheets.splice(S.sheets.indexOf(rec), 1); return showFormats(o.alt, { fromBrowser: o.fromBrowser }); }   // the page itself failed: try the video file address
      if (topSheet() === rec) rec.el.querySelector(".sheet").innerHTML = `<div class="grab"></div><div class="empty">${ic("alert", 40)}<b>${t("err_generic")}</b>${esc(cleanErr(e))}</div>`; return; }
    if (topSheet() !== rec) return;
    const sheet = rec.el.querySelector(".sheet");
    if (info && info._type === "playlist") return renderPlaylist(sheet, info, url);
    const b = F.build(info, { ffmpeg: S.engine.ffmpeg !== false }); b.url = url; S.cur.info = b; S.cur.sel = pickDefault(b.options);
    drawFormats(sheet);
  }
  function drawFormats(sheet) {
    const b = S.cur.info, sel = S.cur.sel;
    const rowFor = (o, i) => `<button class="opt ${i === sel ? "on" : ""}" data-act="opt" data-i="${i}" ${o.available === false ? "disabled" : ""}><span class="rd"></span><span class="lb">${esc(o.label)}</span><span class="tg">${esc(o.tag || "")}${o.available === false ? " · " + t("needs_engine") : ""}</span><span class="sz">${F.fmtSize(o.size, o.approx)}</span></button>`;
    const vids = b.options.map((o, i) => [o, i]).filter(x => x[0].type === "video"), aud = b.options.map((o, i) => [o, i]).filter(x => x[0].type === "audio");
    sheet.innerHTML = `<div class="grab"></div><div class="sh-h"><div class="th">${b.thumbnail ? `<img src="${esc(b.thumbnail)}" alt="">` : ""}</div><div style="min-width:0"><div class="ttl">${esc(b.title)}</div><div class="sub">${esc(b.uploader)} ${b.duration ? "· " + F.fmtDur(b.duration) : ""}</div></div></div>
      ${vids.length ? `<div class="sec" style="margin-top:6px">${t("video")}</div>${vids.map(x => rowFor(x[0], x[1])).join("")}` : ""}
      ${aud.length ? `<div class="sec">${t("audio")}</div>${aud.map(x => rowFor(x[0], x[1])).join("")}` : ""}
      <div class="sub" style="margin:4px 2px 10px">${ic("folder", 14)} ${t("save_in")}</div>
      <button class="big" data-act="startdl" ${sel < 0 ? "disabled style=opacity:.5" : ""}>${ic("download", 22)} ${t("download_btn")}</button>`;
  }
  async function startDownload(spec) {
    try { await AMN.call("download", spec); toast(t("added")); } catch (e) { toast(cleanErr(e)); }
  }
  function renderPlaylist(sheet, info, url) {
    const entries = (info.entries || []).filter(Boolean).map(e => Object.assign({}, e, { url: e.url && /^https?:/.test(e.url) ? e.url : (e.id ? "https://www.youtube.com/watch?v=" + e.id : url) }));
    S.cur.pl = { entries, on: new Set(entries.map((_, i) => i)), q: S.settings.quality === "ask" ? "720" : S.settings.quality };
    drawPlaylist(sheet, info.title);
  }
  function drawPlaylist(sheet, title) {
    const p = S.cur.pl; const qs = [["1080", "1080p"], ["720", "720p"], ["480", "480p"], ["360", "360p"], ["mp3", "MP3"]];
    sheet.innerHTML = `<div class="grab"></div><h3 style="margin:2px 0 4px">${esc(title || t("playlist"))}</h3><div class="sub">${p.on.size} ${t("selected")}</div>
      <div class="chips">${qs.map(([v, l]) => `<button class="chip ${p.q === v ? "on" : ""}" data-act="plq" data-v="${v}">${l}</button>`).join("")}</div>
      <button class="chip" data-act="plall" style="margin-bottom:6px">${t("select_all")}</button>
      ${p.entries.map((e, i) => `<div class="pl-i" data-act="plt" data-i="${i}"><span class="cb ${p.on.has(i) ? "on" : ""}">${p.on.has(i) ? ic("check", 15) : ""}</span><div style="min-width:0"><div class="ttl" style="font-size:14px">${esc(e.title)}</div><div class="sub">${F.fmtDur(e.duration)}</div></div></div>`).join("")}
      <button class="big" data-act="plgo">${ic("download", 22)} ${t("download_sel")}</button>`;
  }

  // ------------------------------------------------------------ color picker
  function openColorPicker() {
    const orig = S.settings.accent; let [h, s, l] = hexToHsl(orig);
    const rec = openSheet(`<h3 style="margin:2px 0 8px">${t("pick_color")}</h3><div class="prev" id="cprev">${t("app")}</div>
      <div class="sw-row">${SWATCHES.map(c => `<button class="swc ${c.toLowerCase() === orig.toLowerCase() ? "on" : ""}" data-act="swatch" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join("")}</div>
      <label class="sub">${t("hue")}</label><input class="sl" id="sl-h" type="range" min="0" max="360" value="${h}" style="background:linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)">
      <label class="sub">${t("sat")}</label><input class="sl" id="sl-s" type="range" min="0" max="100" value="${s}" style="background:linear-gradient(90deg,#888,var(--accent))">
      <label class="sub">${t("light")}</label><input class="sl" id="sl-l" type="range" min="10" max="90" value="${l}" style="background:linear-gradient(90deg,#000,#888,#fff)">
      <label class="sub">${t("hex")}</label><input class="field" id="hex" dir="ltr" maxlength="7" value="${orig}">
      <button class="big" data-act="capply">${t("apply")}</button><button class="big sec2" data-act="creset">${t("reset_yellow")}</button>`,
      { onClose() { S.settings.accent = S.pickerKeep ? S.settings.accent : orig; applyAccent(S.settings.accent); S.pickerKeep = false; render(); } });
    const set = hex => { S.settings.accent = hex; applyAccent(hex); $("#hex", rec.el).value = hex; [h, s, l] = hexToHsl(hex);
      $("#sl-h", rec.el).value = h; $("#sl-s", rec.el).value = s; $("#sl-l", rec.el).value = l;
      rec.el.querySelectorAll(".swc").forEach(b => b.classList.toggle("on", b.dataset.c.toLowerCase() === hex.toLowerCase())); };
    const fromSliders = () => { const hex = hslToHex(+$("#sl-h", rec.el).value, +$("#sl-s", rec.el).value, +$("#sl-l", rec.el).value); S.settings.accent = hex; applyAccent(hex); $("#hex", rec.el).value = hex; };
    rec.el.addEventListener("input", e => { if (/^sl-/.test(e.target.id)) fromSliders(); else if (e.target.id === "hex") { let v = e.target.value.trim(); if (v[0] !== "#") v = "#" + v; if (validHex(v)) { S.settings.accent = v.toUpperCase(); applyAccent(S.settings.accent); } } });
    rec.set = set;
  }

  // ------------------------------------------------------------ actions
  const A = {
    tab(el) { S.tab = el.dataset.v; S.editSites = false; render(); },
    async paste() { try { const r = await AMN.call("clipboard"); const tx = (r && r.text || "").trim(); if (!tx) return toast(t("clipboard_empty")); S.q = tx; const i = $("#q"); if (i) i.value = tx; submit(tx); } catch (e) { toast(t("clipboard_empty")); } },
    cat(el) { S.settings.cat = el.dataset.v; save(); S.q = ""; doSearch(qOf(el.dataset.v)); },
    retry() { doSearch(S.lastQ || qOf(S.settings.cat)); },
    open(el) { const e = S.results[+el.dataset.i]; if (e) AMN.call("openBrowser", { url: e.url }).catch(() => toast(t("open_failed"))); },
    dl(el, ev) { ev.stopPropagation(); const e = S.results[+el.dataset.i]; if (e) showFormats(e.url); },
    site(el) { const s = S.settings.shortcuts[+el.dataset.i]; if (s) AMN.call("openBrowser", { url: s.url }).catch(() => toast(t("open_failed"))); },
    sedit() { S.editSites = !S.editSites; render(); },
    sdel(el) { S.settings.shortcuts.splice(+el.dataset.i, 1); save(); render(); },
    smv(el) { const i = +el.dataset.i, d = +el.dataset.d, a = S.settings.shortcuts, j = i + (S.lang === "ar" ? -d : d); if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; save(); render(); },
    sadd() { const rec = openSheet(`<h3 style="margin:2px 0 12px">${t("add_site")}</h3><input class="field" id="sn" placeholder="${esc(t("site_name"))}"><input class="field" id="su" dir="ltr" inputmode="url" placeholder="${esc(t("site_url"))}"><button class="big" data-act="ssave">${t("save")}</button>`); setTimeout(() => $("#sn", rec.el).focus(), 50); },
    ssave() { const n = $("#sn").value.trim(), u = $("#su").value.trim(); if (!n || !u) return; S.settings.shortcuts.push({ id: "s" + Date.now(), name: n, url: fixUrl(u), c: SWATCHES[S.settings.shortcuts.length % SWATCHES.length] }); save(); closeSheet(true); render(); },
    libtab(el) { S.libTab = el.dataset.v; render(); },
    play(el) { AMN.call("play", { id: el.dataset.id }); }, share(el) { AMN.call("share", { id: el.dataset.id }); },
    pause(el) { AMN.call("pause", { id: el.dataset.id }); }, resume(el) { AMN.call("resume", { id: el.dataset.id }); },
    cancel(el) { AMN.call("cancel", { id: el.dataset.id }); },
    del(el) { const id = el.dataset.id; const rec = openSheet(`<h3 style="margin:2px 0 12px">${t("remove_q")}</h3><button class="opt on" data-act="rmgo" data-id="${esc(id)}" data-f="1"><span class="rd"></span><span class="lb">${t("remove_file")}</span></button><button class="big sec2" data-act="rmgo" data-id="${esc(id)}" data-f="0">${t("delete")}</button>`); },
    rmgo(el) { AMN.call("remove", { id: el.dataset.id, deleteFile: el.dataset.f === "1" }); closeSheet(true); },
    tog(el) { const k = el.dataset.k; setK(S.settings, k, !getK(S.settings, k)); save(); render(); },
    async chlang() { const v = await choose(t("pick_lang"), [{ v: "ar", l: "العربية" }, { v: "en", l: "English" }], S.lang); if (v) { S.settings.lang = v; S.lang = v; save(); applyAll(); render(); } },
    async chtheme() { const v = await choose(t("pick_theme"), ["auto", "light", "dark", "amoled"].map(x => ({ v: x, l: t("theme_" + x) })), S.settings.theme); if (v) { S.settings.theme = v; save(); applyAll(); render(); } },
    async chquality() { const v = await choose(t("pick_quality"), [{ v: "ask", l: t("ask_every_time") }, ...["1080", "720", "480", "360"].map(x => ({ v: x, l: x + "p" }))], S.settings.quality); if (v) { S.settings.quality = v; save(); render(); } },
    async chaudio() { const v = await choose(t("pick_audio"), [{ v: "mp3", l: "MP3" }, { v: "m4a", l: "M4A" }], S.settings.audio); if (v) { S.settings.audio = v; save(); render(); } },
    async chparallel() { const v = await choose(t("set_parallel"), [1, 2, 3, 4, 5].map(x => ({ v: String(x), l: String(x) })), String(S.settings.parallel)); if (v) { S.settings.parallel = +v; save(); render(); } },
    chcolor() { openColorPicker(); },
    swatch(el) { const rec = topSheet(); rec.set(el.dataset.c); },
    capply() { S.pickerKeep = true; save(); closeSheet(); },
    creset() { topSheet().set("#FFC400"); },
    async upd() { toast(t("updating")); try { const r = await AMN.call("updateEngine"); toast((r && r.message) || t("app_updated")); const st = await AMN.call("getState"); S.engine = st.engine || S.engine; render(); } catch (e) { toast(cleanErr(e)); } },
    opt(el) { S.cur.sel = +el.dataset.i; drawFormats(topSheet().el.querySelector(".sheet")); },
    async startdl() { const c = S.cur; if (!c || !c.info || c.sel < 0) return; const o = c.info.options[c.sel];
      closeSheet(true);
      await startDownload({ url: c.url, title: c.info.title, thumb: c.info.thumbnail, duration: c.info.duration, kind: o.type, height: o.height, audioFmt: o.fmt || "", size: o.size || 0 });
      if (c.fromBrowser) AMN.call("showBrowser").catch(() => {}); },
    plq(el) { S.cur.pl.q = el.dataset.v; drawPlaylist(topSheet().el.querySelector(".sheet")); },
    plall() { const p = S.cur.pl; p.on = p.on.size === p.entries.length ? new Set() : new Set(p.entries.map((_, i) => i)); drawPlaylist(topSheet().el.querySelector(".sheet")); },
    plt(el) { const p = S.cur.pl, i = +el.dataset.i; p.on.has(i) ? p.on.delete(i) : p.on.add(i); drawPlaylist(topSheet().el.querySelector(".sheet")); },
    async plgo() { const p = S.cur.pl, audio = p.q === "mp3"; closeSheet(true);
      for (const i of [...p.on].sort((a, b) => a - b)) { const e = p.entries[i];
        await AMN.call("download", { url: e.url, title: e.title, thumb: thumbOf(e), duration: e.duration || 0, kind: audio ? "audio" : "video", height: audio ? 0 : +p.q, audioFmt: audio ? "mp3" : "", size: 0 }).catch(() => {}); }
      toast(t("added")); },
    none() {}
  };
  document.addEventListener("click", e => { const el = e.target.closest("[data-act]"); if (el && A[el.dataset.act]) A[el.dataset.act](el, e); });
  document.addEventListener("submit", e => { if (e.target.id === "qform") { e.preventDefault(); const v = $("#q").value.trim(); S.q = v; if (v) submit(v); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

  function submit(v) { if (isUrl(v) && !/\s/.test(v)) showFormats(fixUrl(v)); else doSearch(v); }
  async function doSearch(q) {
    S.lastQ = q; S.loading = true; S.err = ""; render();
    try { const r = await AMN.call("search", { q, n: 12 }); S.results = (r && r.entries || []).filter(e => e && e.title); }
    catch (e) { S.err = cleanErr(e); S.results = []; }
    S.loading = false; if (S.tab === "home") render();
  }

  // back button (Android) -> returns true when the UI handled it
  window.AMN.onBack = function () { if (closeSheet()) return true; if (S.tab !== "home") { S.tab = "home"; render(); return true; } return false; };

  AMN.on("downloads", list => { S.downloads = Array.isArray(list) ? list : []; if (S.tab === "library") { if (!S.sheets.length) render(); } else setupNav(); });
  AMN.on("shared", url => { if (typeof url === "string" && url) { S.tab = "home"; render(); showFormats(url); } });
  AMN.on("videoPicked", d => { if (d && d.pageUrl) showFormats(d.pageUrl, { fromBrowser: true, alt: d.mediaUrl }); });
  AMN.on("engine", e => { S.engine = e || S.engine; if (S.tab === "home" || S.tab === "settings") render(); });

  async function boot() {
    let st = {};
    try { st = await AMN.call("getState") || {}; } catch (e) { /* browser preview */ }
    S.settings = merge(DEFAULTS, st.settings || {}); S.downloads = st.downloads || []; S.engine = st.engine || {}; S.night = !!st.night; S.version = st.version || "";
    S.locale = st.locale || navigator.language || "en"; S.lang = S.settings.lang || (/^ar/i.test(S.locale) ? "ar" : "en");
    applyAll(); render();
    if (st.shared) showFormats(st.shared); else doSearch(qOf(S.settings.cat));
  }
  window.AMT = { S, t, showFormats, hslToHex, hexToHsl, applyAll, render };   // handy for tests / debugging
  boot();
})();
