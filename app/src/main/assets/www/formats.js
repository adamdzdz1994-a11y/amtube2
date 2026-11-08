/* Turns yt-dlp's info (formats list) into the quality list shown in the download sheet.
   One row per resolution with its size (video + best audio when they are separate files), plus MP3 and M4A rows. */
(function (root) {
  const MP3_KBPS = 192;
  const has = (f, k) => f[k] != null && f[k] !== "none";
  function size(f, dur) {
    const s = f.filesize || f.filesize_approx;
    if (s) return { bytes: Math.round(s), approx: !f.filesize };
    const tbr = f.tbr || ((f.vbr || 0) + (f.abr || 0));
    if (tbr && dur) return { bytes: Math.round(tbr * 1000 / 8 * dur), approx: true };
    return { bytes: null, approx: true };
  }
  const vScore = f => [/^avc/.test(f.vcodec || "") ? 1 : 0, f.tbr || 0, f.fps || 0];
  const aScore = f => [/^mp4a/.test(f.acodec || "") ? 1 : 0, f.abr || f.tbr || 0];
  const cmp = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] - b[i]; } return 0; };
  const best = (arr, score) => arr.reduce((m, f) => (m === null || cmp(score(f), score(m)) > 0) ? f : m, null);
  function tag(h) { return h >= 4320 ? "8K" : h >= 2160 ? "4K" : h >= 1440 ? "2K" : h >= 1080 ? "Full HD" : h >= 720 ? "HD" : ""; }

  function build(info, opts) {
    const ffmpeg = !(opts && opts.ffmpeg === false);
    const dur = info.duration;
    const fmts = (info.formats || []).filter(f => f.format_note !== "storyboard" && f.ext !== "mhtml" &&
      !(f.vcodec === "none" && f.acodec === "none"));
    const video = fmts.filter(f => has(f, "vcodec") && (f.height || 0) > 0);
    const audioOnly = fmts.filter(f => !has(f, "vcodec") && has(f, "acodec"));
    const bestAudio = best(audioOnly, aScore);
    const byH = {};
    video.forEach(f => { (byH[f.height] = byH[f.height] || []).push(f); });
    const out = [];
    Object.keys(byH).map(Number).sort((a, b) => b - a).forEach(h => {
      const g = byH[h];
      const prog = g.filter(f => has(f, "acodec"));
      const vo = g.filter(f => !has(f, "acodec"));
      let sz, fps, merged = false;
      if (vo.length && bestAudio && ffmpeg) {
        const v = best(vo, vScore), vs = size(v, dur), as = size(bestAudio, dur);
        sz = { bytes: (vs.bytes != null && as.bytes != null) ? vs.bytes + as.bytes : null, approx: vs.approx || as.approx };
        fps = v.fps; merged = true;
      } else if (prog.length) {
        const v = best(prog, vScore); sz = size(v, dur); fps = v.fps;
      } else return;
      out.push({ id: "v" + h, type: "video", height: h, label: h + "p" + (fps && fps > 30 ? Math.round(fps) : ""),
        tag: tag(h), size: sz.bytes, approx: sz.approx, merged });
    });
    const audioSize = (kbps) => dur ? Math.round(dur * kbps * 1000 / 8) : null;
    if (video.length || audioOnly.length || fmts.length) {
      const m4a = audioOnly.filter(f => f.ext === "m4a");
      const m4aBest = best(m4a.length ? m4a : audioOnly, aScore);
      out.push({ id: "mp3", type: "audio", fmt: "mp3", height: 0, label: "MP3", tag: MP3_KBPS + " kbps",
        size: audioSize(MP3_KBPS), approx: true, needsFfmpeg: true, available: ffmpeg });
      out.push({ id: "m4a", type: "audio", fmt: "m4a", height: 0, label: "M4A", tag: m4aBest && m4aBest.abr ? Math.round(m4aBest.abr) + " kbps" : "AAC",
        size: m4aBest ? size(m4aBest, dur).bytes : null, approx: !(m4aBest && m4aBest.filesize), needsFfmpeg: false, available: true });
    }
    return { title: info.title || "", duration: dur || 0, thumbnail: info.thumbnail || "", uploader: info.uploader || "",
      url: info.webpage_url || info.original_url || "", options: out };
  }

  function fmtSize(n, approx) {
    if (n == null || n <= 0) return "—";
    const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0, v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (approx ? "~" : "") + (i < 2 ? Math.round(v) : (v >= 100 && i === 2 ? v.toFixed(0) : v.toFixed(1))) + " " + u[i];
  }
  function fmtDur(s) {
    if (!s) return ""; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    const p = n => String(n).padStart(2, "0");
    return h ? `${h}:${p(m)}:${p(x)}` : `${m}:${p(x)}`;
  }
  root.AMFormats = { build, fmtSize, fmtDur, MP3_KBPS };
  if (typeof module !== "undefined") module.exports = root.AMFormats;
})(typeof window !== "undefined" ? window : globalThis);
