/* Link between the web UI and the Android code. On the phone, NativeBridge is injected by MainActivity.
   In a normal browser (development / tests) dev/mock.js stands in for it. */
(function () {
  const pending = {}; let seq = 0; const handlers = {};
  const real = () => (typeof window.NativeBridge !== "undefined") ? window.NativeBridge : null;
  window.AMN = {
    call(method, args) {
      return new Promise((resolve, reject) => {
        const id = "c" + (++seq);
        pending[id] = { resolve, reject };
        const b = real();
        if (b) b.call(id, method, JSON.stringify(args || {}));
        else if (window.AMMock) window.AMMock.call(id, method, args || {});
        else reject(new Error("no native bridge"));
      });
    },
    _res(id, ok, payload) {                 // called by Android (evaluateJavascript) with a JSON string
      const p = pending[id]; if (!p) return; delete pending[id];
      if (!ok) return p.reject(new Error(payload));
      try { p.resolve(payload === "" || payload == null ? null : JSON.parse(payload)); } catch (e) { p.resolve(payload); }
    },
    on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); },
    emit(evt, data) {                       // events pushed from Android: downloads, shared, videoPicked...
      (handlers[evt] || []).forEach(fn => { try { fn(typeof data === "string" ? safe(data) : data); } catch (e) { console.error(e); } });
    }
  };
  function safe(s) { try { return JSON.parse(s); } catch (e) { return s; } }
})();
