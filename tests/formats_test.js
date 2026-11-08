const F = require("../app/src/main/assets/www/formats.js");
const assert = require("assert");
const info = { title: "Test Video", duration: 100, formats: [
  { format_id: "sb0", format_note: "storyboard", ext: "mhtml", vcodec: "none", acodec: "none" },
  { format_id: "140", ext: "m4a", vcodec: "none", acodec: "mp4a.40.2", abr: 128, filesize: 1600000 },
  { format_id: "251", ext: "webm", vcodec: "none", acodec: "opus", abr: 160, filesize: 1500000 },
  { format_id: "313", ext: "webm", vcodec: "vp9", acodec: "none", height: 2160, fps: 60, filesize: 150000000 },
  { format_id: "137", ext: "mp4", vcodec: "avc1.640028", acodec: "none", height: 1080, fps: 30, filesize: 40000000, tbr: 3000 },
  { format_id: "248", ext: "webm", vcodec: "vp9", acodec: "none", height: 1080, fps: 30, filesize: 30000000, tbr: 2000 },
  { format_id: "136", ext: "mp4", vcodec: "avc1.4d401f", acodec: "none", height: 720, fps: 30, filesize: 20000000 },
  { format_id: "135", ext: "mp4", vcodec: "avc1.4d401e", acodec: "none", height: 480, fps: 30, filesize_approx: 10000000 },
  { format_id: "18", ext: "mp4", vcodec: "avc1.42001E", acodec: "mp4a.40.2", height: 360, fps: 30, filesize: 8000000 },
  { format_id: "17", ext: "mp4", vcodec: "avc1", acodec: "mp4a", height: 240, tbr: 300 } ] };
const r = F.build(info, { ffmpeg: true });
const o = Object.fromEntries(r.options.map(x => [x.id, x]));
assert.deepStrictEqual(r.options.map(x => x.label), ["2160p60", "1080p", "720p", "480p", "360p", "240p", "MP3", "M4A"]);
assert.strictEqual(o.v1080.size, 41600000);          // best avc1 video + best (m4a) audio
assert.strictEqual(o.v720.size, 21600000);
assert.ok(o.v480.approx);
assert.strictEqual(o.v360.size, 8000000); assert.ok(!o.v360.merged);
assert.strictEqual(o.v240.size, 3750000);
assert.strictEqual(o.mp3.size, 2400000);
assert.strictEqual(o.m4a.size, 1600000);
assert.strictEqual(o.v2160.tag, "4K"); assert.strictEqual(o.v1080.tag, "Full HD"); assert.strictEqual(o.v720.tag, "HD");
const nf = F.build(info, { ffmpeg: false });
assert.deepStrictEqual(nf.options.map(x => x.label), ["360p", "240p", "MP3", "M4A"]);
assert.strictEqual(nf.options.find(x => x.id === "mp3").available, false);
assert.strictEqual(F.fmtSize(41600000, false), "39.7 MB"); assert.strictEqual(F.fmtSize(1005530), "982 KB");
assert.strictEqual(F.fmtSize(null), "—"); assert.strictEqual(F.fmtDur(3725), "1:02:05"); assert.strictEqual(F.fmtDur(75), "1:15");
console.log("formats OK");
