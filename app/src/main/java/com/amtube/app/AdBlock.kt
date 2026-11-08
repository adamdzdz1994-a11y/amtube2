package com.amtube.app

import android.net.Uri
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream

/** Request filter for the in-app browser. The page-level YouTube tricks live in assets/adblock/ytblock.js. */
object AdBlock {
    // Ad networks that are ads on every site (blocked together with the YouTube blocker).
    private val adNetworks = listOf(
        "doubleclick.net", "googlesyndication.com", "googleadservices.com", "adservice.google.com",
        "imasdk.googleapis.com", "2mdn.net", "moatads.com", "ads.youtube.com", "static.doubleclick.net"
    )

    // Extra networks blocked only when "block ads on other websites" is on.
    private val webAdNetworks = listOf(
        "adnxs.com", "taboola.com", "outbrain.com", "popads.net", "popcash.net", "propellerads.com", "exoclick.com",
        "juicyads.com", "adsterra.com", "onclickads.net", "mgid.com", "revcontent.com", "pubmatic.com",
        "rubiconproject.com", "openx.net", "criteo.com", "amazon-adsystem.com", "adsrvr.org", "smartadserver.com"
    )

    // Paths that only exist for ads on YouTube hosts.
    private val youtubeAdPaths = listOf("/pagead/", "/api/stats/ads", "/ptracking", "/get_midroll_info", "/youtubei/v1/player/ad_break")

    private fun hostMatches(host: String, list: List<String>): Boolean =
        list.any { host == it || host.endsWith(".$it") }

    fun shouldBlock(uri: Uri, youtube: Boolean, web: Boolean): Boolean {
        val host = (uri.host ?: return false).lowercase()
        if (youtube) {
            if (hostMatches(host, adNetworks)) return true
            if (host == "youtube.com" || host.endsWith(".youtube.com")) {
                val path = uri.path ?: ""
                if (youtubeAdPaths.any { path.contains(it) }) return true
            }
        }
        if (web && (hostMatches(host, webAdNetworks) || hostMatches(host, adNetworks))) return true
        return false
    }

    fun empty(): WebResourceResponse =
        WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))
}
