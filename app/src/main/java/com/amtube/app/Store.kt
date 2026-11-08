package com.amtube.app

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/** Tiny persistent store: the settings JSON written by the web UI, and the list of downloads. */
object Store {
    private lateinit var prefs: SharedPreferences

    fun init(ctx: Context) {
        prefs = ctx.applicationContext.getSharedPreferences("amtube", Context.MODE_PRIVATE)
    }

    fun settings(): JSONObject = try {
        JSONObject(prefs.getString("settings", "{}") ?: "{}")
    } catch (e: Exception) {
        JSONObject()
    }

    fun saveSettings(json: String) {
        prefs.edit().putString("settings", json).apply()
    }

    fun downloads(): JSONArray = try {
        JSONArray(prefs.getString("downloads", "[]") ?: "[]")
    } catch (e: Exception) {
        JSONArray()
    }

    fun saveDownloads(arr: JSONArray) {
        prefs.edit().putString("downloads", arr.toString()).apply()
    }

    fun bool(key: String, def: Boolean): Boolean = settings().optBoolean(key, def)
    fun int(key: String, def: Int): Int = settings().optInt(key, def)
    fun str(key: String, def: String): String = settings().optString(key, def)
    fun flag(group: String, key: String, def: Boolean): Boolean =
        settings().optJSONObject(group)?.optBoolean(key, def) ?: def
}
