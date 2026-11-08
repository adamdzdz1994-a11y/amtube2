plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.amtube.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.amtube.app"
        minSdk = 29                 // Android 10+: gallery access without storage permissions
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        ndk { abiFilters += listOf("arm64-v8a") }     // 64-bit phones (almost every phone since 2018); keeps the APK small
    }

    buildTypes {
        release { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += "-Xskip-metadata-version-check"      // the engine library is reached by reflection only
    }

    packaging {
        jniLibs { useLegacyPackaging = true }          // yt-dlp / ffmpeg / quickjs are executables stored as native libraries
    }
}

dependencies {
    // yt-dlp + ffmpeg for Android (GPL-3.0). Everything else in the app uses only the Android platform.
    implementation("io.github.junkfood02.youtubedl-android:library:0.18.1")
    implementation("io.github.junkfood02.youtubedl-android:ffmpeg:0.18.1")
    implementation("androidx.webkit:webkit:1.11.0")
}
