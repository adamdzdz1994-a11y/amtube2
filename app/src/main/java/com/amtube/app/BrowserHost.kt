package com.amtube.app

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PorterDuff
import android.net.Uri
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

/**
 * The in-app browser: an address bar over a WebView.
 *  - blocks ad requests (AdBlock) and runs the YouTube ad blocker script (switchable in Settings),
 *  - shows a round download button on playing videos (pill.js) that opens the quality list in the app.
 */
class BrowserHost(private val act: MainActivity, private val parent: FrameLayout) {
    private val panel = LinearLayout(act)
    private val field = EditText(act)
    private val progress = ProgressBar(act, null, android.R.attr.progressBarStyleHorizontal)
    private val buttons = ArrayList<ImageButton>()
    val web = WebView(act)

    private val ytJs: String = act.assets.open("adblock/ytblock.js").bufferedReader().use { it.readText() }
    private val pillJs: String = act.assets.open("adblock/pill.js").bufferedReader().use { it.readText() }
    private val handlers = ArrayList<ScriptHandler>()
    private var docStart = false
    private var accent = "#FFC400"

    private fun dp(n: Int) = (n * act.resources.displayMetrics.density).toInt()

    inner class PageBridge {
        @JavascriptInterface
        fun onVideo(pageUrl: String, mediaUrl: String) {
            act.runOnUiThread { act.onVideoPicked(pageUrl, mediaUrl) }
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    private fun build() {
        panel.orientation = LinearLayout.VERTICAL
        panel.visibility = View.GONE
        panel.isClickable = true

        val bar = LinearLayout(act)
        bar.orientation = LinearLayout.HORIZONTAL
        bar.gravity = Gravity.CENTER_VERTICAL
        bar.setPadding(dp(4), dp(4), dp(4), dp(4))

        fun button(res: Int, onClick: () -> Unit): ImageButton {
            val b = ImageButton(act)
            b.setImageResource(res)
            b.setBackgroundColor(Color.TRANSPARENT)
            b.setPadding(dp(10), dp(10), dp(10), dp(10))
            b.setOnClickListener { onClick() }
            buttons.add(b)
            return b
        }
        bar.addView(button(R.drawable.ic_back) { if (web.canGoBack()) web.goBack() else close() }, LinearLayout.LayoutParams(dp(44), dp(44)))
        field.setSingleLine(true)
        field.imeOptions = EditorInfo.IME_ACTION_GO
        field.inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
        field.setOnEditorActionListener { _, _, _ -> load(field.text.toString()); true }
        bar.addView(field, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        bar.addView(button(R.drawable.ic_reload) { web.reload() }, LinearLayout.LayoutParams(dp(44), dp(44)))
        bar.addView(button(R.drawable.ic_close) { close() }, LinearLayout.LayoutParams(dp(44), dp(44)))
        panel.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        progress.max = 100
        progress.visibility = View.GONE
        panel.addView(progress, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)))
        panel.addView(web, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        val s = web.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.allowFileAccess = false
        s.allowContentAccess = false
        s.javaScriptCanOpenWindowsAutomatically = false     // no pop-up ads
        s.setSupportMultipleWindows(false)
        s.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        s.mediaPlaybackRequiresUserGesture = false
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)
        web.addJavascriptInterface(PageBridge(), "AMPage")

        web.webChromeClient = object : android.webkit.WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val yt = Store.flag("adblock", "youtube", true)
                val wb = Store.flag("adblock", "web", false)
                return if ((yt || wb) && AdBlock.shouldBlock(request.url, yt, wb)) AdBlock.empty() else null
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val scheme = request.url.scheme ?: ""
                return !(scheme == "http" || scheme == "https")     // never jump to other apps / stores
            }

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                field.setText(url)
                if (!docStart) injectYoutube(view, url)
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (!docStart) injectYoutube(view, url)
                view.evaluateJavascript(config() + pillJs, null)
            }
        }
        parent.addView(panel, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }

    init {
        build()
    }

    private fun config(): String {
        val yt = Store.flag("adblock", "youtube", true)
        val c = JSONObject()
            .put("yt", yt)
            .put("prune", Store.flag("adblock", "prune", true))
            .put("css", Store.flag("adblock", "css", true))
            .put("skip", Store.flag("adblock", "skip", true))
            .put("accent", Store.settings().optString("accent", "#FFC400"))
            .put("onAccent", "#111111")
        accent = c.getString("accent")
        return "window.__AMT=" + c.toString() + ";"
    }

    private fun injectYoutube(view: WebView, url: String) {
        if (url.contains("youtube.com")) view.evaluateJavascript(config() + ytJs, null)
    }

    /** Registers the YouTube script to run before the page's own scripts (needs a recent WebView; otherwise falls back). */
    private fun registerScripts() {
        for (h in handlers) try { h.remove() } catch (e: Throwable) { }
        handlers.clear()
        docStart = false
        try {
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                handlers.add(
                    WebViewCompat.addDocumentStartJavaScript(web, config() + ytJs, setOf("https://*.youtube.com", "https://youtube.com"))
                )
                docStart = true
            }
        } catch (e: Throwable) {
            docStart = false
        }
    }

    private fun load(input: String) {
        val s = input.trim()
        if (s.isEmpty()) return
        val url = when {
            s.startsWith("http://") || s.startsWith("https://") -> s
            s.contains(" ") || !s.contains(".") -> "https://m.youtube.com/results?search_query=" + Uri.encode(s)
            else -> "https://$s"
        }
        web.loadUrl(url)
    }

    fun open(url: String) {
        registerScripts()
        panel.visibility = View.VISIBLE
        load(url)
    }

    fun show() { panel.visibility = View.VISIBLE }

    /** Hides the browser (e.g. while the quality list is shown) and silences the page. */
    fun hide() {
        web.evaluateJavascript("document.querySelectorAll('video,audio').forEach(function(v){try{v.pause()}catch(e){}})", null)
        panel.visibility = View.GONE
    }

    fun close() {
        panel.visibility = View.GONE
        web.loadUrl("about:blank")
        web.clearHistory()
    }

    fun isVisible(): Boolean = panel.visibility == View.VISIBLE

    fun handleBack(): Boolean {
        if (!isVisible()) return false
        if (web.canGoBack()) web.goBack() else close()
        return true
    }

    fun applyTheme(dark: Boolean, bg: Int) {
        panel.setBackgroundColor(bg)
        val fg = if (dark) Color.WHITE else Color.parseColor("#171A22")
        field.setTextColor(fg)
        field.setHintTextColor(Color.GRAY)
        for (b in buttons) b.setColorFilter(fg, PorterDuff.Mode.SRC_ATOP)
    }
}
