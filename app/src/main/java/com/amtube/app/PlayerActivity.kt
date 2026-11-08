package com.amtube.app

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.util.Rational
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.MediaController
import android.widget.TextView
import android.widget.VideoView

/** Plays a downloaded file. Video can float (picture-in-picture); any file can continue as background audio. */
class PlayerActivity : Activity() {
    private lateinit var video: VideoView
    private lateinit var controls: LinearLayout
    private var uriText = ""
    private var titleText = ""
    private var isAudio = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        uriText = intent.getStringExtra("uri") ?: ""
        titleText = intent.getStringExtra("title") ?: ""
        isAudio = intent.getBooleanExtra("audio", false)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val root = FrameLayout(this)
        root.setBackgroundColor(Color.BLACK)
        video = VideoView(this)
        root.addView(video, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.CENTER))
        val mc = MediaController(this)
        mc.setAnchorView(video)
        video.setMediaController(mc)

        controls = LinearLayout(this)
        controls.orientation = LinearLayout.HORIZONTAL
        controls.gravity = Gravity.CENTER_VERTICAL
        val pad = (12 * resources.displayMetrics.density).toInt()
        controls.setPadding(pad, pad, pad, pad)
        val title = TextView(this)
        title.text = titleText
        title.setTextColor(Color.WHITE)
        title.typeface = Typeface.DEFAULT_BOLD
        title.maxLines = 1
        title.ellipsize = android.text.TextUtils.TruncateAt.END
        controls.addView(title, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        controls.addView(pill(getString(R.string.player_background)) { toBackground() })
        if (!isAudio) controls.addView(pill(getString(R.string.player_float)) { enterPip() })
        root.addView(controls, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP))
        setContentView(root)

        video.setVideoURI(Uri.parse(uriText))
        video.setOnPreparedListener { video.start() }
        video.setOnCompletionListener { if (!isInPictureInPictureMode) mc.show(0) }
    }

    private fun pill(text: String, onClick: () -> Unit): TextView {
        val t = TextView(this)
        t.text = text
        t.setTextColor(Color.BLACK)
        t.setBackgroundColor(Color.parseColor("#FFC400"))
        val d = resources.displayMetrics.density
        t.setPadding((12 * d).toInt(), (7 * d).toInt(), (12 * d).toInt(), (7 * d).toInt())
        t.setOnClickListener { onClick() }
        val lp = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        lp.marginStart = (8 * d).toInt()
        t.layoutParams = lp
        return t
    }

    private fun enterPip() {
        try {
            enterPictureInPictureMode(PictureInPictureParams.Builder().setAspectRatio(Rational(16, 9)).build())
        } catch (e: Throwable) { }
    }

    private fun toBackground() {
        val pos = if (video.isPlaying || video.currentPosition > 0) video.currentPosition else 0
        val i = Intent(this, PlaybackService::class.java).putExtra("uri", uriText).putExtra("title", titleText).putExtra("pos", pos)
        try { startForegroundService(i) } catch (e: Throwable) { }
        finish()
    }

    override fun onUserLeaveHint() {
        if (isAudio) toBackground() else if (video.isPlaying) enterPip()
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        controls.visibility = if (isInPictureInPictureMode) View.GONE else View.VISIBLE
    }

    companion object {
        fun start(ctx: Context, uri: String, title: String, audio: Boolean) {
            ctx.startActivity(Intent(ctx, PlayerActivity::class.java).putExtra("uri", uri).putExtra("title", title).putExtra("audio", audio))
        }
    }
}
