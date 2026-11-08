"""Checks that do not need the Android toolchain (which is not available where this was written):
XML validity, resource references, bracket balance in Kotlin, JS<->Kotlin consistency, forbidden features, icon files."""
import glob, json, os, re, unittest
import xml.etree.ElementTree as ET

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MAIN = os.path.join(ROOT, "app/src/main")
KT = sorted(glob.glob(MAIN + "/java/com/amtube/app/*.kt"))
RES = MAIN + "/res"


def read(p):
    return open(p, encoding="utf-8").read()


def strip_kotlin(src):
    """Remove comments, string and char literals so brackets can be counted."""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if src.startswith("//", i):
            while i < n and src[i] != "\n": i += 1
        elif src.startswith("/*", i):
            j = src.find("*/", i + 2); i = n if j < 0 else j + 2
        elif src.startswith('"""', i):
            j = src.find('"""', i + 3); i = n if j < 0 else j + 3
        elif c == '"':
            i += 1
            while i < n and src[i] != '"':
                if src[i] == "\\": i += 1
                elif src.startswith("${", i):                      # keep template expressions balanced
                    depth, i = 1, i + 2
                    while i < n and depth:
                        depth += (src[i] == "{") - (src[i] == "}"); i += 1
                    continue
                i += 1
            i += 1
        elif c == "'":
            i += 1
            while i < n and src[i] != "'":
                if src[i] == "\\": i += 1
                i += 1
            i += 1
        else:
            out.append(c); i += 1
    return "".join(out)


class Static(unittest.TestCase):
    def test_kotlin_brackets_balance(self):
        self.assertGreaterEqual(len(KT), 9)
        for f in KT:
            s = strip_kotlin(read(f)); st = []
            pairs = {")": "(", "]": "[", "}": "{"}
            for ch in s:
                if ch in "([{": st.append(ch)
                elif ch in ")]}":
                    self.assertTrue(st and st[-1] == pairs[ch], "unbalanced %s in %s" % (ch, os.path.basename(f)))
                    st.pop()
            self.assertEqual(st, [], os.path.basename(f))

    def test_every_kotlin_file_has_the_right_package_and_a_class(self):
        for f in KT:
            s = read(f)
            self.assertTrue(s.startswith("package com.amtube.app"), f)
            self.assertRegex(s, r"\b(class|object)\s+\w+")

    def test_all_xml_is_valid(self):
        files = glob.glob(RES + "/**/*.xml", recursive=True) + [MAIN + "/AndroidManifest.xml"]
        self.assertGreaterEqual(len(files), 12)
        for f in files:
            ET.parse(f)

    def test_resource_references_exist(self):
        have = {}
        for f in glob.glob(RES + "/values*/*.xml"):
            for el in ET.parse(f).getroot():
                have.setdefault(el.tag, set()).add(el.get("name"))
        files = {os.path.splitext(os.path.basename(p))[0] for p in glob.glob(RES + "/drawable*/*")}
        mip = {os.path.splitext(os.path.basename(p))[0] for p in glob.glob(RES + "/mipmap*/*")}
        code = "\n".join(read(f) for f in KT)
        for kind, name in set(re.findall(r"(?<![\w.])R\.(\w+)\.(\w+)", code)):
            if kind == "string": self.assertIn(name, have.get("string", set()), "R.string." + name)
            elif kind == "drawable": self.assertIn(name, files, "R.drawable." + name)
            elif kind == "mipmap": self.assertIn(name, mip, name)
            else: self.fail("unexpected resource kind " + kind)
        # every string exists in Arabic too
        ar = {el.get("name") for el in ET.parse(RES + "/values-ar/strings.xml").getroot()}
        en = {el.get("name") for el in ET.parse(RES + "/values/strings.xml").getroot()}
        self.assertEqual(ar, en)
        man = read(MAIN + "/AndroidManifest.xml")
        for kind, name in re.findall(r"@(\w+)/(\w+)", man):
            if kind == "style": self.assertIn(name, have.get("style", set()), name)
            elif kind == "string": self.assertIn(name, en, name)
            elif kind == "mipmap": self.assertIn(name, mip, name)
        for kind, name in re.findall(r"@(\w+)/(\w+)", "".join(read(p) for p in glob.glob(RES + "/mipmap-anydpi-v26/*.xml"))):
            if kind == "color": self.assertIn(name, have.get("color", set()), name)
            else: self.assertIn(name, mip, name)

    def test_manifest_components_exist_and_have_required_types(self):
        man = read(MAIN + "/AndroidManifest.xml"); code = "\n".join(read(f) for f in KT)
        for cls in re.findall(r'android:name="\.(\w+)"', man):
            self.assertRegex(code, r"class\s+%s\b" % cls, cls)
        self.assertIn('android:foregroundServiceType="dataSync"', man)
        self.assertIn('android:foregroundServiceType="mediaPlayback"', man)
        self.assertIn("FOREGROUND_SERVICE_DATA_SYNC", man); self.assertIn("FOREGROUND_SERVICE_MEDIA_PLAYBACK", man)
        self.assertIn('android:extractNativeLibs="true"', man)             # yt-dlp is run as an executable
        self.assertIn("android.permission.INTERNET", man)

    def test_bridge_methods_match_the_web_ui(self):
        js = read(MAIN + "/assets/www/app.js") + read(MAIN + "/assets/www/bridge.js")
        used = set(re.findall(r'AMN\.call\("(\w+)"', js))
        kt = read(MAIN + "/java/com/amtube/app/Bridge.kt")
        handled = set(re.findall(r'^\s*"(\w+)"\s*->', kt, re.M))
        self.assertEqual(sorted(used - handled), [], "UI calls that Android does not handle")
        for m in ("getState", "setSettings", "info", "search", "download", "pause", "resume", "cancel", "remove", "play", "share",
                  "openBrowser", "showBrowser", "clipboard", "updateEngine", "applyTheme"):
            self.assertIn(m, handled)
        events_in_kt = set(re.findall(r'emit\("(\w+)"', "".join(read(f) for f in KT)))
        events_in_js = set(re.findall(r'AMN\.on\("(\w+)"', js))
        self.assertEqual(sorted(events_in_kt - events_in_js), [])

    def test_settings_read_by_android_exist_in_the_ui(self):
        app = read(MAIN + "/assets/www/app.js"); kt = "\n".join(read(f) for f in KT)
        for key in re.findall(r'Store\.(?:bool|int|str)\("(\w+)"', kt):
            self.assertIn(key, app, key)
        for grp, key in re.findall(r'Store\.flag\("(\w+)",\s*"(\w+)"', kt):
            self.assertRegex(app, r"\b%s\b" % key)
        for key in ("youtube", "prune", "css", "skip", "web"):
            self.assertRegex(app, r"%s: (true|false)" % key)

    def test_js_scripts_loaded_by_android_exist(self):
        kt = "\n".join(read(f) for f in KT)
        for p in re.findall(r'assets\.open\("([\w/.]+)"\)', kt):
            self.assertTrue(os.path.exists(MAIN + "/assets/" + p), p)
        self.assertIn("file:///android_asset/www/index.html", kt)
        self.assertTrue(os.path.exists(MAIN + "/assets/www/index.html"))

    def test_none_of_the_forbidden_features_exist_anywhere(self):
        banned = ["clean", "battery", "boost", "uninstall", "whatsapp", "toolbar", "junk", "تنظيف", "موفر البطارية", "تعزيز", "إلغاء تثبيت", "واتساب", "شريط الأدوات"]
        files = KT + glob.glob(RES + "/values*/*.xml") + glob.glob(MAIN + "/assets/**/*.js", recursive=True) + [MAIN + "/AndroidManifest.xml", MAIN + "/assets/www/index.html"]
        for f in files:
            if f.endswith("mock.js"): continue
            txt = read(f).lower()
            for w in banned:
                # "cleanup of file names" style words do not occur; Engine.clean() is an error-message cleaner, not a phone cleaner
                txt2 = txt.replace("engine.clean", "").replace("fun clean", "").replace(".clean(", "").replace("cleanerr", "").replace("function clean", "").replace("cleanerr(", "").replace("cleanerr", "")
                txt2 = re.sub(r"clean(err|up)?\(", "", txt2)
                self.assertNotIn(w, txt2, "%s contains '%s'" % (os.path.basename(f), w))

    def test_no_ads_sdk_or_tracking_in_the_build(self):
        gradle = read(ROOT + "/app/build.gradle.kts")
        for bad in ("admob", "play-services-ads", "applovin", "unity3d.ads", "firebase", "facebook.android", "crashlytics", "mobileads", "ironsource"):
            self.assertNotIn(bad, gradle.lower())
        deps = re.findall(r'implementation\("([^"]+)"\)', gradle)
        self.assertEqual(sorted(d.split(":")[1] for d in deps), ["ffmpeg", "library", "webkit"])
        self.assertNotIn("AD_ID", read(MAIN + "/AndroidManifest.xml"))

    def test_launcher_icons_exist_in_every_density(self):
        sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
        from PIL import Image
        for d, s in sizes.items():
            for n, px in (("ic_launcher", s), ("ic_launcher_round", s), ("ic_launcher_foreground", s * 108 // 48), ("ic_launcher_monochrome", s * 108 // 48)):
                im = Image.open("%s/mipmap-%s/%s.png" % (RES, d, n))
                self.assertEqual(im.size, (px, px), (d, n))

    def test_gradle_and_workflow_files(self):
        for f in ("settings.gradle.kts", "build.gradle.kts", "gradle.properties", "app/build.gradle.kts", ".github/workflows/build.yml"):
            self.assertTrue(os.path.exists(os.path.join(ROOT, f)), f)
        g = read(ROOT + "/app/build.gradle.kts")
        self.assertIn("useLegacyPackaging = true", g); self.assertIn("minSdk = 29", g); self.assertIn("0.18.1", g)
        w = read(ROOT + "/.github/workflows/build.yml")
        self.assertIn("assembleDebug", w); self.assertIn("continue-on-error: true", w)
        import yaml  # noqa
        yaml.safe_load(w)


if __name__ == "__main__":
    unittest.main(verbosity=2)
