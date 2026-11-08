/* UI texts: Arabic + English. */
(function () {
  const EN = {
    app: "AMTube", search_ph: "Search or paste a link", paste: "Paste", clear: "Clear", go: "Go",
    home: "Home", sites: "Sites", library: "Library", settings: "Settings",
    cat_music: "Music", cat_gaming: "Gaming", cat_news: "News", cat_sports: "Sports", cat_tech: "Tech",
    cat_comedy: "Comedy", cat_food: "Food", cat_movies: "Movies",
    q_music: "trending music", q_gaming: "gaming highlights", q_news: "news today", q_sports: "sports highlights",
    q_tech: "tech reviews", q_comedy: "funny videos", q_food: "easy recipes", q_movies: "movie trailers",
    loading: "Loading…", engine_wait: "The download engine is starting, please wait a moment…",
    err_generic: "Something went wrong", try_again: "Try again", no_results: "Nothing found",
    results_hint: "Search for a video or paste its link, then tap the download button.",
    watch: "Watch", download: "Download", download_btn: "Download", added: "Added to downloads", close: "Close",
    video: "Video", audio: "Audio only", save_in: "Saved to Movies/AMTube and Music/AMTube",
    fetching: "Getting available qualities…", choose_quality: "Choose a quality",
    playlist: "Playlist", select_all: "Select all", selected: "selected", quality: "Quality", download_sel: "Download selected",
    best: "Best available", needs_engine: "MP3 needs the ffmpeg component, which is not ready yet",
    sites_title: "Video sites", edit: "Edit", done: "Done", add_site: "Add a site", site_name: "Name", site_url: "Address (https://…)",
    save: "Save", cancel: "Cancel", delete: "Delete", remove_q: "Remove this item?", remove_file: "Also delete the file from the phone",
    lib_video: "Video", lib_audio: "Music", lib_active: "In progress", lib_empty: "No downloads yet",
    lib_empty_hint: "Your downloaded videos and music will appear here.", queued: "Waiting", running: "Downloading",
    paused: "Paused", failed: "Failed", finished: "Done", pause: "Pause", resume: "Resume", cancel_dl: "Cancel", play: "Play", share: "Share",
    set_appearance: "Appearance", set_language: "Language", set_theme: "Theme", set_accent: "Main colour", change: "Change",
    theme_auto: "Automatic", theme_light: "Light", theme_dark: "Dark", theme_amoled: "Pure black",
    set_downloads: "Downloads", set_quality: "Default quality", ask_every_time: "Ask every time", set_audio: "Audio format",
    set_parallel: "Simultaneous downloads", set_wifi: "Wi-Fi only", set_subs: "Download subtitles when available",
    set_adblock: "YouTube ad blocker", adblock_on: "Block YouTube ads", adblock_note: "Works inside the in-app browser only.",
    ab_prune: "Remove ads from the player data", ab_css: "Hide ad elements on the page", ab_skip: "Skip video ads automatically",
    ab_web: "Block ads on other websites too",
    set_engine: "Download engine", engine_ytdlp: "Downloader (yt-dlp)", engine_ffmpeg: "Converter (ffmpeg)", engine_js: "YouTube helper (QuickJS)",
    ready: "Ready", missing: "Not available", update_engine: "Update the download engine", updating: "Updating…",
    set_about: "About", version: "Version", no_ads_note: "AMTube has no ads and no paid tiers.",
    rights_note: "Download only what you own or have permission to save. Respect each site's terms and copyright.",
    pick_color: "Pick the main colour", hue: "Hue", sat: "Saturation", light: "Lightness", hex: "Colour code", reset_yellow: "Back to yellow", apply: "Apply",
    pick_lang: "Choose a language", pick_theme: "Choose a theme", pick_quality: "Default quality", pick_audio: "Audio format",
    open_failed: "Could not open this link", clipboard_empty: "The clipboard has no link",
    app_updated: "Done", moved: "Moved"
  };
  const AR = {
    app: "AMTube", search_ph: "ابحث أو الصق رابطًا", paste: "لصق", clear: "مسح", go: "اذهب",
    home: "الرئيسية", sites: "المواقع", library: "المكتبة", settings: "الإعدادات",
    cat_music: "موسيقى", cat_gaming: "ألعاب", cat_news: "أخبار", cat_sports: "رياضة", cat_tech: "تقنية",
    cat_comedy: "كوميديا", cat_food: "طبخ", cat_movies: "أفلام",
    q_music: "أغاني رائجة", q_gaming: "أفضل لحظات الألعاب", q_news: "أخبار اليوم", q_sports: "ملخصات رياضية",
    q_tech: "مراجعات تقنية", q_comedy: "فيديوهات مضحكة", q_food: "وصفات سهلة", q_movies: "إعلانات أفلام",
    loading: "جارٍ التحميل…", engine_wait: "محرك التنزيل قيد التشغيل، انتظر لحظة…",
    err_generic: "حدث خطأ ما", try_again: "إعادة المحاولة", no_results: "لا توجد نتائج",
    results_hint: "ابحث عن فيديو أو الصق رابطه، ثم اضغط زر التنزيل.",
    watch: "مشاهدة", download: "تنزيل", download_btn: "تنزيل", added: "تمت الإضافة إلى التنزيلات", close: "إغلاق",
    video: "فيديو", audio: "صوت فقط", save_in: "يُحفظ في Movies/AMTube و Music/AMTube",
    fetching: "جارٍ جلب الجودات المتاحة…", choose_quality: "اختر الجودة",
    playlist: "قائمة تشغيل", select_all: "تحديد الكل", selected: "محدد", quality: "الجودة", download_sel: "تنزيل المحدد",
    best: "أفضل جودة متاحة", needs_engine: "تحويل MP3 يحتاج مكوّن ffmpeg وهو غير جاهز بعد",
    sites_title: "مواقع الفيديو", edit: "تعديل", done: "تم", add_site: "إضافة موقع", site_name: "الاسم", site_url: "العنوان (https://…)",
    save: "حفظ", cancel: "إلغاء", delete: "حذف", remove_q: "هل تريد حذف هذا العنصر؟", remove_file: "احذف الملف من الهاتف أيضًا",
    lib_video: "فيديو", lib_audio: "موسيقى", lib_active: "جارٍ التنزيل", lib_empty: "لا توجد تنزيلات بعد",
    lib_empty_hint: "ستظهر هنا الفيديوهات والموسيقى التي تنزّلها.", queued: "في الانتظار", running: "جارٍ التنزيل",
    paused: "متوقف مؤقتًا", failed: "فشل", finished: "اكتمل", pause: "إيقاف مؤقت", resume: "استئناف", cancel_dl: "إلغاء", play: "تشغيل", share: "مشاركة",
    set_appearance: "المظهر", set_language: "اللغة", set_theme: "السمة", set_accent: "اللون الرئيسي", change: "تغيير",
    theme_auto: "تلقائي", theme_light: "نهاري", theme_dark: "ليلي", theme_amoled: "أسود كامل",
    set_downloads: "التنزيلات", set_quality: "الجودة الافتراضية", ask_every_time: "اسأل كل مرة", set_audio: "صيغة الصوت",
    set_parallel: "عدد التنزيلات المتزامنة", set_wifi: "عبر Wi-Fi فقط", set_subs: "تنزيل الترجمة إن وُجدت",
    set_adblock: "حاجب إعلانات يوتيوب", adblock_on: "حجب إعلانات يوتيوب", adblock_note: "يعمل داخل متصفح التطبيق فقط.",
    ab_prune: "إزالة الإعلانات من بيانات المشغّل", ab_css: "إخفاء عناصر الإعلانات في الصفحة", ab_skip: "تخطي إعلانات الفيديو تلقائيًا",
    ab_web: "حجب الإعلانات في المواقع الأخرى أيضًا",
    set_engine: "محرك التنزيل", engine_ytdlp: "المُنزِّل (yt-dlp)", engine_ffmpeg: "المحوِّل (ffmpeg)", engine_js: "مساعد يوتيوب (QuickJS)",
    ready: "جاهز", missing: "غير متوفر", update_engine: "تحديث محرك التنزيل", updating: "جارٍ التحديث…",
    set_about: "حول", version: "الإصدار", no_ads_note: "لا يحتوي AMTube على إعلانات ولا على اشتراكات مدفوعة.",
    rights_note: "نزّل فقط ما تملكه أو لديك إذن بحفظه. احترم شروط كل موقع وحقوق النشر.",
    pick_color: "اختر اللون الرئيسي", hue: "درجة اللون", sat: "التشبع", light: "السطوع", hex: "رمز اللون", reset_yellow: "العودة للأصفر", apply: "تطبيق",
    pick_lang: "اختر اللغة", pick_theme: "اختر السمة", pick_quality: "الجودة الافتراضية", pick_audio: "صيغة الصوت",
    open_failed: "تعذّر فتح هذا الرابط", clipboard_empty: "لا يوجد رابط في الحافظة",
    app_updated: "تم", moved: "تم النقل"
  };
  const T = { en: EN, ar: AR };
  window.AMI18N = {
    T,
    t(lang, key, vars) {
      let s = (T[lang] && T[lang][key]); if (s == null) s = EN[key]; if (s == null) s = key;
      if (vars) for (const k in vars) s = s.replace("{" + k + "}", vars[k]);
      return s;
    }
  };
})();
