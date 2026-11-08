package com.amtube.app

import android.app.Application
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.lang.reflect.InvocationTargetException

/**
 * The download engine = the youtubedl-android library (yt-dlp + ffmpeg).
 * Every call goes through reflection on purpose: if a future version of the library renames something, the app still
 * builds, and the Settings screen shows a clear message instead of the whole build failing.
 */
object Engine {
    @Volatile var ready = false
    @Volatile var ffmpeg = false
    @Volatile var error = ""
    @Volatile var version = ""
    @Volatile private var started = false

    private const val YD = "com.yausername.youtubedl_android.YoutubeDL"
    private const val REQ = "com.yausername.youtubedl_android.YoutubeDLRequest"
    private const val FF = "com.yausername.ffmpeg.FFmpeg"

    private val FORMAT_KEYS = arrayOf(
        "format_id", "ext", "height", "width", "fps", "vcodec", "acodec", "filesize", "filesize_approx",
        "tbr", "vbr", "abr", "format_note", "protocol"
    )
    private val TOP_KEYS = arrayOf(
        "title", "duration", "thumbnail", "uploader", "channel", "webpage_url", "original_url", "_type", "id"
    )
    private val ENTRY_KEYS = arrayOf("id", "title", "url", "duration", "uploader", "channel", "thumbnail")

    fun describe(e: Throwable): String {
        val t = if (e is InvocationTargetException) (e.targetException ?: e) else e
        return clean(t.message ?: t.javaClass.simpleName)
    }

    fun clean(msg: String): String =
        msg.replace(Regex("\u001B\\[[0-9;]*m"), "").replace(Regex("^(ERROR:\\s*)+"), "").trim().take(300)

    fun clean(e: Throwable): String = describe(e)

    private fun singleton(cls: Class<*>): Any {
        try {
            return cls.getMethod("getInstance").invoke(null)!!
        } catch (e: NoSuchMethodException) {
            // Kotlin object / companion style
        }
        val companion = cls.getField("Companion").get(null)!!
        return companion.javaClass.getMethod("getInstance").invoke(companion)!!
    }

    private fun callInit(className: String, ctx: Context) {
        val cls = Class.forName(className)
        val inst = singleton(cls)
        val m = cls.methods.first {
            it.name == "init" && it.parameterTypes.size == 1 && it.parameterTypes[0].isAssignableFrom(ctx.javaClass)
        }
        try {
            m.invoke(inst, ctx)
        } catch (e: InvocationTargetException) {
            throw e.targetException ?: e
        }
    }

    fun start(app: Application) {
        if (started) return
        started = true
        Thread {
            try {
                callInit(YD, app); ready = true
            } catch (e: Throwable) {
                error = describe(e)
            }
            try {
                callInit(FF, app); ffmpeg = true
            } catch (e: Throwable) {
                if (error.isEmpty()) error = "ffmpeg: " + describe(e)
            }
            version = readVersion(app)
        }.start()
    }

    private fun readVersion(ctx: Context): String = try {
        val inst = singleton(Class.forName(YD))
        val m = inst.javaClass.methods.first { it.name == "version" && it.parameterTypes.size == 1 }
        (m.invoke(inst, ctx) as? String) ?: ""
    } catch (e: Throwable) {
        ""
    }

    fun waitReady(ms: Long): Boolean {
        val end = System.currentTimeMillis() + ms
        while (!ready && error.isEmpty() && System.currentTimeMillis() < end) Thread.sleep(150)
        return ready
    }

    private fun requireReady() {
        if (!waitReady(40000)) {
            throw IllegalStateException(if (error.isNotEmpty()) error else "The download engine is not ready yet")
        }
    }

    /** QuickJS, built by the GitHub workflow into jniLibs: lets yt-dlp solve YouTube's JavaScript checks. */
    fun jsRuntime(ctx: Context): String? {
        val f = File(ctx.applicationInfo.nativeLibraryDir, "libqjs.so")
        return if (f.exists()) f.absolutePath else null
    }

    fun newRequest(ctx: Context, url: String): Any {
        val r = Class.forName(REQ).getConstructor(String::class.java).newInstance(url)
        opt(r, "--socket-timeout", "25")
        jsRuntime(ctx)?.let { opt(r, "--js-runtimes", "quickjs:$it") }
        return r
    }

    fun opt(req: Any, key: String, value: String? = null) {
        if (value == null) {
            req.javaClass.getMethod("addOption", String::class.java).invoke(req, key)
        } else {
            req.javaClass.getMethod("addOption", String::class.java, String::class.java).invoke(req, key, value)
        }
    }

    /** Runs yt-dlp and returns what it printed. [id] lets us stop it later (pause / cancel). */
    fun exec(req: Any, id: String?): String {
        val inst = singleton(Class.forName(YD))
        val all = inst.javaClass.methods.filter {
            it.name == "execute" && it.parameterTypes.isNotEmpty() && it.parameterTypes[0].isAssignableFrom(req.javaClass)
        }
        val withId = all.filter { m -> m.parameterTypes.any { it == String::class.java } }
            .maxByOrNull { it.parameterTypes.size }
        val m = (if (id != null && withId != null) withId else all.minByOrNull { it.parameterTypes.size })
            ?: throw IllegalStateException("execute() was not found in the engine library")
        val args = arrayOfNulls<Any>(m.parameterTypes.size)
        for (i in args.indices) {
            val p = m.parameterTypes[i]
            args[i] = when {
                i == 0 -> req
                p == String::class.java -> id
                p == java.lang.Boolean.TYPE -> false
                else -> null
            }
        }
        val resp = try {
            m.invoke(inst, *args)
        } catch (e: InvocationTargetException) {
            throw RuntimeException(describe(e))
        }
        return try {
            (resp!!.javaClass.getMethod("getOut").invoke(resp) as? String) ?: ""
        } catch (e: Throwable) {
            ""
        }
    }

    fun destroy(id: String) {
        try {
            val inst = singleton(Class.forName(YD))
            inst.javaClass.getMethod("destroyProcessById", String::class.java).invoke(inst, id)
        } catch (e: Throwable) {
            // nothing to stop
        }
    }

    fun update(ctx: Context): String = try {
        requireReady()
        val inst = singleton(Class.forName(YD))
        val m = inst.javaClass.methods.firstOrNull { it.name == "updateYoutubeDL" }
            ?: return "Updating is not supported by this engine version"
        val channelType = m.parameterTypes.getOrNull(1)
        val stable = channelType?.let { stableChannel(it) }
        val res = try {
            if (stable != null) m.invoke(inst, ctx, stable) else m.invoke(inst, ctx)
        } catch (e: InvocationTargetException) {
            throw RuntimeException(describe(e))
        }
        version = readVersion(ctx)
        "yt-dlp " + (if (version.isNotEmpty()) version else (res?.toString() ?: "OK"))
    } catch (e: Throwable) {
        describe(e)
    }

    private fun stableChannel(t: Class<*>): Any? {
        try {
            return t.getField("STABLE").get(null)
        } catch (e: Throwable) { }
        try {
            return Class.forName(t.name + "\$STABLE").getField("INSTANCE").get(null)
        } catch (e: Throwable) { }
        try {
            return t.enumConstants?.firstOrNull { it.toString().equals("STABLE", true) }
        } catch (e: Throwable) { }
        return null
    }

    // ---- what the web UI asks for -------------------------------------------------------------

    fun info(ctx: Context, url: String): String {
        requireReady()
        val r = newRequest(ctx, url)
        opt(r, "-J"); opt(r, "--flat-playlist"); opt(r, "--no-playlist")
        return slim(exec(r, "info-" + System.nanoTime()))
    }

    fun search(ctx: Context, query: String, n: Int): String {
        requireReady()
        val r = newRequest(ctx, "ytsearch$n:$query")
        opt(r, "-J"); opt(r, "--flat-playlist")
        return slim(exec(r, "search-" + System.nanoTime()))
    }

    /** Keeps only the fields the UI needs (yt-dlp prints megabytes of JSON for a YouTube video). */
    private fun slim(raw: String): String {
        val a = raw.indexOf('{')
        val b = raw.lastIndexOf('}')
        if (a < 0 || b <= a) throw RuntimeException("The download engine returned no information for this link")
        val j = JSONObject(raw.substring(a, b + 1))
        val o = JSONObject()
        for (k in TOP_KEYS) if (j.has(k) && !j.isNull(k)) o.put(k, j.get(k))
        val fs = j.optJSONArray("formats")
        if (fs != null) {
            val out = JSONArray()
            for (i in 0 until fs.length()) {
                val f = fs.optJSONObject(i) ?: continue
                val g = JSONObject()
                for (k in FORMAT_KEYS) if (f.has(k) && !f.isNull(k)) g.put(k, f.get(k))
                out.put(g)
            }
            o.put("formats", out)
        }
        val es = j.optJSONArray("entries")
        if (es != null) {
            val out = JSONArray()
            for (i in 0 until es.length()) {
                val e = es.optJSONObject(i) ?: continue
                val g = JSONObject()
                for (k in ENTRY_KEYS) if (e.has(k) && !e.isNull(k)) g.put(k, e.get(k))
                out.put(g)
            }
            o.put("entries", out)
        }
        return o.toString()
    }
}
