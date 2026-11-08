package com.amtube.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Environment
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

/** The download queue. Each job runs yt-dlp (through [Engine]) in its own thread. */
object Downloads {
    class Job(val id: String) {
        var url = ""
        var title = ""
        var thumb = ""
        var kind = "video"
        var height = 0
        var audioFmt = ""
        var size = 0L
        var duration = 0.0
        @Volatile var state = "queued"      // queued | running | paused | failed | done
        @Volatile var progress = -1f
        @Volatile var speed = 0L
        @Volatile var eta = 0L
        @Volatile var error = ""
        var uri = ""
        var added = 0L
        @Volatile var canceled = false

        fun toJson(): JSONObject = JSONObject().put("id", id).put("url", url).put("title", title).put("thumb", thumb)
            .put("kind", kind).put("height", height).put("audioFmt", audioFmt).put("size", size).put("duration", duration)
            .put("state", state).put("progress", progress.toDouble()).put("speed", speed).put("eta", eta)
            .put("error", error).put("uri", uri).put("added", added)

        companion object {
            fun fromJson(o: JSONObject): Job {
                val j = Job(o.optString("id"))
                j.url = o.optString("url"); j.title = o.optString("title"); j.thumb = o.optString("thumb")
                j.kind = o.optString("kind", "video"); j.height = o.optInt("height"); j.audioFmt = o.optString("audioFmt")
                j.size = o.optLong("size"); j.duration = o.optDouble("duration", 0.0); j.state = o.optString("state", "paused")
                j.progress = o.optDouble("progress", -1.0).toFloat(); j.error = o.optString("error"); j.uri = o.optString("uri")
                j.added = o.optLong("added")
                return j
            }
        }
    }

    private val jobs = LinkedHashMap<String, Job>()
    private lateinit var app: Context
    private val pool = Executors.newCachedThreadPool()

    fun init(ctx: Context) {
        app = ctx.applicationContext
        val arr = Store.downloads()
        for (i in 0 until arr.length()) {
            val j = Job.fromJson(arr.getJSONObject(i))
            if (j.state == "running" || j.state == "queued") j.state = "paused"   // the app was closed while it ran
            jobs[j.id] = j
        }
    }

    @Synchronized
    fun list(): JSONArray {
        val arr = JSONArray()
        for (j in jobs.values.sortedByDescending { it.added }) arr.put(j.toJson())
        return arr
    }

    @Synchronized
    private fun persist() {
        val arr = JSONArray()
        for (j in jobs.values) arr.put(j.toJson())
        Store.saveDownloads(arr)
    }

    @Synchronized
    fun activeCount(): Int = jobs.values.count { it.state == "running" || it.state == "queued" }

    @Synchronized
    fun summary(): Pair<Int, Int> {                      // (percent of running jobs, number active)
        val running = jobs.values.filter { it.state == "running" }
        val known = running.filter { it.progress >= 0f }
        val pct = if (known.isEmpty()) -1 else (known.sumOf { it.progress.toDouble() } / known.size * 100).toInt()
        return Pair(pct, activeCount())
    }

    @Synchronized
    fun add(spec: JSONObject): String {
        val j = Job("d" + System.currentTimeMillis() + (Math.random() * 1000).toInt())
        j.url = spec.getString("url")
        j.title = spec.optString("title", j.url)
        j.thumb = spec.optString("thumb")
        j.kind = spec.optString("kind", "video")
        j.height = spec.optInt("height")
        j.audioFmt = spec.optString("audioFmt", "mp3")
        j.size = spec.optLong("size")
        j.duration = spec.optDouble("duration", 0.0)
        j.added = System.currentTimeMillis()
        jobs[j.id] = j
        persist()
        startService()
        pump()
        return j.id
    }

    @Synchronized
    fun pause(id: String) {
        val j = jobs[id] ?: return
        if (j.state == "running" || j.state == "queued") {
            j.state = "paused"
            Engine.destroy(j.id)
            persist()
        }
    }

    @Synchronized
    fun resume(id: String) {
        val j = jobs[id] ?: return
        if (j.state == "paused" || j.state == "failed") {
            j.state = "queued"; j.error = ""; j.canceled = false
            persist(); startService(); pump()
        }
    }

    @Synchronized
    fun cancel(id: String) {
        val j = jobs[id] ?: return
        j.canceled = true
        Engine.destroy(j.id)
        j.state = "failed"; j.error = ""
        File(app.getExternalFilesDir(null), "tmp/" + j.id).deleteRecursively()
        jobs.remove(id)
        persist()
    }

    @Synchronized
    fun remove(id: String, deleteFile: Boolean) {
        val j = jobs[id] ?: return
        if (j.state == "running") { j.canceled = true; Engine.destroy(j.id) }
        if (deleteFile && j.uri.isNotEmpty()) {
            try { app.contentResolver.delete(Uri.parse(j.uri), null, null) } catch (e: Throwable) { }
        }
        File(app.getExternalFilesDir(null), "tmp/" + j.id).deleteRecursively()
        jobs.remove(id)
        persist()
    }

    @Synchronized
    fun get(id: String): Job? = jobs[id]

    @Synchronized
    fun pump() {
        val limit = Store.int("parallel", 2).coerceIn(1, 5)
        var running = jobs.values.count { it.state == "running" }
        for (j in jobs.values) {
            if (running >= limit) break
            if (j.state == "queued") {
                j.state = "running"; j.progress = -1f
                running++
                pool.execute { run(j) }
            }
        }
        persist()
    }

    private fun onWifi(): Boolean {
        val cm = app.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
    }

    private fun dirBytes(d: File): Long = d.walkTopDown().filter { it.isFile }.sumOf { it.length() }

    private fun formatSelector(j: Job, hasFfmpeg: Boolean): String {
        if (j.kind == "audio") return if (j.audioFmt == "m4a") "ba[ext=m4a]/ba/b" else "ba/b"
        val h = j.height
        if (h <= 0) return if (hasFfmpeg) "bv*+ba/b" else "b"
        return if (hasFfmpeg)
            "bv*[height<=$h][vcodec^=avc1]+ba[acodec^=mp4a]/bv*[height<=$h]+ba/b[height<=$h]/b"
        else "b[height<=$h]/b"
    }

    private fun run(j: Job) {
        val ctx = app
        val tmp = File(ctx.getExternalFilesDir(null), "tmp/" + j.id)
        tmp.mkdirs()
        var polling = true
        try {
            if (Store.bool("wifiOnly", false) && !onWifi()) throw RuntimeException("Waiting for Wi-Fi (Wi-Fi only is on)")
            if (!Engine.waitReady(60000)) throw RuntimeException(if (Engine.error.isNotEmpty()) Engine.error else "The download engine is not ready")
            val r = Engine.newRequest(ctx, j.url)
            Engine.opt(r, "-o", File(tmp, "%(title).100B.%(ext)s").absolutePath)
            Engine.opt(r, "--no-playlist"); Engine.opt(r, "--continue"); Engine.opt(r, "--no-mtime")
            Engine.opt(r, "--windows-filenames")
            Engine.opt(r, "--retries", "10"); Engine.opt(r, "--fragment-retries", "10"); Engine.opt(r, "-N", "4")
            Engine.opt(r, "-f", formatSelector(j, Engine.ffmpeg))
            if (j.kind == "audio") {
                Engine.opt(r, "-x"); Engine.opt(r, "--audio-format", if (j.audioFmt == "m4a") "m4a" else "mp3")
                if (j.audioFmt != "m4a") Engine.opt(r, "--audio-quality", "192K")
            } else if (Engine.ffmpeg) {
                Engine.opt(r, "--merge-output-format", "mp4")
            }
            if (Store.bool("subs", false)) {
                Engine.opt(r, "--write-subs"); Engine.opt(r, "--sub-langs", "ar.*,en.*"); Engine.opt(r, "--convert-subs", "srt")
            }
            // progress = size of the files yt-dlp has written so far / expected size
            Thread {
                var last = 0L
                var lastT = System.currentTimeMillis()
                while (polling) {
                    try { Thread.sleep(800) } catch (e: InterruptedException) { }
                    val now = System.currentTimeMillis()
                    val bytes = dirBytes(tmp)
                    if (now > lastT) j.speed = ((bytes - last) * 1000 / (now - lastT)).coerceAtLeast(0)
                    last = bytes; lastT = now
                    if (j.size > 0) {
                        j.progress = (bytes.toFloat() / j.size).coerceIn(0f, 0.99f)
                        j.eta = if (j.speed > 0) ((j.size - bytes).coerceAtLeast(0) / j.speed) else 0
                    } else j.progress = -1f
                }
            }.start()
            Engine.exec(r, j.id)
            polling = false
            if (j.canceled || j.state == "paused") return
            val files = (tmp.listFiles() ?: emptyArray()).filter {
                it.isFile && !it.name.endsWith(".part") && !it.name.endsWith(".ytdl") && !it.name.endsWith(".temp")
            }
            val media = files.filter { Media.isMedia(it) }.maxByOrNull { it.length() }
                ?: throw RuntimeException("The engine finished but no file was produced")
            val uri = Media.export(ctx, media, j.kind == "audio")
            for (f in files) if (f != media) Media.exportOther(ctx, f)
            j.uri = uri.toString(); j.size = media.length(); j.title = media.nameWithoutExtension
            j.progress = 1f; j.speed = 0; j.state = "done"
            tmp.deleteRecursively()
            Notes.done(ctx, j.title)
        } catch (e: Throwable) {
            polling = false
            if (!(j.state == "paused" || j.canceled)) { j.state = "failed"; j.error = Engine.describe(e) }
        } finally {
            polling = false
            persist()
            pump()
        }
    }

    private fun startService() {
        try {
            app.startForegroundService(Intent(app, DownloadService::class.java))
        } catch (e: Throwable) {
            // not allowed while in the background: downloads still run, just without the notification
        }
    }
}

/** Saves finished files into the phone's gallery / music folders. */
object Media {
    private val exts = setOf("mp4", "mkv", "webm", "m4a", "mp3", "opus", "ogg", "aac", "mov", "flac", "wav", "3gp", "m4v")

    fun isMedia(f: File): Boolean = f.extension.lowercase() in exts

    private fun mime(ext: String, audio: Boolean): String = when (ext.lowercase()) {
        "mp4", "m4v" -> if (audio) "audio/mp4" else "video/mp4"
        "m4a" -> "audio/mp4"
        "mp3" -> "audio/mpeg"
        "mkv" -> "video/x-matroska"
        "webm" -> if (audio) "audio/webm" else "video/webm"
        "opus", "ogg" -> "audio/ogg"
        else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.lowercase()) ?: (if (audio) "audio/*" else "video/*")
    }

    fun export(ctx: Context, f: File, audio: Boolean): Uri {
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, f.name)
            put(MediaStore.MediaColumns.MIME_TYPE, mime(f.extension, audio))
            put(MediaStore.MediaColumns.RELATIVE_PATH, (if (audio) Environment.DIRECTORY_MUSIC else Environment.DIRECTORY_MOVIES) + "/AMTube")
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val collection = if (audio) MediaStore.Audio.Media.EXTERNAL_CONTENT_URI else MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        return copyInto(ctx, collection, values, f)
    }

    fun exportOther(ctx: Context, f: File) {
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, f.name)
            put(MediaStore.MediaColumns.MIME_TYPE, MimeTypeMap.getSingleton().getMimeTypeFromExtension(f.extension.lowercase()) ?: "application/octet-stream")
            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/AMTube")
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        try { copyInto(ctx, MediaStore.Downloads.EXTERNAL_CONTENT_URI, values, f) } catch (e: Throwable) { }
    }

    private fun copyInto(ctx: Context, collection: Uri, values: ContentValues, f: File): Uri {
        val uri = ctx.contentResolver.insert(collection, values) ?: throw RuntimeException("Could not create the file in the gallery")
        ctx.contentResolver.openOutputStream(uri)!!.use { out -> f.inputStream().use { it.copyTo(out) } }
        val done = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
        ctx.contentResolver.update(uri, done, null, null)
        return uri
    }
}

/** Notifications. */
object Notes {
    const val CH_DL = "amt_dl"
    const val CH_DONE = "amt_done"
    const val CH_PLAY = "amt_play"

    fun channels(ctx: Context) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(NotificationChannel(CH_DL, ctx.getString(R.string.ch_downloads), NotificationManager.IMPORTANCE_LOW))
        nm.createNotificationChannel(NotificationChannel(CH_DONE, ctx.getString(R.string.ch_done), NotificationManager.IMPORTANCE_DEFAULT))
        nm.createNotificationChannel(NotificationChannel(CH_PLAY, ctx.getString(R.string.ch_playback), NotificationManager.IMPORTANCE_LOW))
    }

    fun openApp(ctx: Context): PendingIntent =
        PendingIntent.getActivity(ctx, 0, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    fun done(ctx: Context, title: String) {
        try {
            val n = Notification.Builder(ctx, CH_DONE).setSmallIcon(R.drawable.ic_stat_dl).setContentTitle(ctx.getString(R.string.dl_done))
                .setContentText(title).setAutoCancel(true).setContentIntent(openApp(ctx)).build()
            (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(title.hashCode(), n)
        } catch (e: Throwable) { }
    }
}

/** Keeps the process alive and shows progress while downloads run. */
class DownloadService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val tick = object : Runnable {
        override fun run() {
            val (pct, active) = Downloads.summary()
            if (active == 0) {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return
            }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(NID, build(pct, active))
            handler.postDelayed(this, 1000)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Notes.channels(this)
        startForeground(NID, build(-1, 1), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        handler.post(tick)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_NOT_STICKY

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun build(pct: Int, active: Int): Notification {
        val b = Notification.Builder(this, Notes.CH_DL).setSmallIcon(R.drawable.ic_stat_dl)
            .setContentTitle(getString(R.string.dl_running, active)).setOngoing(true).setContentIntent(Notes.openApp(this))
        if (pct >= 0) b.setProgress(100, pct, false).setContentText("$pct%") else b.setProgress(0, 0, true)
        return b.build()
    }

    companion object {
        const val NID = 1001
    }
}
