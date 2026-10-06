package com.remilo.alarm.system

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Bundle

/** All state transitions run on the engine executor; audio owns its cutoff. */
internal class SoundPreviewController(
  private val audioFactory: (String, (String) -> Unit, (String) -> Unit) -> PreviewAudio,
  private val enqueue: (() -> Unit) -> Unit,
  private val onChanged: (Map<String, Any>) -> Unit,
) : AutoCloseable {
  internal interface PreviewAudio {
    fun start()
    fun stop(reason: String, afterStopped: () -> Unit)
  }
  private data class Request(val id: String, val sound: String, var state: String = "Starting",
    var actualSound: String? = null, var reason: String? = null, var audio: PreviewAudio? = null) {
    fun snapshot(): Map<String, Any> = buildMap {
      put("requestId", id); put("sound", sound); put("state", state)
      actualSound?.let { put("actualSound", it) }; reason?.let { put("reason", it) }
    }
    fun active() = state == "Starting" || state == "Playing"
  }
  private var current: Request? = null
  private val players = mutableSetOf<PreviewAudio>()
  private var application: Application? = null
  private var lifecycle: Application.ActivityLifecycleCallbacks? = null
  private var closed = false

  constructor(context: Context, enqueue: (() -> Unit) -> Unit, onChanged: (Map<String, Any>) -> Unit) :
    this({ sound, playing, ended ->
      object : PreviewAudio {
        private val audio = AlarmAudio(context, {}, ended, sound = sound, durationMillis = 5_000L,
          actualStarted = playing, interruptOnFocusLoss = true)
        override fun start() = audio.start()
        override fun stop(reason: String, afterStopped: () -> Unit) = audio.stop(reason, afterStopped)
      }
    }, enqueue, onChanged) {
    application = context.applicationContext as? Application
    lifecycle = object : Application.ActivityLifecycleCallbacks {
      private var startedActivities = 0
      override fun onActivityStarted(activity: Activity) { startedActivities++ }
      override fun onActivityStopped(activity: Activity) {
        startedActivities = (startedActivities - 1).coerceAtLeast(0)
        if (startedActivities == 0 && !activity.isChangingConfigurations) enqueue {
          if (!closed) stop(reason = "Background")
        }
      }
      override fun onActivityCreated(activity: Activity, state: Bundle?) = Unit
      override fun onActivityResumed(activity: Activity) = Unit
      override fun onActivityPaused(activity: Activity) = Unit
      override fun onActivitySaveInstanceState(activity: Activity, state: Bundle) = Unit
      override fun onActivityDestroyed(activity: Activity) = Unit
    }
    application?.registerActivityLifecycleCallbacks(lifecycle)
  }

  fun start(sound: String, requestId: String, canPlay: Boolean): Map<String, Any> {
    require(sound == "remilo" || sound == "system")
    require(requestId.isNotBlank() && requestId.length <= 200)
    check(!closed)
    // A retried start owns the same request. It must not restart an ended preview.
    current?.takeIf { it.id == requestId }?.let {
      require(it.sound == sound)
      return it.snapshot()
    }
    val request = Request(requestId, sound)
    current = request
    if (!canPlay) {
      request.state = "Failed"; request.reason = "AlarmActive"; publish(request)
      players.toList().forEach { release(it, "AlarmActive") {} }
      return request.snapshot()
    }
    publish(request)
    val begin = {
      enqueue {
        if (!closed && current === request && request.active()) {
          try {
            val audio = audioFactory(sound, { actual -> enqueue {
              if (current === request && request.active()) {
                request.state = "Playing"; request.actualSound = actual; publish(request)
              }
            } }, { reason -> enqueue {
              request.audio?.let { players.remove(it) }
              if (current === request && request.active()) finish(request, reason)
            } })
            request.audio = audio
            players.add(audio)
            audio.start()
          } catch (_: Exception) { finish(request, "Failed") }
        }
      }
    }
    // Release the previous player before creating its replacement. Late callbacks
    // retain their request object and cannot change the new preview.
    val retiring = players.toList()
    if (retiring.isEmpty()) begin() else {
      var remaining = retiring.size
      retiring.forEach { release(it, "Replaced") { if (--remaining == 0) begin() } }
    }
    return request.snapshot()
  }

  fun snapshot(): Map<String, Any>? = current?.snapshot()

  fun stop(requestId: String? = null, reason: String = "Stopped", afterStopped: () -> Unit = {}): Map<String, Any>? {
    val request = current
    if (requestId != null && request?.id != requestId) {
      afterStopped(); return snapshot()
    }
    // Set terminal state immediately to fence queued Playing/Ended callbacks.
    if (request?.active() == true) finish(request, reason)
    val stopping = if (requestId == null) players.toList() else listOfNotNull(request?.audio).filter { it in players }
    if (stopping.isEmpty()) afterStopped() else {
      var remaining = stopping.size
      stopping.forEach { release(it, reason) { if (--remaining == 0) afterStopped() } }
    }
    return request?.snapshot()
  }

  private fun release(audio: PreviewAudio, reason: String, ready: () -> Unit) {
    audio.stop(reason) { enqueue { players.remove(audio); ready() } }
  }

  private fun finish(request: Request, reason: String) {
    request.state = when (reason) {
      "Failed" -> "Failed"
      "Interrupted", "Background", "AlarmActive", "Replaced" -> "Interrupted"
      else -> "Ended"
    }
    request.reason = reason
    publish(request)
  }
  private fun publish(request: Request) { onChanged(request.snapshot()) }

  override fun close() {
    closed = true
    lifecycle?.let { application?.unregisterActivityLifecycleCallbacks(it) }
    lifecycle = null; application = null
    stop(reason = "Interrupted")
  }
}
