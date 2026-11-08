package com.amtube.app

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.MediaPlayer
import android.net.Uri
import android.os.IBinder

/** Keeps playing audio after you leave the player (screen off, other apps in front). */
class PlaybackService : Service() {
    private var player: MediaPlayer? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val cmd = intent ?: return START_NOT_STICKY
        if (cmd.action == "stop") {
            stopSelf()
            return START_NOT_STICKY
        }
        val uri = cmd.getStringExtra("uri") ?: return START_NOT_STICKY
        val title = cmd.getStringExtra("title") ?: ""
        val pos = cmd.getIntExtra("pos", 0)
        Notes.channels(this)
        val stop = PendingIntent.getService(this, 1, Intent(this, PlaybackService::class.java).setAction("stop"), PendingIntent.FLAG_IMMUTABLE)
        val n = Notification.Builder(this, Notes.CH_PLAY).setSmallIcon(R.drawable.ic_stat_dl).setContentTitle(title)
            .setContentText(getString(R.string.player_playing)).setOngoing(true).setContentIntent(Notes.openApp(this))
            .addAction(Notification.Action.Builder(null, getString(R.string.player_stop), stop).build()).build()
        startForeground(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        player?.release()
        player = MediaPlayer().apply {
            setDataSource(this@PlaybackService, Uri.parse(uri))
            setOnPreparedListener { mp -> mp.seekTo(pos); mp.start() }
            setOnCompletionListener { stopSelf() }
            prepareAsync()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        player?.release()
        player = null
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).cancel(NID)
        super.onDestroy()
    }

    companion object {
        const val NID = 1002
    }
}
