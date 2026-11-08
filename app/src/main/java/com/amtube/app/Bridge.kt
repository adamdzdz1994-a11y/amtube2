package com.amtube.app

import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.Executors

/** What the web UI (assets/www) can ask the phone to do. One entry point: call(id, method, argsJson). */
class Bridge(private val act: MainActivity) {
    private val io = Executors.newFixedThreadPool(3)

    @JavascriptInterface
    fun call(id: String, method: String, args: String) {
        io.execute {
            try {
                val res = dispatch(method, if (args.isEmpty()) JSONObject() else JSONObject(args))
                reply(id, true, res)
            } catch (e: Throwable) {
                reply(id, false, Engine.describe(e))
            }
        }
    }

    private fun reply(id: String, ok: Boolean, payload: String) {
        act.runOnUiThread {
            act.web.evaluateJavascript(
                "AMN._res(" + JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(payload) + ")", null
            )
        }
    }

    private fun engineJson(): JSONObject = JSONObject()
        .put("ready", Engine.ready)
        .put("ytdlp", Engine.version)
        .put("ffmpeg", Engine.ffmpeg)
        .put("js", Engine.jsRuntime(act) != null)
        .put("error", Engine.error)

    private fun dispatch(method: String, a: JSONObject): String {
        when (method) {
            "getState" -> {
                val o = JSONObject()
                    .put("settings", Store.settings())
                    .put("downloads", Downloads.list())
                    .put("night", act.isNight())
                    .put("locale", Locale.getDefault().language)
                    .put("version", act.versionName())
                    .put("engine", engineJson())
                val shared = act.takeShared()
                if (shared != null) o.put("shared", shared)
                return o.toString()
            }
            "setSettings" -> {
                Store.saveSettings(a.toString()); Downloads.pump(); return "true"
            }
            "applyTheme" -> {
                act.applyBars(a.optBoolean("dark"), a.optString("bg")); return "true"
            }
            "info" -> return Engine.info(act, a.getString("url"))
            "search" -> return Engine.search(act, a.getString("q"), a.optInt("n", 12))
            "download" -> return JSONObject().put("id", Downloads.add(a)).toString()
            "downloads" -> return Downloads.list().toString()
            "pause" -> { Downloads.pause(a.getString("id")); return "true" }
            "resume" -> { Downloads.resume(a.getString("id")); return "true" }
            "cancel" -> { Downloads.cancel(a.getString("id")); return "true" }
            "remove" -> { Downloads.remove(a.getString("id"), a.optBoolean("deleteFile")); return "true" }
            "play" -> {
                val j = Downloads.get(a.getString("id")) ?: return "false"
                act.runOnUiThread { PlayerActivity.start(act, j.uri, j.title, j.kind == "audio") }
                return "true"
            }
            "share" -> {
                val j = Downloads.get(a.getString("id")) ?: return "false"
                act.runOnUiThread {
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = if (j.kind == "audio") "audio/*" else "video/*"
                        putExtra(Intent.EXTRA_STREAM, Uri.parse(j.uri))
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    act.startActivity(Intent.createChooser(send, j.title))
                }
                return "true"
            }
            "openBrowser" -> { val u = a.getString("url"); act.runOnUiThread { act.browser.open(u) }; return "true" }
            "showBrowser" -> { act.runOnUiThread { act.browser.show() }; return "true" }
            "closeBrowser" -> { act.runOnUiThread { act.browser.close() }; return "true" }
            "clipboard" -> {
                var text = ""
                val latch = java.util.concurrent.CountDownLatch(1)
                act.runOnUiThread {
                    try {
                        val cm = act.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        text = cm.primaryClip?.getItemAt(0)?.coerceToText(act)?.toString() ?: ""
                    } catch (e: Throwable) { }
                    latch.countDown()
                }
                latch.await(2, java.util.concurrent.TimeUnit.SECONDS)
                return JSONObject().put("text", text).toString()
            }
            "updateEngine" -> return JSONObject().put("message", Engine.update(act)).toString()
        }
        return "null"
    }
}
