package com.amtube.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import org.json.JSONObject

class MainActivity : Activity() {
    lateinit var web: WebView
    lateinit var browser: BrowserHost
    private val ui = Handler(Looper.getMainLooper())
    @Volatile private var shared: String? = null
    private val pusher = object : Runnable {
        override fun run() {
            emit("downloads", Downloads.list().toString())
            ui.postDelayed(this, 800)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Notes.channels(this)
        val root = FrameLayout(this)
        setContentView(root)

        web = WebView(this)
        val s = web.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.allowFileAccess = false                // assets are still reachable through file:///android_asset
        s.allowContentAccess = false
        s.setSupportZoom(false)
        s.textZoom = 100
        web.overScrollMode = View.OVER_SCROLL_NEVER
        web.addJavascriptInterface(Bridge(this), "NativeBridge")
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true   // the UI never navigates
        }
        if (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0) WebView.setWebContentsDebuggingEnabled(true)
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        browser = BrowserHost(this, root)
        web.loadUrl("file:///android_asset/www/index.html")

        if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7)
        handleIntent(intent, false)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent, true)
    }

    private fun handleIntent(i: Intent?, live: Boolean) {
        if (i == null || i.action != Intent.ACTION_SEND) return
        val text = i.getStringExtra(Intent.EXTRA_TEXT) ?: return
        val m = Regex("https?://\\S+").find(text) ?: return
        if (live) emit("shared", m.value) else shared = m.value
    }

    /** Called by the bridge once the page asks for its state: a link that started the app. */
    fun takeShared(): String? {
        val s = shared
        shared = null
        return s
    }

    override fun onResume() {
        super.onResume()
        ui.post(pusher)
    }

    override fun onPause() {
        ui.removeCallbacks(pusher)
        super.onPause()
    }

    /** Sends an event to the web UI (AMN.emit). [data] is plain text or a JSON string. */
    fun emit(event: String, data: String) {
        runOnUiThread {
            web.evaluateJavascript("AMN.emit(" + JSONObject.quote(event) + "," + JSONObject.quote(data) + ")", null)
        }
    }

    fun onVideoPicked(pageUrl: String, mediaUrl: String) {
        browser.hide()
        emit("videoPicked", JSONObject().put("pageUrl", pageUrl).put("mediaUrl", mediaUrl).toString())
    }

    fun isNight(): Boolean =
        (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    fun versionName(): String = try {
        packageManager.getPackageInfo(packageName, 0).versionName ?: ""
    } catch (e: Throwable) {
        ""
    }

    /** Matches the status / navigation bars (and the browser's top bar) to the app theme. */
    @Suppress("DEPRECATION")
    fun applyBars(dark: Boolean, bg: String) {
        runOnUiThread {
            val c = try { Color.parseColor(bg) } catch (e: Throwable) { if (dark) Color.BLACK else Color.WHITE }
            window.statusBarColor = c
            window.navigationBarColor = c
            var f = window.decorView.systemUiVisibility
            f = if (dark) {
                f and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv() and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
            } else {
                f or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            }
            window.decorView.systemUiVisibility = f
            browser.applyTheme(dark, c)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (browser.handleBack()) return
        web.evaluateJavascript("(window.AMN && AMN.onBack && AMN.onBack()) ? 'true' : 'false'") { r ->
            if (r != "\"true\"" && r != "true") moveTaskToBack(true)
        }
    }

    override fun onDestroy() {
        ui.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
