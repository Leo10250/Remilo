package com.remilo.alarm.system

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.VibratorManager
import android.os.VibrationEffect
import com.remilo.alarm.R
import android.os.Handler
import android.os.HandlerThread
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import com.remilo.alarm.core.AlarmPolicy

/** Shutdown never waits for Room, JavaScript, or a wall-clock alarm. */
internal class AlarmAudio(context: Context, private val started: (Long) -> Unit,
  private val ended: (String) -> Unit, private val sound: String = "remilo",
  private val vibration: Boolean = false, private val durationMillis: Long = AlarmPolicy.SESSION_MILLIS) {
  private val context = context.applicationContext
  private val thread = HandlerThread("Remilo-audio").apply { start() }
  private val handler = Handler(thread.looper)
  private val manager = context.getSystemService(AudioManager::class.java)
  private val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
  private val wake = context.getSystemService(PowerManager::class.java)
    .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Remilo:ringing")
  private var player: MediaPlayer? = null
  private var deadline = 0L
  private var finished = false
  private val vibrator = context.getSystemService(VibratorManager::class.java).defaultVibrator
  private fun vibrate() {
    if (vibration) try { vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 500, 1000), 0)) }
    catch (_: Exception) { Log.w("Remilo", "Vibration unavailable") }
  }
  private val focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    .setAudioAttributes(attributes).setOnAudioFocusChangeListener({ change ->
      if (!finished) when (change) {
        AudioManager.AUDIOFOCUS_LOSS -> finish("Interrupted")
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
          player?.pause(); vibrator.cancel()
        }
        AudioManager.AUDIOFOCUS_GAIN -> if (deadline > SystemClock.elapsedRealtime()) {
          try { player?.start(); vibrate() } catch (_: Exception) { finish("Failed") }
        } else finish("TimedOut")
      }
    }, handler).build()
  fun start() { handler.post {
    if (finished || player != null) return@post
    try {
      wake.acquire(durationMillis + 10_000L)
      if (manager.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
        finish("Interrupted"); return@post
      }
      val media = MediaPlayer()
      player = media
      media.setAudioAttributes(attributes)
      var systemSource = false
      if (sound == "system") try {
        media.setDataSource(context, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
        systemSource = true
      } catch (_: Exception) {
        media.reset(); media.setAudioAttributes(attributes)
        Log.w("Remilo", "System tone unavailable; using packaged alarm tone")
      }
      if (!systemSource) context.resources.openRawResourceFd(R.raw.remilo_alarm).use { source ->
        media.setDataSource(source.fileDescriptor, source.startOffset, source.length)
      }
      media.isLooping = true
      media.setOnErrorListener { _, _, _ -> finish("Failed"); true }
      media.prepare()
      media.start()
      vibrate()
      val elapsed = SystemClock.elapsedRealtime()
      deadline = elapsed + durationMillis
      started(elapsed)
      handler.postDelayed({ finish("TimedOut") }, durationMillis)
    } catch (_: Exception) { finish("Failed") }
  } }
  fun stop(reason: String = "Stopped") { handler.post { finish(reason) } }
  private fun finish(reason: String) {
    if (finished) return
    finished = true
    Log.i("Remilo", "Playback stopped: reason=$reason elapsed=${SystemClock.elapsedRealtime()} deadline=$deadline")
    handler.removeCallbacksAndMessages(null)
    try { player?.release() } finally { player = null }
    manager.abandonAudioFocusRequest(focus)
    vibrator.cancel()
    if (wake.isHeld) wake.release()
    ended(reason)
    thread.quitSafely()
  }
}
