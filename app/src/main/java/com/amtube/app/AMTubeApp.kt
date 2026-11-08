package com.amtube.app

import android.app.Application

class AMTubeApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Store.init(this)
        Downloads.init(this)
        Engine.start(this)
    }
}
