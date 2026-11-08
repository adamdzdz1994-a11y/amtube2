/* Stand-in for the Android code so the UI can be opened and tested in an ordinary browser. Not used on the phone. */
(function () {
  if (typeof window.NativeBridge !== "undefined") return;
  const store = JSON.parse(localStorage.getItem("amt_mock") || "{}");
  const save = () => localStorage.setItem("amt_mock", JSON.stringify(store));
  store.settings = store.settings || {}; store.downloads = store.downloads || [];
  const INFO = { title: "Sample video title", duration: 100, uploader: "Sample channel", thumbnail: "", formats: [
    { format_id: "140", ext: "m4a", vcodec: "none", acodec: "mp4a.40.2", abr: 128, filesize: 1600000 },
    { format_id: "313", ext: "webm", vcodec: "vp9", acodec: "none", height: 2160, fps: 30, filesize: 150000000 },
    { format_id: "137", ext: "mp4", vcodec: "avc1.640028", acodec: "none", height: 1080, fps: 30, filesize: 40000000 },
    { format_id: "136", ext: "mp4", vcodec: "avc1.4d401f", acodec: "none", height: 720, fps: 30, filesize: 20000000 },
    { format_id: "135", ext: "mp4", vcodec: "avc1.4d401e", acodec: "none", height: 480, fps: 30, filesize_approx: 10000000 },
    { format_id: "18", ext: "mp4", vcodec: "avc1.42001E", acodec: "mp4a.40.2", height: 360, fps: 30, filesize: 8000000 } ] };
  const entries = n => Array.from({ length: n }, (_, i) => ({ id: "vid" + i, title: "Result video " + (i + 1), uploader: "Channel " + (i % 3 + 1),
    duration: 120 + i * 37, url: "https://www.youtube.com/watch?v=vid" + i, thumbnail: "" }));
  window.AMMock = {
    log: [], delay: 30, failInfo: false,
    call(id, method, a) {
      this.log.push([method, a]);
      const done = (v) => setTimeout(() => window.AMN._res(id, true, JSON.stringify(v == null ? null : v)), this.delay);
      const fail = (m) => setTimeout(() => window.AMN._res(id, false, m), this.delay);
      switch (method) {
        case "getState": return done({ settings: store.settings, downloads: store.downloads, night: !!window.__night, locale: window.__locale || "en",
          engine: { ready: true, ytdlp: "2026.10.26", ffmpeg: true, js: true }, version: "1.0.0" });
        case "setSettings": store.settings = a; save(); return done(true);
        case "info": return this.failInfo ? fail("ERROR: Unsupported URL") : (/list=|playlist/.test(a.url)
          ? done({ _type: "playlist", title: "Sample playlist", entries: entries(4) }) : done(Object.assign({ webpage_url: a.url }, INFO)));
        case "search": return done({ entries: entries(a.n || 8) });
        case "download": { const d = Object.assign({ id: "d" + Date.now() + Math.floor(Math.random() * 99), state: "running", progress: 0.35, speed: 1500000, eta: 30, added: Date.now() }, a);
          store.downloads.unshift(d); save(); window.AMN.emit("downloads", store.downloads); return done({ id: d.id }); }
        case "downloads": return done(store.downloads);
        case "pause": case "resume": case "cancel": { const d = store.downloads.find(x => x.id === a.id); if (d) d.state = method === "pause" ? "paused" : method === "resume" ? "running" : "failed"; save(); window.AMN.emit("downloads", store.downloads); return done(true); }
        case "remove": store.downloads = store.downloads.filter(x => x.id !== a.id); save(); window.AMN.emit("downloads", store.downloads); return done(true);
        case "clipboard": return done({ text: window.__clip || "" });
        case "updateEngine": return done({ message: "yt-dlp is up to date" });
        default: return done(true);
      }
    }
  };
})();
