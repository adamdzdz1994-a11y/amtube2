import json, os, re, unittest
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WWW = os.path.join(ROOT, "app/src/main/assets/www")
URL = "file://" + os.path.join(WWW, "index.html")
BANNED_EN = ["clean", "battery", "boost", "uninstall", "whatsapp", "toolbar", "junk", "optimi"]
BANNED_AR = ["تنظيف", "موفر البطارية", "تعزيز", "إلغاء تثبيت", "واتساب", "شريط الأدوات", "تنظف"]


class UI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.br = cls.pw.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.br.close(); cls.pw.stop()

    def page(self, locale="en", night=False, clip="", fresh=True):
        ctx = self.br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale=locale)
        self.addCleanup(ctx.close)
        pg = ctx.new_page()
        self.errors = []
        pg.on("pageerror", lambda e: self.errors.append(str(e)))
        pg.add_init_script("window.__locale=%s;window.__night=%s;window.__clip=%s;" % (json.dumps(locale), "true" if night else "false", json.dumps(clip)))
        pg.goto(URL)
        pg.wait_for_selector(".card, .empty, .spin", timeout=5000)
        pg.wait_for_selector(".card", timeout=5000)
        return pg

    def css(self, pg, var):
        return pg.evaluate("v => getComputedStyle(document.documentElement).getPropertyValue(v).trim()", var)

    def tab(self, pg, name):
        pg.click("#nav button[data-v=%s]" % name)

    # ------------------------------------------------------------------ tests
    def test_home_loads_with_results_and_no_js_errors(self):
        pg = self.page()
        self.assertGreaterEqual(pg.locator(".card").count(), 8)
        self.assertEqual(pg.locator("#nav button").count(), 4)
        self.assertEqual(self.css(pg, "--accent").upper(), "#FFC400")          # default yellow
        self.assertEqual(self.errors, [])

    def test_accent_colour_is_editable_and_remembered(self):
        pg = self.page()
        self.tab(pg, "settings")
        pg.click("[data-act=chcolor]")
        pg.click(".swc[data-c='#9B5CFF']")
        self.assertEqual(self.css(pg, "--accent").upper(), "#9B5CFF")
        self.assertEqual(self.css(pg, "--on-accent"), "#ffffff")               # dark text would be unreadable on violet
        pg.click("[data-act=capply]")
        self.assertEqual(self.css(pg, "--accent").upper(), "#9B5CFF")
        pg.reload(); pg.wait_for_selector(".card")
        self.assertEqual(self.css(pg, "--accent").upper(), "#9B5CFF")          # survives restart
        # custom hex
        self.tab(pg, "settings"); pg.click("[data-act=chcolor]")
        pg.fill("#hex", "#00aa55")
        self.assertEqual(self.css(pg, "--accent").upper(), "#00AA55")
        pg.click("[data-act=capply]")
        # slider changes the colour too
        self.tab(pg, "settings"); pg.click("[data-act=chcolor]")
        pg.eval_on_selector("#sl-h", "e => { e.value = 200; e.dispatchEvent(new Event('input', {bubbles:true})); }")
        self.assertNotEqual(self.css(pg, "--accent").upper(), "#00AA55")
        # closing without Apply puts the old colour back
        pg.keyboard.press("Escape")
        self.assertEqual(self.css(pg, "--accent").upper(), "#00AA55")
        # reset to yellow
        self.tab(pg, "settings"); pg.click("[data-act=chcolor]"); pg.click("[data-act=creset]"); pg.click("[data-act=capply]")
        self.assertEqual(self.css(pg, "--accent").upper(), "#FFC400")
        self.assertEqual(self.errors, [])

    def test_all_icons_follow_the_accent(self):
        pg = self.page()
        self.tab(pg, "settings"); pg.click("[data-act=chcolor]"); pg.click(".swc[data-c='#00C2B8']"); pg.click("[data-act=capply]")
        fill = pg.evaluate("() => getComputedStyle(document.querySelector('#nav .ic .ac')).fill")
        self.assertEqual(fill, "rgb(0, 194, 184)")

    def test_arabic_switches_to_rtl_and_is_remembered(self):
        pg = self.page()
        self.tab(pg, "settings"); pg.click("[data-act=chlang]"); pg.click("[data-act=pick][data-v=ar]")
        self.assertEqual(pg.evaluate("document.documentElement.dir"), "rtl")
        self.assertIn("الإعدادات", pg.inner_text("#nav"))
        pg.reload(); pg.wait_for_selector(".card")
        self.assertEqual(pg.evaluate("document.documentElement.dir"), "rtl")
        self.assertIn("الرئيسية", pg.inner_text("#nav"))

    def test_arabic_phone_starts_in_arabic(self):
        pg = self.page(locale="ar")
        self.assertEqual(pg.evaluate("document.documentElement.lang"), "ar")

    def test_themes(self):
        pg = self.page()
        self.tab(pg, "settings"); pg.click("[data-act=chtheme]"); pg.click("[data-act=pick][data-v=dark]")
        self.assertEqual(pg.evaluate("document.documentElement.dataset.theme"), "dark")
        self.tab(pg, "settings"); pg.click("[data-act=chtheme]"); pg.click("[data-act=pick][data-v=amoled]")
        self.assertEqual(self.css(pg, "--bg"), "#000")
        pg2 = self.page(night=True)                                             # automatic follows the phone
        self.assertEqual(pg2.evaluate("document.documentElement.dataset.theme"), "dark")

    def test_paste_link_shows_qualities_with_sizes_and_audio_then_downloads(self):
        pg = self.page(clip="https://example.com/watch?v=abc")
        pg.click("[data-act=paste]")
        pg.wait_for_selector(".opt[data-act=opt]")
        labels = pg.eval_on_selector_all(".opt .lb", "els => els.map(e => e.textContent)")
        self.assertEqual(labels, ["2160p", "1080p", "720p", "480p", "360p", "MP3", "M4A"])
        sizes = dict(zip(labels, pg.eval_on_selector_all(".opt .sz", "els => els.map(e => e.textContent)")))
        self.assertEqual(sizes["1080p"], "39.7 MB"); self.assertEqual(sizes["MP3"], "~2.3 MB"); self.assertTrue(sizes["480p"].startswith("~"))
        self.assertIn("4K", pg.inner_text(".opt:nth-of-type(1)"))
        pg.click(".opt:has-text('720p')")
        pg.click("[data-act=startdl]")
        log = pg.evaluate("AMMock.log.filter(x => x[0] === 'download').map(x => x[1])")
        self.assertEqual(len(log), 1)
        d = log[0]
        self.assertEqual((d["kind"], d["height"], d["url"]), ("video", 720, "https://example.com/watch?v=abc"))
        self.assertEqual(d["size"], 21600000)
        self.assertIn("1", pg.inner_text("#nav .bdg"))                          # one active download in the badge
        self.assertEqual(self.errors, [])

    def test_mp3_download_request(self):
        pg = self.page(clip="https://example.com/watch?v=abc")
        pg.click("[data-act=paste]"); pg.wait_for_selector(".opt[data-act=opt]")
        pg.click(".opt:has-text('MP3')"); pg.click("[data-act=startdl]")
        d = pg.evaluate("AMMock.log.filter(x => x[0] === 'download')[0][1]")
        self.assertEqual((d["kind"], d["audioFmt"], d["height"]), ("audio", "mp3", 0))

    def test_default_quality_setting_preselects(self):
        pg = self.page(clip="https://example.com/watch?v=abc")
        self.tab(pg, "settings"); pg.click("[data-act=chquality]"); pg.click("[data-act=pick][data-v='480']")
        self.tab(pg, "home"); pg.click("[data-act=paste]"); pg.wait_for_selector(".opt[data-act=opt]")
        self.assertIn("480p", pg.inner_text(".opt.on"))

    def test_playlist_batch_download(self):
        pg = self.page(clip="https://example.com/playlist?list=PL1")
        pg.click("[data-act=paste]"); pg.wait_for_selector(".pl-i")
        self.assertEqual(pg.locator(".pl-i").count(), 4)
        pg.click(".pl-i[data-i='0']"); pg.click("[data-act=plq][data-v='480']"); pg.click("[data-act=plgo]")
        pg.wait_for_timeout(300)
        ds = pg.evaluate("AMMock.log.filter(x => x[0] === 'download').map(x => x[1])")
        self.assertEqual(len(ds), 3); self.assertTrue(all(x["height"] == 480 for x in ds))

    def test_failed_lookup_shows_message(self):
        pg = self.page(clip="https://example.com/watch?v=abc")
        pg.evaluate("AMMock.failInfo = true")
        pg.click("[data-act=paste]"); pg.wait_for_selector(".empty")
        self.assertIn("Unsupported URL", pg.inner_text(".sheet"))

    def test_search_and_chips(self):
        pg = self.page()
        pg.click(".chip[data-v=gaming]"); pg.wait_for_selector(".card")
        q = pg.evaluate("AMMock.log.filter(x => x[0] === 'search').pop()[1].q")
        self.assertEqual(q, "gaming highlights")
        pg.fill("#q", "my search words"); pg.press("#q", "Enter"); pg.wait_for_selector(".card")
        self.assertEqual(pg.evaluate("AMMock.log.filter(x => x[0] === 'search').pop()[1].q"), "my search words")

    def test_library_controls(self):
        pg = self.page(clip="https://example.com/watch?v=abc")
        pg.click("[data-act=paste]"); pg.wait_for_selector(".opt[data-act=opt]"); pg.click("[data-act=startdl]") if False else None
        pg.click(".opt:has-text('360p')"); pg.click("[data-act=startdl]")
        self.tab(pg, "library"); pg.click("[data-act=libtab][data-v=active]")
        self.assertEqual(pg.locator(".item").count(), 1)
        pg.click("[data-act=pause]"); pg.wait_for_selector("[data-act=resume]")
        pg.click("[data-act=resume]"); pg.wait_for_selector("[data-act=pause]")
        pg.click("[data-act=cancel]"); pg.wait_for_selector(".item:has-text('Failed')")
        # a finished item can be played, shared and removed
        pg.evaluate("AMN.emit('downloads', [{id:'x1',title:'Done one',kind:'video',height:720,size:36400000,state:'done',progress:1},{id:'x2',title:'Song',kind:'audio',audioFmt:'mp3',size:5300000,state:'done'}])")
        pg.click("[data-act=libtab][data-v=video]")
        self.assertIn("720p · 34.7 MB", pg.inner_text(".item"))
        pg.click("[data-act=libtab][data-v=audio]"); self.assertIn("MP3", pg.inner_text(".item"))
        pg.click("[data-act=libtab][data-v=video]")
        pg.click("[data-act=play]"); pg.click("[data-act=share]")
        pg.click("[data-act=del]"); pg.click("[data-act=rmgo][data-f='1']")
        calls = pg.evaluate("AMMock.log.map(x => x[0])")
        for c in ("play", "share", "remove"):
            self.assertIn(c, calls)
        self.assertTrue(pg.evaluate("AMMock.log.filter(x => x[0]==='remove')[0][1].deleteFile"))

    def test_sites_add_move_delete(self):
        pg = self.page()
        self.tab(pg, "sites")
        n0 = pg.locator(".site:not(.add)").count(); self.assertEqual(n0, 8)
        pg.click(".site[data-i='0']")
        self.assertEqual(pg.evaluate("AMMock.log.filter(x => x[0]==='openBrowser').pop()[1].url"), "https://m.youtube.com")
        pg.click("[data-act=sadd]"); pg.fill("#sn", "My Site"); pg.fill("#su", "example.org/videos"); pg.click("[data-act=ssave]")
        self.assertEqual(pg.locator(".site:not(.add)").count(), 9)
        pg.click("[data-act=sedit]")
        pg.click("[data-act=smv][data-i='0'][data-d='1']")
        self.assertIn("Facebook", pg.inner_text(".site[data-i='0']"))
        pg.click("[data-act=sdel][data-i='8']")
        self.assertEqual(pg.locator(".site:not(.add)").count(), 8)

    def test_youtube_adblock_switches_are_adjustable(self):
        pg = self.page()
        self.tab(pg, "settings")
        self.assertEqual(pg.locator("[data-k='adblock.prune']").count(), 1)
        pg.click("[data-k='adblock.skip']")
        st = pg.evaluate("JSON.parse(localStorage.getItem('amt_mock')).settings.adblock")
        self.assertFalse(st["skip"]); self.assertTrue(st["youtube"])
        pg.click("[data-k='adblock.youtube']")                                   # master switch off
        self.assertEqual(pg.locator("[data-k='adblock.prune']").count(), 0)
        self.assertFalse(pg.evaluate("JSON.parse(localStorage.getItem('amt_mock')).settings.adblock.youtube"))
        pg.click("[data-k='adblock.web']")
        self.assertTrue(pg.evaluate("JSON.parse(localStorage.getItem('amt_mock')).settings.adblock.web"))

    def test_other_settings_persist(self):
        pg = self.page()
        self.tab(pg, "settings")
        pg.click("[data-k=wifiOnly]"); pg.click("[data-k=subs]")
        pg.click("[data-act=chparallel]"); pg.click("[data-act=pick][data-v='4']")
        pg.click("[data-act=chaudio]"); pg.click("[data-act=pick][data-v=m4a]")
        s = pg.evaluate("JSON.parse(localStorage.getItem('amt_mock')).settings")
        self.assertTrue(s["wifiOnly"]); self.assertTrue(s["subs"]); self.assertEqual(s["parallel"], 4); self.assertEqual(s["audio"], "m4a")
        pg.click("[data-act=upd]"); pg.wait_for_selector(".toast")

    def test_back_button_and_shared_link(self):
        pg = self.page()
        self.tab(pg, "settings")
        self.assertTrue(pg.evaluate("AMN.onBack()"))                            # settings -> home
        self.assertFalse(pg.evaluate("AMN.onBack()"))                           # at home: let the phone handle it
        pg.evaluate("AMN.emit('shared', 'https://example.com/watch?v=zz')")
        pg.wait_for_selector(".opt[data-act=opt]")
        self.assertTrue(pg.evaluate("AMN.onBack()")); self.assertEqual(pg.locator(".wrap").count(), 0)
        pg.evaluate("AMN.emit('videoPicked', {pageUrl:'https://example.com/watch?v=q'})")
        pg.wait_for_selector(".opt[data-act=opt]")
        pg.click(".sh-h"); pg.keyboard.press("Escape")
        self.assertEqual(pg.evaluate("AMMock.log.filter(x => x[0]==='showBrowser').length"), 1)   # back to the browser

    def test_no_forbidden_features_and_no_ads_anywhere(self):
        pg = self.page()
        texts = []
        for lang in ("en", "ar"):
            if lang == "ar":
                self.tab(pg, "settings"); pg.click("[data-act=chlang]"); pg.click("[data-act=pick][data-v=ar]")
            for tb in ("home", "sites", "library", "settings"):
                self.tab(pg, tb); texts.append(pg.inner_text("body").lower())
        blob = " ".join(texts)
        for w in BANNED_EN + [x.lower() for x in BANNED_AR]:
            self.assertNotIn(w, blob, w)
        self.assertNotIn("vip", blob); self.assertEqual(pg.locator("iframe, ins, [class*=advert]").count(), 0)
        self.assertEqual(pg.evaluate("[...document.scripts].filter(s => /^https?:/.test(s.src)).length"), 0)  # no remote scripts

    def test_every_text_key_exists_in_both_languages(self):
        src = open(os.path.join(WWW, "app.js"), encoding="utf-8").read()
        keys = set(re.findall(r"\bt\(\"([a-z_0-9]+)\"\s*[,)]", src))
        keys |= {"cat_" + c for c in ["music", "gaming", "news", "sports", "tech", "comedy", "food", "movies"]}
        keys |= {"q_" + c for c in ["music", "gaming", "news", "sports", "tech", "comedy", "food", "movies"]}
        keys |= {"theme_" + x for x in ["auto", "light", "dark", "amoled"]}
        pg = self.page()
        have = pg.evaluate("[Object.keys(AMI18N.T.en), Object.keys(AMI18N.T.ar)]")
        self.assertEqual(sorted(have[0]), sorted(have[1]))
        self.assertEqual(sorted(k for k in keys if k not in have[0]), [])
        for lang in ("en", "ar"):                                               # nothing left untranslated / empty
            vals = pg.evaluate("l => Object.values(AMI18N.T[l])", lang)
            self.assertTrue(all(isinstance(v, str) and v for v in vals))

    def test_screenshots_for_review(self):
        out = os.environ.get("AMT_SHOTS")
        if not out:
            self.skipTest("set AMT_SHOTS=dir to write screenshots")
        os.makedirs(out, exist_ok=True)
        pg = self.page(clip="https://example.com/watch?v=abc")
        pg.screenshot(path=out + "/home_light.png")
        pg.click("[data-act=paste]"); pg.wait_for_selector(".opt[data-act=opt]"); pg.click(".opt:has-text('720p')"); pg.screenshot(path=out + "/sheet.png")
        pg.click("[data-act=startdl]")
        pg.evaluate("AMN.emit('downloads', [{id:'a',title:'Sample video being downloaded',kind:'video',height:1080,size:58200000,state:'running',progress:.62,speed:2400000},{id:'b',title:'Sample song',kind:'audio',audioFmt:'mp3',state:'running',progress:-1},{id:'c',title:'A finished clip',kind:'video',height:720,size:36400000,state:'done'}])")
        self.tab(pg, "library"); pg.click("[data-act=libtab][data-v=active]"); pg.screenshot(path=out + "/library_active.png")
        pg.click("[data-act=libtab][data-v=video]"); pg.screenshot(path=out + "/library_done.png")
        self.tab(pg, "sites"); pg.screenshot(path=out + "/sites.png")
        self.tab(pg, "settings"); pg.screenshot(path=out + "/settings.png")
        pg.click("[data-act=chcolor]"); pg.screenshot(path=out + "/color_picker.png"); pg.click(".swc[data-c='#4C6FFF']"); pg.screenshot(path=out + "/color_blue.png"); pg.click("[data-act=capply]")
        pg.click("[data-act=chtheme]"); pg.click("[data-act=pick][data-v=dark]"); self.tab(pg, "home"); pg.screenshot(path=out + "/home_dark_blue.png")
        pg.click("[data-act=paste]"); pg.wait_for_selector(".opt[data-act=opt]"); pg.screenshot(path=out + "/sheet_dark_blue.png"); pg.keyboard.press("Escape")
        self.tab(pg, "settings"); pg.click("[data-act=chlang]"); pg.click("[data-act=pick][data-v=ar]"); pg.screenshot(path=out + "/settings_ar.png")
        self.tab(pg, "home"); pg.screenshot(path=out + "/home_ar.png")


if __name__ == "__main__":
    unittest.main(verbosity=2)
