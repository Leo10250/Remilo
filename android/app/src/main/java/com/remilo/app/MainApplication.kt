package com.remilo.app

import android.app.Application
import android.content.res.Configuration
import android.os.UserManager
import android.util.Log

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  private var uiInitialized = false
  override val reactHost: ReactHost by lazy {
    initializeUi()
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Direct Boot/alarm startup must not initialize the product UI.
    Log.i("Remilo", "Application startup: native components only")
  }

  @Synchronized fun initializeUi() {
    check(getSystemService(UserManager::class.java).isUserUnlocked)
    if (uiInitialized) return
    Log.i("Remilo", "Initializing product UI runtime")
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
    uiInitialized = true
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    if (uiInitialized) ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
