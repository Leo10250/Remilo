package com.remilo.alarm.system

import org.junit.Assert.*
import org.junit.Test

class SoundPreviewControllerTest {
  private class Player(val playing: (String) -> Unit, val ended: (String) -> Unit) : SoundPreviewController.PreviewAudio {
    var started = false
    val stops = mutableListOf<Pair<String, () -> Unit>>()
    override fun start() { started = true }
    override fun stop(reason: String, afterStopped: () -> Unit) { stops.add(reason to afterStopped) }
    fun released() {
      val callbacks = stops.toList(); stops.clear()
      ended(callbacks.lastOrNull()?.first ?: "TimedOut")
      callbacks.forEach { it.second() }
    }
  }
  private class Fixture {
    val queued = ArrayDeque<() -> Unit>()
    val players = mutableListOf<Player>()
    val events = mutableListOf<Map<String, Any>>()
    val controller = SoundPreviewController({ _, playing, ended ->
      Player(playing, ended).also { players.add(it) }
    }, { queued.add(it) }, { events.add(it) })
    fun flush() { while (queued.isNotEmpty()) queued.removeFirst()() }
    fun start(id: String = "a", sound: String = "remilo") {
      controller.start(sound, id, true); flush()
    }
  }

  @Test fun acknowledgmentIsStartingUntilNativePlaybackCallback() {
    val f = Fixture()
    assertEquals("Starting", f.controller.start("system", "a", true)["state"])
    f.flush()
    assertTrue(f.players.single().started)
    assertEquals("Starting", f.controller.snapshot()!!["state"])
    f.players.single().playing("remilo"); f.flush()
    assertEquals("Playing", f.controller.snapshot()!!["state"])
    assertEquals("remilo", f.controller.snapshot()!!["actualSound"])
    assertEquals("system", f.controller.snapshot()!!["sound"])
  }

  @Test fun replacementWaitsForReleaseAndRejectsLateCallbacks() {
    val f = Fixture(); f.start()
    val first = f.players.single()
    f.controller.start("system", "b", true); f.flush()
    assertEquals(1, f.players.size)
    first.playing("remilo"); f.flush()
    assertEquals("Starting", f.controller.snapshot()!!["state"])
    first.released(); f.flush()
    assertEquals(2, f.players.size)
    val second = f.players.last()
    second.playing("system"); f.flush()
    first.ended("Failed"); f.flush()
    assertEquals("b", f.controller.snapshot()!!["requestId"])
    assertEquals("Playing", f.controller.snapshot()!!["state"])
    f.controller.stop("a"); f.flush()
    assertTrue(second.stops.isEmpty())
  }

  @Test fun stopFencesPlaybackAndNativeCutoffIsEnded() {
    val f = Fixture(); f.start()
    val player = f.players.single()
    assertEquals("Ended", f.controller.stop("a")!!["state"])
    player.playing("remilo"); f.flush()
    assertEquals("Ended", f.controller.snapshot()!!["state"])
    player.released(); f.flush()
    f.start("b")
    f.players.last().ended("TimedOut"); f.flush()
    assertEquals("Ended", f.controller.snapshot()!!["state"])
    assertEquals("TimedOut", f.controller.snapshot()!!["reason"])
  }

  @Test fun rapidTripleReplacementCannotOverlapTheRetiringPlayer() {
    val f = Fixture(); f.start()
    val first = f.players.single()
    f.controller.start("system", "b", true)
    f.controller.start("remilo", "c", true); f.flush()
    assertEquals(1, f.players.size)
    first.released(); f.flush()
    assertEquals(2, f.players.size)
    assertEquals("c", f.controller.snapshot()!!["requestId"])
    f.players.last().playing("remilo"); f.flush()
    assertEquals("Playing", f.controller.snapshot()!!["state"])
  }

  @Test fun realAlarmWaitsForAlreadyStoppingAndReplacedPlayers() {
    val f = Fixture(); f.start()
    val old = f.players.single()
    f.controller.start("system", "b", true); f.flush()
    var alarmReady = false
    f.controller.stop(reason = "AlarmActive", afterStopped = { alarmReady = true })
    f.flush()
    assertFalse(alarmReady)
    assertEquals("Interrupted", f.controller.snapshot()!!["state"])
    old.released(); f.flush()
    assertTrue(alarmReady)
    assertEquals(1, f.players.size)
  }

  @Test fun failureInterruptionAndAlarmRejectionRemainTruthful() {
    val f = Fixture(); f.start()
    f.players.single().ended("Interrupted"); f.flush()
    assertEquals("Interrupted", f.controller.snapshot()!!["state"])
    f.start("b"); f.players.last().ended("Failed"); f.flush()
    assertEquals("Failed", f.controller.snapshot()!!["state"])
    val rejected = f.controller.start("system", "c", false)
    f.flush()
    assertEquals("Failed", rejected["state"])
    assertEquals("AlarmActive", rejected["reason"])
    assertEquals(2, f.players.size)
  }

  @Test fun requestRetryDoesNotRestartAndBackgroundStopsPreview() {
    val f = Fixture(); f.start()
    assertEquals("Starting", f.controller.start("remilo", "a", true)["state"])
    f.flush(); assertEquals(1, f.players.size)
    f.controller.stop(reason = "Background")
    assertEquals("Interrupted", f.controller.snapshot()!!["state"])
    assertEquals("Background", f.controller.snapshot()!!["reason"])
    f.players.single().released(); f.flush()
    f.controller.start("remilo", "a", true); f.flush()
    assertEquals(1, f.players.size)
  }
}
