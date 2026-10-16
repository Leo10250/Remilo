package com.remilo.alarm.engine

import android.Manifest
import android.app.Application
import android.app.NotificationManager
import android.content.Context
import android.os.UserManager
import com.remilo.alarm.core.RoutinePolicy
import com.remilo.alarm.data.*
import com.remilo.alarm.system.*
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.*
import java.util.TimeZone
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
@Suppress("UNCHECKED_CAST")
class RoutineEngineTest {
  private lateinit var context: Context
  private lateinit var engine: AlarmEngine
  private lateinit var originalZone: TimeZone
  private var now = instant("2026-10-12T07:00:00Z") // Monday
  private var failAt: String? = null
  private val registrations = mutableListOf<AlertRecord>()
  private fun instant(s: String) = Instant.parse(s).toEpochMilli()
  private fun newEngine() = AlarmEngine(context, object : AlarmRegistrar {
    override fun canSchedule() = true
    override fun register(alert: AlertRecord) { registrations.add(alert) }
    override fun cancel(alert: AlertRecord) { }
  }, { now }, { 10000L }, routineCheckpoint = { stage -> if (failAt == stage) { failAt = null; throw IllegalStateException("Simulated process death: $stage") } })
  @Before fun setup() {
    originalZone = TimeZone.getDefault(); TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
    context = RuntimeEnvironment.getApplication()
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    shadowOf(context as Application).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
    context.deleteDatabase("remilo-content.db"); context.createDeviceProtectedStorageContext().deleteDatabase("remilo-operational.db")
    engine = newEngine()
  }
  @After fun teardown() { engine.close(); TimeZone.setDefault(originalZone) }
  private fun <T> request(block: () -> T): T {
    val result = CompletableFuture<T>(); engine.request(block, { result.complete(it as T) }, { result.completeExceptionally(IllegalStateException(it)) })
    return result.get(20, TimeUnit.SECONDS)
  }
  private fun command(input: Map<String, Any?>) = request { engine.apply(input) }
  private fun read(id: String, date: String? = null) = request { engine.routineSession(id, date) }!!
  private fun steps(session: Map<String, Any?>) = session["steps"] as List<Map<String, Any?>>
  private fun page(view: String = "agenda", extra: Map<String, Any?> = emptyMap()) = request { engine.query(mapOf("view" to view) + extra, null) }
  private fun rows(view: String = "agenda", extra: Map<String, Any?> = emptyMap()) = page(view, extra)["items"] as List<Map<String, Any?>>
  private fun recover() { val result = CompletableFuture<Unit>(); engine.recover { result.complete(Unit) }; result.get(20, TimeUnit.SECONDS) }
  private fun restart() { engine.close(); engine = newEngine(); recover() }
  private fun protectedRows() = request { OperationalDatabase.open(context).let { db -> try { db.records().all() } finally { db.close() } } }
  private fun action(session: Map<String, Any?>, kind: String = "SetRoutineExercise", index: Int = 0, done: Boolean = true, operation: String = "$kind:${session["date"]}:${session["revision"]}") = mapOf(
    "kind" to kind, "operationId" to operation, "occurrenceId" to session["occurrenceId"], "date" to session["date"], "expectedRevision" to session["revision"],
    "stepId" to steps(session).getOrNull(index)?.get("id"), "completed" to done)
  private fun create(mode: String = "None", operation: String = "create"): String {
    val result = command(draft(mode) + mapOf("kind" to "CreateRoutine", "operationId" to operation, "startsOn" to "2026-10-12"))
    assertTrue(result.toString(), result["status"] in setOf("Applied", "Blocked"))
    return (result["routine"] as Map<*, *>)["id"] as String
  }
  // Owner's exact 21-exercise week. Fixture only, never installed as user content.
  private fun week(): List<Map<String, Any?>> {
    val days = listOf(
      listOf("Bird-dog|3×10", "Front plank|3×40s", "Side plank|3×25s/side", "Intervals|8×(1 min fast / 1 min slow)"),
      listOf("Incline walk|35 min @ 6–8%"),
      listOf("Lat pulldown|100lb 3×10", "Chest press|80lb 3×10", "Face pull|17.5lb 3×12–15", "Shoulder press|40lb 3×10", "Incline hammer curl|20lb 3×10", "Tricep pulldown|32lb 3×10–12", "Easy jog|10 min"),
      listOf("Bird-dog|3×10", "Front plank|3×30s", "Easy walk|30 min"),
      listOf("Goblet squat|35lb 3×10", "DB bench|30lb 3×10", "DB RDL|25lb 3×10", "1-arm row|3×10", "Easy walk|30 min"),
      listOf("Long walk|60 min"), emptyList())
    return days.mapIndexed { d, names -> mapOf("type" to if (names.isEmpty()) "Rest" else "Exercises", "exercises" to names.mapIndexed { i, text ->
      mapOf("id" to "$d-$i", "name" to text.substringBefore('|'), "target" to text.substringAfter('|'), "notes" to "", "illustration" to "") }) }
  }
  private fun draft(mode: String = "None") = mapOf("title" to "My private weekly routine", "minutes" to 540, "mode" to mode, "listId" to null, "days" to week())

  @Test fun datesRestAndOverdueStayIndependentOfDelivery() {
    val id = create(); val monday = read(id)
    assertEquals(4, steps(monday).size); assertEquals("Bird-dog", steps(monday)[0]["name"])
    command(action(monday)); now = instant("2026-10-12T23:59:59Z")
    assertEquals("InProgress", read(id)["state"])
    val stale = action(read(id), index = 1)
    now++
    now = instant("2026-10-13T00:00:00Z")
    assertEquals("DAY_ENDED", command(stale)["errorCode"])
    val tuesday = read(id); assertEquals("Incline walk", steps(tuesday).single()["name"]); assertEquals(0, tuesday["completedCount"])
    assertEquals("PartiallyCompleted", read(id, "2026-10-12")["state"])
    assertTrue(rows("overdue").isEmpty()); assertTrue(rows().none { (it["routine"] as? Map<*, *>)?.get("date") == "2026-10-12" })
    assertTrue(rows().all { it["overdue"] == false && it["overdueAtMs"] == null })
    now = instant("2026-10-18T12:00:00Z"); assertEquals("Rest", read(id)["state"])
    assertTrue(rows("today").isEmpty()); assertTrue(protectedRows().none { it.nominalSlot?.startsWith("2026-10-18") == true })
    val backup = BackupCodec.decode(request { engine.exportBackup() })
    assertEquals(21, org.json.JSONArray(backup.routineVersions.single().days).let { a -> (0..6).sumOf { a.getJSONObject(it).getJSONArray("exercises").length() } })
    assertEquals("3×10", org.json.JSONArray(backup.routineVersions.single().days).getJSONObject(4).getJSONArray("exercises").getJSONObject(3).getString("target"))
  }
  @Test fun completionRetryUndoAndFinalStepAreTransactional() {
    val id = create(); val first = action(read(id))
    assertEquals("Applied", command(first)["status"]); assertEquals("Applied", command(first)["status"])
    assertEquals(1, read(id)["completedCount"])
    assertEquals("STALE_REVISION", command(first + ("operationId" to "stale"))["errorCode"])
    for (i in 1..3) command(action(read(id), index = i))
    assertEquals("Completed", read(id)["state"]); assertTrue(rows().none { it["id"] == read(id)["occurrenceId"] })
    assertEquals(1, rows("completed").size)
    command(action(read(id), index = 2, done = false))
    assertEquals("InProgress", read(id)["state"]); assertEquals(3, read(id)["completedCount"])
    restart(); assertEquals(3, read(id)["completedCount"])
    val record = rows("today").single()
    assertEquals("ROUTINE_ACTION_REQUIRED", command(mapOf("kind" to "Done", "operationId" to "bypass", "occurrenceId" to record["id"], "expectedRevision" to record["revision"]))["errorCode"])
    assertEquals("ROUTINE_ACTION_REQUIRED", command(mapOf("kind" to "Snooze", "operationId" to "snooze", "occurrenceId" to record["id"], "expectedGeneration" to record["generation"]))["errorCode"])
  }
  @Test fun skipRetainsChecksAndHistoryCorrectionNeverReopensDelivery() {
    val id = create("Notification"); command(action(read(id)))
    command(action(read(id), "SkipRoutineDay")); assertEquals("Skipped", read(id)["state"]); assertEquals(1, read(id)["completedCount"])
    assertTrue(rows("today").isEmpty())
    command(action(read(id), "UndoSkipRoutineDay")); assertEquals("InProgress", read(id)["state"])
    now = instant("2026-10-13T12:00:00Z"); val ended = read(id, "2026-10-12")
    val correction = action(ended, "CorrectRoutineExercise", index = 1)
    command(correction); assertEquals(2, read(id, "2026-10-12")["completedCount"])
    val changes = read(id, "2026-10-12")["changes"] as List<Map<*, *>>
    assertEquals(now, changes.last()["atMs"])
    assertEquals("Expired", protectedRows().single { it.occurrenceId == ended["occurrenceId"] }.state)
    assertEquals("DAY_ENDED", command(action(read(id, "2026-10-12"), "UndoSkipRoutineDay"))["errorCode"])
    assertTrue(rows().none { it["id"] == ended["occurrenceId"] })
    assertEquals(0, read(id)["completedCount"])
  }
  @Test fun repeatedFutureEditsPreserveTodayAndStableIdentities() {
    val id = create(); command(action(read(id)))
    val original = steps(read(id)); val originalSession = read(id)
    val changedDays = week().toMutableList(); val originalMonday = changedDays[0]["exercises"] as List<Map<String,Any?>>
    changedDays[0] = mapOf("type" to "Exercises", "exercises" to originalMonday.reversed().map { it + ("name" to "Renamed ${it["name"]}") })
    changedDays[1] = mapOf("type" to "Exercises", "exercises" to listOf(mapOf("id" to "1-0", "name" to "Changed walk", "target" to "40 min", "notes" to "", "illustration" to "")))
    val preview = request { engine.previewRoutine(draft("Notification") + mapOf("routineId" to id, "startsOn" to "2026-10-12", "minutes" to 600, "days" to changedDays)) }
    assertEquals(instant("2026-10-13T10:00:00Z"), preview["nextAlertMs"])
    fun edit(revision: Int, operation: String) = command(draft() + mapOf("days" to changedDays, "minutes" to 600, "kind" to "EditRoutine", "routineId" to id, "expectedRevision" to revision, "operationId" to operation))
    assertEquals("Applied", edit(1,"edit")["status"]); assertEquals("Applied", edit(2,"edit-again")["status"])
    assertEquals(original, steps(read(id))); assertEquals(originalSession["revision"], read(id)["revision"])
    now = instant("2026-10-13T08:00:00Z")
    assertEquals("Changed walk", steps(read(id)).single()["name"])
    assertEquals("40 min", steps(read(id)).single()["target"])
    assertEquals(original, steps(read(id,"2026-10-12")))
  }
  @Test fun journalRecoversEveryProgressCommitBoundaryAndRetriesBeforeRevisionChecks() {
    val id = create()
    for ((i,stage) in listOf("captured","fenced","before-commit","committed").withIndex()) {
      val captured = action(read(id), index = i, operation = "crash:$stage"); failAt = stage
      try { command(captured); fail("Crash checkpoint did not run") } catch (_: java.util.concurrent.ExecutionException) { }
      restart(); assertEquals(i + 1, read(id)["completedCount"])
      assertEquals("Applied", command(captured)["status"])
      assertEquals(i + 1, read(id)["completedCount"])
    }
    assertEquals("Completed", read(id)["state"])
    assertEquals(4, (read(id)["changes"] as List<*>).size)
  }
  @Test fun backupCopyAndPurgeKeepWholeFamilyIdentityAndProgress() {
    val id = create(); command(action(read(id)))
    val json = request { engine.exportBackup() }; val decoded = BackupCodec.decode(json)
    assertEquals(5, JSONObject(json).getInt("version")); assertEquals(1, decoded.routineSessions.size)
    val restore = request { engine.importBackup(json,listOf(id),"restore-copy") }; assertEquals("Applied",restore["status"])
    assertEquals("Applied", request { engine.importBackup(json,listOf(id),"restore-copy") }["status"])
    val plans = request { engine.queryRoutines() }; assertEquals(2,plans.size)
    val copiedId = plans.first { it["id"] != id }["id"] as String
    assertEquals(1, read(copiedId)["completedCount"])
    assertNotEquals(read(id)["occurrenceId"],read(copiedId)["occurrenceId"])
    val record = rows("today").first { (it["routine"] as Map<*, *>)["routineId"] == id }
    command(mapOf("kind" to "Delete","operationId" to "trash","occurrenceId" to record["id"],"expectedRevision" to record["revision"]))
    val deleted = rows("deleted").single()
    command(mapOf("kind" to "Purge","operationId" to "purge","occurrenceId" to deleted["id"],"expectedRevision" to deleted["revision"]))
    restart(); assertTrue(rows("today").none { it["id"] == record["id"] })
    val after = BackupCodec.decode(request { engine.exportBackup() }); assertTrue(after.routineSessions.none { it.occurrenceId == record["id"] })
    assertTrue(after.purged.any { it.id == record["id"] })
  }
  @Test fun ordinaryModesKeepOverdueSemanticsBesideAnEndedRoutine() {
    val id = create()
    for (mode in listOf("Alarm","Notification","None")) command(mapOf("kind" to "Create","operationId" to mode,"title" to mode,
      "eventStartMs" to now + 3600000,"alarmAtMs" to now + 3600000,"mode" to mode))
    now = instant("2026-10-13T12:00:00Z"); read(id)
    assertEquals(setOf("Alarm","Notification","None"),rows("overdue").map { it["title"] }.toSet())
    assertEquals(3,page("overdue")["total"])
    assertEquals(0,rows("overdue").count { it["routine"] != null })
  }
  @Test fun quietNotificationIsDatedPrivateAndHasNoWholeWorkoutActions() {
    val id = create("Notification"); val saved = read(id)
    val alert = protectedRows().single { it.occurrenceId == saved["occurrenceId"] }
    now = alert.targetMs + 600000 // Routine may arrive late within its original day.
    val delivered = CompletableFuture<Unit>(); engine.receive(AlarmScheduler.intent(context,"fire",alert.occurrenceId,alert.generation)) { delivered.complete(Unit) }; delivered.get(20,TimeUnit.SECONDS)
    val manager = context.getSystemService(NotificationManager::class.java)
    val channel = manager.getNotificationChannel(AlarmNotifications.ROUTINE_CHANNEL)
    assertEquals(NotificationManager.IMPORTANCE_LOW,channel.importance); assertNull(channel.sound); assertFalse(channel.shouldVibrate())
    val notification = manager.activeNotifications.single { it.tag == alert.occurrenceId }.notification
    assertTrue(notification.actions.isNullOrEmpty()); assertTrue(notification.publicVersion.actions.isNullOrEmpty())
    assertEquals(alert.expiresAtMs - now,notification.timeoutAfter)
    assertFalse(notification.publicVersion.extras.toString().contains("My private"))
    assertEquals(0,read(id)["completedCount"])
    now = instant("2026-10-13T00:00:00Z"); recover()
    assertTrue(manager.activeNotifications.none { it.tag == alert.occurrenceId })
  }
  @Test fun directBootMirrorContainsOnlyOperationalRoutineDataAndDoesNotCatchUp() {
    val id = create("Notification"); val session = read(id)
    val bytes = context.createDeviceProtectedStorageContext().getDatabasePath("remilo-operational.db").readBytes().toString(Charsets.ISO_8859_1)
    for (privateText in listOf("My private","Bird-dog","3×40s","Front plank","routine_sessions","routine_operations")) assertFalse(bytes.contains(privateText))
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    now = instant("2026-10-13T12:00:00Z"); restart()
    assertEquals("Expired",protectedRows().single { it.occurrenceId == session["occurrenceId"] }.state)
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true); recover()
    assertEquals("Incline walk",steps(read(id)).single()["name"])
    assertTrue(context.getSystemService(NotificationManager::class.java).activeNotifications.isEmpty())
  }
  @Test fun civilDayPolicyCoversDstClockAndTravelWithoutReopeningEndedDays() {
    val zone = ZoneId.of("America/Los_Angeles")
    assertEquals(23 * 3600000L,RoutinePolicy.end(LocalDate.parse("2026-03-08"),zone)-LocalDate.parse("2026-03-08").atStartOfDay(zone).toInstant().toEpochMilli())
    assertEquals(25 * 3600000L,RoutinePolicy.end(LocalDate.parse("2026-11-01"),zone)-LocalDate.parse("2026-11-01").atStartOfDay(zone).toInstant().toEpochMilli())
    val id = create(); val monday = read(id); now = instant("2026-10-13T00:30:00Z"); assertEquals(true,read(id,"2026-10-12")["ended"])
    now = instant("2026-10-12T23:00:00Z"); assertEquals(true,read(id,"2026-10-12")["ended"])
    assertEquals("DAY_ENDED",command(action(read(id,"2026-10-12")))["errorCode"])
    TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo")); assertTrue(rows().none { it["id"] == monday["occurrenceId"] })
  }
  @Test fun finalExerciseRecoveryFencesDeliveryAtEveryJournalBoundary() {
    for (stage in listOf("captured","fenced","before-commit","committed")) {
      val id = create("Notification", "create:$stage")
      for (i in 0..2) command(action(read(id), index = i, operation = "$stage:$i"))
      val last = action(read(id), index = 3, operation = "$stage:final"); failAt = stage
      try { command(last); fail("Expected simulated interruption") } catch (_: java.util.concurrent.ExecutionException) { }
      restart()
      assertEquals("Completed", read(id)["state"])
      assertEquals("Completed", protectedRows().single { it.occurrenceId == read(id)["occurrenceId"] }.state)
      assertEquals("Applied", command(last)["status"])
      assertEquals(4, (read(id)["changes"] as List<*>).size)
    }
  }
  @Test fun pauseSuppressesNewDatesAndResumeNeverReplaysElapsedPrompts() {
    val id = create("Notification"); val monday = read(id)
    assertEquals("Applied", command(mapOf("kind" to "PauseRoutine","operationId" to "pause","routineId" to id,"expectedRevision" to 1))["status"])
    command(action(read(id))) // Existing Monday can finish while paused.
    assertEquals(1,read(id)["completedCount"])
    now = instant("2026-10-13T12:00:00Z"); recover()
    assertEquals("Paused", read(id)["state"]); assertNull(read(id)["occurrenceId"])
    assertTrue(rows("today").isEmpty())
    assertEquals("Applied", command(mapOf("kind" to "ResumeRoutine","operationId" to "resume","routineId" to id,"expectedRevision" to 2))["status"])
    assertEquals("Incline walk",steps(read(id)).single()["name"])
    assertEquals("Available",protectedRows().single { it.occurrenceId == read(id)["occurrenceId"] }.state)
    assertEquals("PartiallyCompleted",read(id,"2026-10-12")["state"])
    assertTrue(context.getSystemService(NotificationManager::class.java).activeNotifications.isEmpty())
    assertNotEquals(monday["occurrenceId"],read(id)["occurrenceId"])
  }
  @Test fun creatingAfterTodaysTimeIsAvailableAndNormalPaginationExcludesEndedDays() {
    now = instant("2026-10-12T15:00:00Z"); val id = create("Notification")
    val session = read(id); assertEquals("Ready",session["state"])
    assertEquals("Available",protectedRows().single { it.occurrenceId == session["occurrenceId"] }.state)
    assertTrue(context.getSystemService(NotificationManager::class.java).activeNotifications.isEmpty())
    for (i in 0..54) command(mapOf("kind" to "Create","operationId" to "ordinary:$i","title" to "Mixed $i","mode" to "None", "eventStartMs" to now + i * 1000L))
    now = instant("2026-10-13T12:00:00Z")
    val first = page(); val second = request { engine.query(mapOf("view" to "agenda"), first["nextCursor"] as String) }
    val all = (first["items"] as List<Map<*, *>>) + (second["items"] as List<Map<*, *>>)
    assertEquals(first["total"],all.size); assertEquals(all.size,all.map { it["id"] }.distinct().size)
    assertTrue(all.none { it["id"] == session["occurrenceId"] })
    assertEquals(55,page("overdue")["total"])
    assertTrue(rows("today",mapOf("search" to "My private" )).all { it["routine"] != null })
  }
  @Test fun channelDenialExpiryTrashRestoreAndCalendarGuardsAreNative() {
    val id = create("Notification"); val session = read(id)
    val manager = context.getSystemService(NotificationManager::class.java)
    shadowOf(manager).setNotificationsEnabled(false)
    recover(); val record = rows("today").single()
    assertEquals("Blocked",record["deliveryState"]); assertEquals(0,read(id)["completedCount"])
    assertEquals("INELIGIBLE", request { ContentDatabase.open(context).let { db -> try {
      com.remilo.alarm.calendar.CalendarStore(db, { now }).preview(id); "Unexpected publication"
    } catch (error: com.remilo.alarm.calendar.CalendarFailure) { error.code } finally { db.close() } } })
    command(mapOf("kind" to "Delete","operationId" to "trash-day","occurrenceId" to record["id"],"expectedRevision" to record["revision"]))
    assertTrue(rows("today").isEmpty()); assertEquals("Deleted",protectedRows().single { it.occurrenceId == record["id"] }.state)
    now = instant("2026-10-13T12:00:00Z"); val trashed = rows("deleted").single()
    command(mapOf("kind" to "UndoDelete","operationId" to "restore-ended","occurrenceId" to trashed["id"],"expectedRevision" to trashed["revision"]))
    assertTrue(rows().none { it["id"] == session["occurrenceId"] })
    assertTrue(manager.activeNotifications.isEmpty())
  }
  @Test fun directBootClosureSurvivesClockRewindBeforeFirstUnlock() {
    val id = create("Notification"); val monday = read(id)
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    now = instant("2026-10-13T01:00:00Z"); restart()
    val closed = protectedRows().single { it.occurrenceId == monday["occurrenceId"] }; assertTrue(closed.dayEnded)
    now = instant("2026-10-12T08:00:00Z"); restart()
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true); recover()
    assertEquals(true,read(id)["ended"])
    assertEquals("DAY_ENDED",command(action(read(id)))["errorCode"])
    assertTrue(rows("today").isEmpty())
    assertEquals("Expired",protectedRows().single { it.occurrenceId == monday["occurrenceId"] }.state)
  }
  @Test fun correctingAllChecksOnASkippedDayRetainsShowSkippedSemantics() {
    val id = create(); command(action(read(id),"SkipRoutineDay"))
    now = instant("2026-10-13T12:00:00Z")
    for(i in 0..3) command(action(read(id,"2026-10-12"),"CorrectRoutineExercise",index = i))
    val monday = read(id,"2026-10-12")
    assertEquals("Skipped",monday["state"]); assertEquals(4,monday["completedCount"]); assertEquals(false,monday["completed"])
    assertTrue(rows("completed").isEmpty())
    assertEquals(1,rows("completed",mapOf("includeSkipped" to true)).size)
    BackupCodec.decode(request { engine.exportBackup() })
  }
  @Test fun pausingAfterTheTargetFencesADelayedCallbackAndClockChangesStillBackUp() {
    val id = create("Notification"); val monday = read(id)
    val original = protectedRows().single { it.occurrenceId == monday["occurrenceId"] }
    now = instant("2026-10-12T10:00:00Z")
    command(mapOf("kind" to "PauseRoutine","operationId" to "late-pause","routineId" to id,"expectedRevision" to 1))
    val delivered = CompletableFuture<Unit>(); engine.receive(AlarmScheduler.intent(context,"fire",original.occurrenceId,original.generation)) { delivered.complete(Unit) }; delivered.get(20,TimeUnit.SECONDS)
    assertTrue(context.getSystemService(NotificationManager::class.java).activeNotifications.isEmpty())
    assertEquals("Paused", protectedRows().single { it.occurrenceId == original.occurrenceId }.state)
    now = instant("2026-10-12T08:00:00Z")
    command(mapOf("kind" to "ResumeRoutine","operationId" to "rewound-resume","routineId" to id,"expectedRevision" to 2))
    assertEquals(0,read(id)["completedCount"])
    BackupCodec.decode(request { engine.exportBackup() })
  }
  @Test fun invalidRoutineDraftsRejectBeforeCreatingAnyState() {
    val invalid = listOf(draft() + ("startsOn" to "2026-13-12"), draft() + ("startsOn" to 123),
      draft() + mapOf("startsOn" to "2026-10-12", "days" to week().mapIndexed { i, d -> if(i == 0) mapOf("type" to "Exercises","exercises" to emptyList<Any>()) else d }),
      draft() + mapOf("startsOn" to "2026-10-12", "mode" to "Alarm"))
    invalid.forEachIndexed { index, value -> assertEquals("Rejected",command(value + mapOf("kind" to "CreateRoutine", "operationId" to "invalid:$index"))["status"]) }
    assertTrue(request { engine.queryRoutines() }.isEmpty()); assertTrue(protectedRows().isEmpty())
  }
  @Test fun onePromptPerDateSurvivesPauseResumeAndClockRewind() {
    val id = create("Notification"); val monday = read(id)
    fun fire(alert: AlertRecord) { val result = CompletableFuture<Unit>(); engine.receive(AlarmScheduler.intent(context,"fire",alert.occurrenceId,alert.generation)) { result.complete(Unit) }; result.get(20,TimeUnit.SECONDS) }
    val original = protectedRows().single { it.occurrenceId == monday["occurrenceId"] }; now = original.targetMs; fire(original)
    assertTrue(protectedRows().single { it.occurrenceId == original.occurrenceId }.prompted)
    command(mapOf("kind" to "PauseRoutine","operationId" to "once-pause","routineId" to id,"expectedRevision" to 1))
    now = instant("2026-10-12T08:00:00Z")
    command(mapOf("kind" to "ResumeRoutine","operationId" to "once-resume","routineId" to id,"expectedRevision" to 2))
    restart(); val resumed = protectedRows().single { it.occurrenceId == original.occurrenceId }
    assertTrue(resumed.prompted); assertEquals("Available",resumed.state)
    now = original.targetMs; fire(resumed)
    assertTrue(context.getSystemService(NotificationManager::class.java).activeNotifications.isEmpty())
    assertEquals(0,read(id)["completedCount"])
  }
}
