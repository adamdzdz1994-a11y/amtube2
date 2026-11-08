import json, os, unittest
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
AD = os.path.join(ROOT, "app/src/main/assets/adblock")
YT = open(os.path.join(AD, "ytblock.js"), encoding="utf-8").read()
PILL = open(os.path.join(AD, "pill.js"), encoding="utf-8").read()

# A stand-in for a YouTube watch page: an inline player response that contains ads, a player with an ad playing,
# a Skip button and an ad banner. (The real site cannot be reached from here, so this tests the logic, not YouTube itself.)
PAGE = """<!doctype html><html><head><title>t</title></head><body style="margin:0">
<div id="movie_player" class="html5-video-player ad-showing"><video class="html5-main-video" width="320" height="180" muted></video>
<button class="ytp-ad-skip-button" id="skip">Skip</button></div>
<ytd-ad-slot-renderer id="banner">AD</ytd-ad-slot-renderer><div id="content">content</div>
<script>window.skipped=0;document.getElementById('skip').addEventListener('click',()=>window.skipped++);
var ytInitialPlayerResponse = {videoDetails:{title:'x'}, streamingData:{}, adPlacements:[1], playerAds:[2], adSlots:[3]};
window.parsed = JSON.parse('{"videoDetails":{},"streamingData":{},"adPlacements":[1],"other":5}');
window.keep = JSON.parse('{"adPlacements":[1],"unrelated":true}');
</script></body></html>"""


class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start(); cls.br = cls.pw.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.br.close(); cls.pw.stop()

    def run_page(self, cfg, html=PAGE, host_override=True):
        pg = self.br.new_page()
        self.addCleanup(pg.close)
        pg.route("**/*", lambda r: r.fulfill(body=html, content_type="text/html"))
        pre = "window.__AMT=%s;window.__AMT_FORCE=true;" % json.dumps(cfg)
        pg.add_init_script(pre + YT)                                 # document-start, like the app does
        pg.goto("https://www.youtube.com/watch?v=x")
        return pg

    def test_all_on(self):
        pg = self.run_page({"yt": True, "prune": True, "css": True, "skip": True})
        pg.wait_for_timeout(900)
        self.assertEqual(pg.evaluate("Object.keys(ytInitialPlayerResponse).sort().join()"), "streamingData,videoDetails")   # ads removed from the first response
        self.assertEqual(pg.evaluate("Object.keys(parsed).sort().join()"), "other,streamingData,videoDetails")             # ... and from later JSON
        self.assertTrue(pg.evaluate("'adPlacements' in keep"))                                                           # unrelated JSON is left alone
        self.assertEqual(pg.evaluate("getComputedStyle(document.getElementById('banner')).display"), "none")
        self.assertGreaterEqual(pg.evaluate("skipped"), 1)                                                               # Skip was pressed
        self.assertEqual(pg.evaluate("getComputedStyle(document.getElementById('content')).display"), "block")

    def test_each_part_can_be_switched_off(self):
        pg = self.run_page({"yt": True, "prune": False, "css": True, "skip": False})
        pg.wait_for_timeout(700)
        self.assertIn("adPlacements", pg.evaluate("Object.keys(ytInitialPlayerResponse).join()"))
        self.assertEqual(pg.evaluate("skipped"), 0)
        self.assertEqual(pg.evaluate("getComputedStyle(document.getElementById('banner')).display"), "none")
        pg = self.run_page({"yt": True, "prune": True, "css": False, "skip": False})
        pg.wait_for_timeout(500)
        self.assertNotIn("adPlacements", pg.evaluate("Object.keys(ytInitialPlayerResponse).join()"))
        self.assertNotEqual(pg.evaluate("getComputedStyle(document.getElementById('banner')).display"), "none")

    def test_master_switch_off_does_nothing(self):
        pg = self.run_page({"yt": False, "prune": True, "css": True, "skip": True})
        pg.wait_for_timeout(700)
        self.assertIn("adPlacements", pg.evaluate("Object.keys(ytInitialPlayerResponse).join()"))
        self.assertEqual(pg.evaluate("skipped"), 0)
        self.assertFalse(pg.evaluate("!!window.__amtYt"))

    def test_only_runs_on_youtube(self):
        pg = self.br.new_page(); self.addCleanup(pg.close)
        pg.route("**/*", lambda r: r.fulfill(body=PAGE, content_type="text/html"))
        pg.add_init_script("window.__AMT={yt:true,prune:true,css:true,skip:true};" + YT)
        pg.goto("https://example.org/page")
        pg.wait_for_timeout(500)
        self.assertIn("adPlacements", pg.evaluate("Object.keys(ytInitialPlayerResponse).join()"))

    def test_ad_is_fast_forwarded_and_sound_restored(self):
        html = PAGE.replace("<video", "<video id='vv'")
        pg = self.run_page({"yt": True, "prune": False, "css": False, "skip": True}, html)
        pg.evaluate("""() => { const v=document.getElementById('vv'); Object.defineProperty(v,'duration',{value:30,configurable:true}); v.muted=false; window.ct=[]; }""")
        pg.wait_for_timeout(800)
        self.assertGreater(pg.evaluate("document.getElementById('vv').playbackRate"), 2)
        pg.evaluate("document.getElementById('movie_player').classList.remove('ad-showing')")
        pg.wait_for_timeout(700)
        self.assertEqual(pg.evaluate("document.getElementById('vv').playbackRate"), 1)
        self.assertFalse(pg.evaluate("document.getElementById('vv').muted"))

    def test_pill_sits_on_the_video_corner_and_reports_the_page(self):
        html = "<!doctype html><body style='margin:0'><video width=320 height=200 style='display:block;margin:40px 20px'></video></body>"
        pg = self.br.new_page(viewport={"width": 400, "height": 700}); self.addCleanup(pg.close)
        pg.route("**/*", lambda r: r.fulfill(body=html, content_type="text/html"))
        pg.add_init_script("window.__calls=[];window.AMPage={onVideo:(a,b)=>window.__calls.push([a,b])};window.__AMT={accent:'#00AA55',onAccent:'#fff'};")
        pg.goto("https://example.org/video/1")
        pg.add_script_tag(content=PILL)
        pg.wait_for_selector("[data-amt=pill] >> button.on", timeout=3000)
        b = pg.locator("[data-amt=pill] >> button").bounding_box(); v = pg.locator("video").bounding_box()
        self.assertTrue(v["x"] + v["width"] - 70 <= b["x"] <= v["x"] + v["width"], (b, v))
        self.assertTrue(v["y"] + v["height"] - 70 <= b["y"] <= v["y"] + v["height"], (b, v))
        self.assertEqual(pg.evaluate("getComputedStyle(document.querySelector('[data-amt=pill]').shadowRoot.querySelector('button')).backgroundColor"), "rgb(0, 170, 85)")
        pg.locator("[data-amt=pill] >> button").click()
        self.assertEqual(pg.evaluate("__calls")[0][0], "https://example.org/video/1")
        pg.evaluate("document.querySelector('video').remove()")
        pg.wait_for_timeout(800)
        self.assertEqual(pg.locator("[data-amt=pill] >> button.on").count(), 0)          # video gone -> button gone

    def test_pill_ignores_tiny_videos(self):
        pg = self.br.new_page(); self.addCleanup(pg.close)
        pg.route("**/*", lambda r: r.fulfill(body="<video width=100 height=60></video>", content_type="text/html"))
        pg.goto("https://example.org/"); pg.add_script_tag(content=PILL); pg.wait_for_timeout(900)
        self.assertEqual(pg.locator("[data-amt=pill]").count(), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
