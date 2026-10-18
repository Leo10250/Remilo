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
  private var exactAllowed = true
  private var registrationFails = false
  private val registrations = mutableListOf<AlertRecord>()
  private fun instant(s: String) = Instant.parse(s).toEpochMilli()
  private fun newEngine() = AlarmEngine(context, object : AlarmRegistrar {
    override fun canSchedule() = exactAllowed
    override fun register(alert: AlertRecord) { if (registrationFails) throw IllegalStateException("registration unavailable"); registrations.add(alert) }
    override fun cancel(alert: AlertRecord) { }
  }, { now }, { 10000L }, routineCheckpoint = { stage -> if (failAt == stage) { failAt = null; throw IllegalStateException("Simulated process death: $stage") } }, routineAlertCheckpoint = { stage -> if (failAt == stage) { failAt = null; throw IllegalStateException("Simulated process death: $stage") } })
  @Before fun setup() {
    originalZone = TimeZone.getDefault(); TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
    context = RuntimeEnvironment.getApplication()
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    shadowOf(context as Application).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
    context.deleteDatabase("remilo-content.db"); context.createDeviceProtectedStorageContext().deleteDatabase("remilo-operational.db")
    context.getSharedPreferences("remilo-widgets-v1", Context.MODE_PRIVATE).edit().clear().commit()
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
  @Test fun sharedRoutineMetadataPreservesCheckedIdsAndFrozenPresentationAcrossImmediateEdits() {
    val sharedDays: List<Map<String,Any?>> = (0..6).map { d ->
      val steps: List<Map<String,String>> = if(d < 2) listOf("read","plan").map { key -> mapOf("id" to "$d-$key", "sharedStepId" to key, "name" to "Same name", "target" to "10 minutes", "notes" to "") } else emptyList()
      mapOf("type" to (if(d < 2) "Exercises" else "Rest"), "exercises" to steps)
    }
    val content = draft() + mapOf("days" to sharedDays,"authoringMode" to "Shared","presentationPreset" to "General")
    val result = command(content + mapOf("kind" to "CreateRoutine","operationId" to "shared-create","startsOn" to "2026-10-12"))
    val id = (result["routine"] as Map<*,*>)["id"] as String
    val monday = read(id); assertEquals("General",monday["presentationPreset"])
    command(action(monday, operation = "shared-check"))
    val changed = sharedDays.map { day -> day + ("exercises" to (day["exercises"] as List<Map<String,Any?>>).map { it + ("target" to "20 minutes") }) }
    command(content + mapOf("days" to changed,"kind" to "EditRoutine","routineId" to id,"expectedRevision" to 1,"operationId" to "shared-edit"))
    assertEquals(1,read(id)["completedCount"]); assertEquals("0-read",steps(read(id))[0]["id"])
    assertEquals("20 minutes",steps(read(id))[0]["target"])
    now = instant("2026-10-13T07:00:00Z"); recover()
    command(content + mapOf("presentationPreset" to "Exercise","kind" to "EditRoutine","routineId" to id,"expectedRevision" to 2,"operationId" to "preset-edit"))
    assertEquals("Exercise",read(id)["presentationPreset"])
    assertEquals("General",read(id,"2026-10-12")["presentationPreset"])
    assertEquals(1,read(id,"2026-10-12")["completedCount"])
    val backup = request { engine.exportBackup() }
    assertEquals(8,JSONObject(backup).getInt("version"))
    val bundle = BackupCodec.decode(backup)
    assertEquals(setOf("General","Exercise"),bundle.routineVersions.map { it.presentationPreset }.toSet())
    val broken = JSONObject(backup)
    broken.getJSONArray("routineVersions").getJSONObject(0).getJSONArray("days").getJSONObject(1)
      .getJSONArray("exercises").getJSONObject(0).put("sharedStepId","wrong-link")
    assertThrows(IllegalArgumentException::class.java) { BackupCodec.decode(broken.toString()) }
  }
  @Test fun sharedRoutineRejectsInvalidLinksWithoutChangingSavedRevisionOrProgress() {
    val id = create(); val before = read(id)
    val bad = draft() + mapOf("kind" to "EditRoutine","routineId" to id,"expectedRevision" to 1,"operationId" to "invalid-shared","authoringMode" to "Shared","presentationPreset" to "General")
    assertEquals("Rejected",command(bad)["status"])
    assertEquals(before,read(id)); assertEquals(1L,(request { engine.queryRoutines() }.single()["revision"] as Number).toLong())
  }
  @Test fun legacySevenDefaultsPreserveIndependentWeekdaysChecksAndFamilyTrash() {
    val id = create(); command(action(read(id),operation="legacy-seven-check")); family(id,"TrashRoutine",1)
    val legacy = JSONObject(request { engine.exportBackup() }).put("version",7)
    val versions = legacy.getJSONArray("routineVersions")
    for(i in 0 until versions.length()) { versions.getJSONObject(i).remove("authoringMode"); versions.getJSONObject(i).remove("presentationPreset") }
    val restored = BackupCodec.decode(legacy.toString())
    assertEquals("Trashed",restored.routines.single().state)
    assertEquals("ByWeekday",restored.routineVersions.single().authoringMode)
    assertEquals("Exercise",restored.routineVersions.single().presentationPreset)
    assertEquals(1,org.json.JSONArray(restored.routineSessions.single().done).length())
    assertEquals(21,(0..6).sumOf { day -> org.json.JSONArray(restored.routineVersions.single().days).getJSONObject(day).getJSONArray("exercises").length() })
  }
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

  private fun widget(number: Int = 1) = request { engine.widgetSnapshot(number) }
  private fun family(id: String, kind: String, revision: Long, operation: String = "$kind:$revision") = command(mapOf(
    "kind" to kind, "routineId" to id, "expectedRevision" to revision, "operationId" to operation))
  @Test fun familyTrashHidesAllNormalCollectionsPreservesChecksAndRestoresAsOneRow() {
    val id = create(); val monday = read(id); command(action(monday)); widgetConfigure(id); val stale = widget().doneToken!!
    val beforeTrash = read(id)
    val deleted = family(id,"TrashRoutine",1)
    assertEquals("Applied",deleted["status"]); assertTrue(rows().none { (it["routine"] as? Map<*,*>)?.get("routineId") == id })
    assertTrue(request { engine.queryRoutines() }.isEmpty()); assertNull(request { engine.routineSession(id,null) })
    val trash = rows("deleted"); assertEquals(1,trash.size); assertEquals("RoutineFamily",trash.single()["kind"])
    assertEquals(1,(trash.single()["routineFamily"] as Map<*,*>)["recordedDays"])
    assertEquals("Rejected",widgetAct(stale)["status"]); assertNull(widget().doneToken)
    assertEquals("IN_TRASH",command(action(monday,operation="stale-app"))["errorCode"])
    family(id,"RestoreRoutine",2)
    assertEquals(1,read(id)["completedCount"]); assertTrue(rows("deleted").isEmpty())
    assertEquals("STALE_REVISION",command(action(beforeTrash,index=1,operation="stale-after-restore"))["errorCode"])
    assertEquals("Rejected",widgetAct(stale)["status"]); assertEquals(1,read(id)["completedCount"])
    assertEquals("Applied",family(id,"TrashRoutine",1)["status"]) // Receipt retry cannot trash the restored family.
    assertEquals(1,read(id)["completedCount"])
  }
  @Test fun restorePreservesChildTrashAndPausedStateAndNeverCreatesDaysSpentInTrash() {
    val id = create(); val monday = read(id)
    command(mapOf("kind" to "Delete","operationId" to "child-trash","occurrenceId" to monday["occurrenceId"],"expectedRevision" to 1))
    family(id,"PauseRoutine",1); family(id,"TrashRoutine",2)
    now = instant("2026-10-15T12:00:00Z"); restart(); family(id,"RestoreRoutine",3)
    assertEquals("Paused",request { engine.queryRoutines() }.single()["state"])
    assertEquals(true,read(id,"2026-10-12")["deleted"])
    val history = request { engine.routineHistory(id,null) }["items"] as List<*>
    assertTrue(history.isEmpty())
    family(id,"ResumeRoutine",4); assertEquals("2026-10-15",read(id)["date"])
    assertFalse(read(id)["ended"] as Boolean)
    assertTrue((request { engine.routineHistory(id,null) }["items"] as List<*>).isEmpty())
  }
  @Test fun familyTrashRecoveryIsReceiptStableAtEveryCheckpoint() {
    for(stage in listOf("family-captured","family-fenced","family-before-commit","family-committed")) {
      val id = create(operation="create-$stage"); val job=mapOf("kind" to "TrashRoutine","routineId" to id,"expectedRevision" to 1,"operationId" to "trash-$stage")
      failAt = stage; runCatching { command(job) }; restart()
      assertEquals("Applied",command(job)["status"])
      assertTrue(rows("deleted").any { it["id"] == id }); assertTrue(request { engine.queryRoutines() }.none { it["id"] == id })
    }
  }
  @Test fun purgedRoutineCannotReturnFromAnOldBackupWithoutExplicitCopy() {
    val id = create(); val json = request { engine.exportBackup() }
    family(id,"TrashRoutine",1); family(id,"PurgeRoutine",2)
    assertEquals(listOf(id),BackupCodec.decode(request { engine.exportBackup() }).purgedRoutines.map { it.id })
    assertTrue(rows("deleted").isEmpty()); restart()
    val preview = request { engine.previewImport(json) }["items"] as List<Map<String,Any?>>
    assertEquals(true,preview.single()["conflict"])
    request { engine.importBackup(json,emptyList(),"preserve-erased") }
    assertTrue(request { engine.queryRoutines() }.isEmpty())
    request { engine.importBackup(json,listOf(id),"copy-erased") }
    assertNotEquals(id,request { engine.queryRoutines() }.single()["id"])
  }
  @Test @org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.NATIVE)
  fun customPhotoRevisionsAndBackupPreserveHistoryAndReferencedAssets() {
    val store=ExerciseImages(context)
    fun image(color: Int, lease: String): ExerciseImage {
      val source=java.io.File(context.cacheDir,"$lease.png")
      val bitmap=android.graphics.Bitmap.createBitmap(80,120,android.graphics.Bitmap.Config.ARGB_8888); bitmap.eraseColor(color)
      source.outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it) }; bitmap.recycle()
      val photo=store.normalize(android.net.Uri.fromFile(source)); request { engine.stageExerciseImage(photo,lease) }; return photo
    }
    val old=image(android.graphics.Color.BLUE,"old-photo")
    val replacement=image(android.graphics.Color.GREEN,"new-photo")
    fun days(photo: ExerciseImage) = week().map { day -> day + ("exercises" to (day["exercises"] as List<Map<String,Any?>>).map { it + ("customImageId" to photo.id) }) }
    val created=command(draft() + mapOf("kind" to "CreateRoutine","operationId" to "photo-plan","startsOn" to "2026-10-12","days" to days(old)))
    val id=(created["routine"] as Map<*,*>)["id"] as String
    now=instant("2026-10-13T07:00:00Z"); read(id) // Monday is closed before changing its photo.
    command(draft() + mapOf("kind" to "EditRoutine","operationId" to "photo-edit","routineId" to id,"expectedRevision" to 1,"days" to days(replacement)))
    assertEquals(replacement.id,steps(read(id)).first()["customImageId"])
    now=instant("2026-10-13T12:00:00Z"); assertEquals(replacement.id,steps(read(id)).first()["customImageId"])
    assertEquals(old.id,steps(read(id,"2026-10-12")).first()["customImageId"])
    val bundle=BackupCodec.decode(request { engine.exportBackup() }); assertEquals(setOf(old.id,replacement.id),bundle.images.map { it.id }.toSet())
    for(photo in listOf(old,replacement)) store.file(photo.id).setLastModified(System.currentTimeMillis()-172_800_000)
    request { engine.releaseExerciseImage("old-photo"); engine.releaseExerciseImage("new-photo") }
    assertTrue(store.file(old.id).isFile); assertTrue(store.file(replacement.id).isFile)
    family(id,"TrashRoutine",2); assertTrue(store.file(old.id).isFile)
    family(id,"PurgeRoutine",3); request { engine.releaseExerciseImage("cleanup") }
    assertFalse(store.file(old.id).exists()); assertFalse(store.file(replacement.id).exists())
  }
  @Test fun familyTrashRoundTripsAndRestoresItsPreviousProgress() {
    val id = create(); command(action(read(id))); family(id,"TrashRoutine",1)
    val json = request { engine.exportBackup() }; val bundle=BackupCodec.decode(json)
    assertEquals("Trashed",bundle.routines.single().state)
    request { engine.importBackup(json,listOf(id),"copy-trash") }
    val all=rows("deleted"); assertEquals(2,all.size)
    val copied=all.first { it["id"] != id }; family(copied["id"] as String,"RestoreRoutine",(copied["revision"] as Number).toLong())
    assertEquals(1,read(copied["id"] as String)["completedCount"])
  }
  private fun widgetAct(token: String, number: Int = 1) = request { engine.widgetAction(number, token) }
  private fun widgetConfigure(id: String?, mode: String = "Routine", number: Int = 1, revision: Long = 0) = request { engine.configureWidget(number, mode, id, revision) }

  @Test fun widgetDoneAdvancesOnceAndRepeatedUndoSurvivesFinalExerciseAndRestart() {
    val id = create(); widgetConfigure(id)
    var previous: String? = null
    for (i in 0..3) {
      val snapshot = widget(); assertEquals(i, snapshot.session!!["completedCount"])
      val token = snapshot.doneToken!!; assertEquals(token, widget().doneToken)
      assertEquals("Applied", widgetAct(token)["status"])
      assertEquals("Applied", widgetAct(token)["status"])
      assertEquals(i+1, widget().session!!["completedCount"]); previous = token
    }
    restart(); assertNull(widget().doneToken); assertEquals("Intervals", widget().undoName)
    assertEquals("Applied", widgetAct(widget().undoToken!!)["status"])
    assertEquals(3, read(id)["completedCount"]); assertNotNull(widget().doneToken)
    assertEquals("Applied", widgetAct(previous!!)["status"]); assertEquals(3, read(id)["completedCount"])
    for (i in 2 downTo 0) {
      restart(); val current = widget()
      assertEquals(steps(read(id))[i]["name"], current.undoName)
      val undo = current.undoToken!!
      assertEquals("Applied", widgetAct(undo)["status"])
      assertEquals("Applied", widgetAct(undo)["status"]) // A replay never pops the preceding completion.
      assertEquals(i, read(id)["completedCount"])
    }
    assertNull(widget().undoToken); assertNotNull(widget().doneToken)
    assertEquals("Applied", widgetAct(previous)["status"]); assertNull(widget().undoToken)
    widgetAct(widget().doneToken!!); assertEquals(1,read(id)["completedCount"])
    widgetAct(widget().undoToken!!); assertEquals(0,read(id)["completedCount"]); assertNull(widget().undoToken)
  }
  @Test fun repeatedWidgetUndoKeepsOtherWidgetsAndAppCompletions() {
    val id = create(); widgetConfigure(id); widgetConfigure(id,number = 2)
    widgetAct(widget().doneToken!!)
    widgetAct(widget(2).doneToken!!,2)
    widgetAct(widget().doneToken!!)
    command(action(read(id),index = 3,operation = "app:fourth"))
    assertEquals("Side plank",widget().undoName)
    widgetAct(widget().undoToken!!); assertEquals("Bird-dog",widget().undoName)
    widgetAct(widget().undoToken!!); assertNull(widget().undoToken)
    assertEquals(listOf(false,true,false,true),steps(read(id)).map { it["completed"] })
    assertEquals("Front plank",widget(2).undoName)
    widgetAct(widget(2).undoToken!!,2); assertNull(widget(2).undoToken)
    assertEquals(listOf(false,false,false,true),steps(read(id)).map { it["completed"] })
  }
  @Test fun appRecompletionInvalidatesOnlyThatWidgetUndoTargetAndStaleUndoNeverRetargets() {
    val id = create(); widgetConfigure(id)
    widgetAct(widget().doneToken!!); widgetAct(widget().doneToken!!)
    val stale = widget().undoToken!!
    command(action(read(id),index = 1,done = false,operation = "app:undo-second"))
    command(action(read(id),index = 1,operation = "app:redo-second"))
    assertEquals("Rejected",widgetAct(stale)["status"])
    assertEquals("Bird-dog",widget().undoName)
    widgetAct(widget().undoToken!!)
    assertEquals(listOf(false,true,false,false),steps(read(id)).map { it["completed"] })
    assertNull(widget().undoToken)
  }
  @Test fun immediatePlanEditsKeepMatchingUndoIdentitiesAndDropRemovedExercises() {
    val id = create(); widgetConfigure(id)
    widgetAct(widget().doneToken!!); widgetAct(widget().doneToken!!)
    val stale = widget().undoToken!!
    val days = week().toMutableList()
    val monday = (days[0]["exercises"] as List<Map<String,Any?>>).toMutableList()
    monday.removeAt(1); monday[0] = monday[0] + ("name" to "Updated Bird-dog")
    days[0] = days[0] + ("exercises" to monday.reversed())
    assertEquals("Applied",command(draft() + mapOf("kind" to "EditRoutine","operationId" to "widget-edit",
      "routineId" to id,"expectedRevision" to 1,"days" to days))["status"])
    assertEquals("Rejected",widgetAct(stale)["status"])
    assertEquals("Updated Bird-dog",widget().undoName)
    widgetAct(widget().undoToken!!)
    assertEquals(0,read(id)["completedCount"]); assertNull(widget().undoToken)
  }
  @Test fun interruptedRepeatedUndoRecoversExactlyOnceAtEachNativeCheckpoint() {
    for (stage in listOf("captured","fenced","committed")) {
      val id = create(operation = "undo-recovery-$stage")
      widgetConfigure(id,number = 10)
      repeat(2) { widgetAct(widget(10).doneToken!!,10) }
      val undo = widget(10).undoToken!!
      failAt = stage
      try { widgetAct(undo,10); fail("Expected interruption at $stage") } catch (_: java.util.concurrent.ExecutionException) { }
      restart(); assertEquals(1,read(id)["completedCount"])
      assertEquals("Bird-dog",widget(10).undoName); assertNull(widget(10).retryToken)
      assertEquals("Applied",widgetAct(undo,10)["status"])
      assertEquals("Bird-dog",widget(10).undoName)
      widgetAct(widget(10).undoToken!!,10)
      assertEquals(0,read(id)["completedCount"]); assertNull(widget(10).undoToken)
      request { engine.removeWidget(10) }
    }
  }
  @Test fun widgetUndoHistorySupportsAllHundredExercisesWithoutDescriptorTruncation() {
    val days = week().toMutableList()
    days[0] = mapOf("type" to "Exercises","exercises" to (0 until 100).map {
      mapOf("id" to "step-$it","name" to "Identical name","target" to "3 × 10","notes" to "","illustration" to "") })
    val created = command(draft() + mapOf("kind" to "CreateRoutine","operationId" to "hundred-steps",
      "startsOn" to "2026-10-12","days" to days))
    val id = (created["routine"] as Map<*,*>)["id"] as String
    widgetConfigure(id)
    repeat(100) { widgetAct(widget().doneToken!!) }
    restart(); assertNull(widget().doneToken)
    for (i in 99 downTo 0) {
      val token = widget().undoToken!!
      assertEquals("Applied",widgetAct(token)["status"])
      assertEquals(i,read(id)["completedCount"])
      assertFalse(steps(read(id))[i]["completed"] as Boolean)
    }
    assertNull(widget().undoToken)
    val saved = JSONObject(context.getSharedPreferences("remilo-widgets-v1",Context.MODE_PRIVATE).getString("widget:1",null)!!)
    assertEquals(0,saved.getJSONArray("undoHistory").length())
    assertTrue(saved.getJSONObject("actions").length() <= 57)
  }
  @Test fun installedOneStepWidgetKeepsItsLastUndoAndAddsNewHistory() {
    val id = create(); widgetConfigure(id)
    widgetAct(widget().doneToken!!)
    val prefs = context.getSharedPreferences("remilo-widgets-v1",Context.MODE_PRIVATE)
    val saved = JSONObject(prefs.getString("widget:1",null)!!)
    val entry = saved.getJSONArray("undoHistory").getJSONObject(0)
    saved.remove("undoHistory")
    saved.put("last",JSONObject().put("token",entry.getString("token")).put("stepId",entry.getString("stepId"))
      .put("date",entry.getString("date")))
    prefs.edit().putString("widget:1",saved.toString()).commit()
    restart(); assertEquals("Bird-dog",widget().undoName)
    widgetAct(widget().doneToken!!); assertEquals("Front plank",widget().undoName)
    widgetAct(widget().undoToken!!); assertEquals("Bird-dog",widget().undoName)
    widgetAct(widget().undoToken!!); assertEquals(0,read(id)["completedCount"]); assertNull(widget().undoToken)
  }
  @Test fun legacyCapturedUndoAndItsCommittedRecoveryConsumeOnlyTheOriginalTarget() {
    for (interrupted in listOf(false,true)) {
      val id = create(operation = "legacy-$interrupted"); widgetConfigure(id,number = 11)
      widgetAct(widget(11).doneToken!!,11); val undo = widget(11).undoToken!!
      val prefs = context.getSharedPreferences("remilo-widgets-v1",Context.MODE_PRIVATE)
      val saved = JSONObject(prefs.getString("widget:11",null)!!)
      val entry = saved.getJSONArray("undoHistory").getJSONObject(0)
      saved.remove("undoHistory"); saved.put("last",entry)
      saved.getJSONObject("actions").getJSONObject(undo).remove("undoOf")
      prefs.edit().putString("widget:11",saved.toString()).commit()
      if (interrupted) {
        failAt = "committed"
        try { widgetAct(undo,11); fail("Expected legacy interruption") } catch (_: java.util.concurrent.ExecutionException) { }
        restart()
      } else assertEquals("Applied",widgetAct(undo,11)["status"])
      assertEquals(0,read(id)["completedCount"]); assertNull(widget(11).undoToken)
      assertEquals("Applied",widgetAct(undo,11)["status"]); assertNull(widget(11).undoToken)
      request { engine.removeWidget(11) }
    }
  }
  @Test fun repeatedUndoIsSuspendedBySkipAndDiscardedWhenTheRoutineIsTrashed() {
    val id = create(); widgetConfigure(id)
    repeat(2) { widgetAct(widget().doneToken!!) }
    command(action(read(id),"SkipRoutineDay") - "stepId" - "completed"); assertNull(widget().undoToken)
    command(action(read(id),"UndoSkipRoutineDay") - "stepId" - "completed"); assertEquals("Front plank",widget().undoName)
    family(id,"PauseRoutine",1)
    widgetAct(widget().undoToken!!); assertEquals("Bird-dog",widget().undoName)
    val stale = widget().undoToken!!
    family(id,"TrashRoutine",2)
    assertEquals("Rejected",widgetAct(stale)["status"]); assertNull(widget().undoToken)
    family(id,"RestoreRoutine",3)
    assertEquals(1,read(id)["completedCount"]); assertNull(widget().undoToken)
  }
  @Test fun yesterdayUndoCannotChangeTodayOrReappearAfterAClockRollback() {
    val id = create(); widgetConfigure(id)
    repeat(2) { widgetAct(widget().doneToken!!) }
    val stale = widget().undoToken!!
    now = instant("2026-10-13T00:00:00Z")
    assertEquals("DAY_ENDED",widgetAct(stale)["errorCode"])
    assertNull(widget().undoToken); assertEquals(0,read(id)["completedCount"])
    assertEquals(2,read(id,"2026-10-12")["completedCount"])
    now = instant("2026-10-12T20:00:00Z")
    assertNull(widget().undoToken); assertEquals(true,read(id)["ended"])
  }
  @Test fun widgetStaleRevisionAndTwoInstancesNeverCompleteAnotherExercise() {
    val id = create(); widgetConfigure(id); widgetConfigure(id, number = 2)
    val first = widget().doneToken!!; val second = widget(2).doneToken!!
    widgetAct(first); assertEquals("Rejected", widgetAct(second, 2)["status"])
    assertEquals(1, widget(2).session!!["completedCount"])
    val stale = widget().doneToken!!
    command(action(read(id), index = 1, operation = "app:next"))
    assertEquals("Rejected", widgetAct(stale)["status"]); assertEquals(2, read(id)["completedCount"])
    assertNull(widget(2).undoToken)
  }
  @Test fun widgetMidnightRestSkipPausedAndFutureOnlyEditsUseNativeSession() {
    val id = create(); widgetConfigure(id); val monday = widget().doneToken!!
    now = instant("2026-10-13T00:00:00Z")
    assertEquals("DAY_ENDED", widgetAct(monday)["errorCode"])
    assertEquals("2026-10-13", widget().date); assertEquals(1, widget().session!!["totalCount"])
    command(action(read(id), "SkipRoutineDay")); assertNull(widget().doneToken)
    command(action(read(id), "UndoSkipRoutineDay")); assertNotNull(widget().doneToken)
    command(mapOf("kind" to "PauseRoutine", "operationId" to "pause-widget", "routineId" to id, "expectedRevision" to 1))
    assertNotNull(widget().doneToken) // Existing Tuesday can finish.
    now = instant("2026-10-14T08:00:00Z"); assertNull(widget().doneToken); assertEquals("Paused",widget().session!!["state"])
    now = instant("2026-10-18T08:00:00Z"); assertEquals("Rest",widget().session!!["state"]); assertNull(widget().doneToken)
  }
  @Test fun widgetConfigFencesOldActionsAndRestoresOnlyConfiguration() {
    val first = create(); val second = create(operation = "another")
    widgetConfigure(first); val stale = widget().doneToken!!
    widgetConfigure(second, revision = 1); assertEquals("Rejected", widgetAct(stale)["status"])
    assertEquals(0, read(first)["completedCount"]); assertEquals(0, read(second)["completedCount"])
    request { engine.restoreWidget(1, 3) }; assertFalse(widget().configured)
    assertEquals(second,widget(3).configuration.routineId); assertNull(widget(3).undoToken)
    assertEquals("Rejected", widgetAct(stale, 3)["status"])
    val before = widget(3); widgetAct(before.doneToken!!, 3)
    val current = widget(3); assertNotNull(current.undoToken)
    request { engine.restoreWidget(3, 3) }
    val sameId = widget(3)
    assertEquals(second,sameId.configuration.routineId)
    assertTrue(sameId.configuration.revision > current.configuration.revision)
    assertNull(sameId.undoToken); assertNull(sameId.retryToken)
    assertNotEquals(current.doneToken,sameId.doneToken)
    assertEquals("Rejected",widgetAct(current.doneToken!!,3)["status"])
    assertEquals(1,read(second)["completedCount"])
    request { engine.removeWidget(3) }; assertFalse(widget(3).configured)
    assertEquals(2, request { engine.queryRoutines() }.size)
  }
  @Test fun widgetPendingReceiptRecoversAfterNativeCommitWithoutNewOperation() {
    val id = create(); widgetConfigure(id); val token = widget().doneToken!!
    failAt = "committed"
    try { widgetAct(token); fail("Expected interruption") } catch (_: java.util.concurrent.ExecutionException) { }
    restart(); val current = widget(); assertEquals(1,current.session!!["completedCount"])
    assertNull(current.retryToken); assertEquals("Bird-dog",current.undoName)
    assertEquals("Applied",widgetAct(token)["status"]); assertEquals(1,read(id)["completedCount"])
  }
  @Test fun widgetTodayFiltersBeforeLimitingAcrossMoreThanFiftyRecords() {
    val id = create(); widgetConfigure(id,"Today")
    for (i in 0..54) command(mapOf("kind" to "Create","operationId" to "widget-normal:$i", "title" to "Reminder $i", "mode" to "None", "eventStartMs" to now + i * 1000L))
    now = instant("2026-10-13T12:00:00Z")
    command(mapOf("kind" to "Create","operationId" to "widget-future", "title" to "Tomorrow", "mode" to "None", "eventStartMs" to now + 86_400_000L))
    val today = widget(); assertEquals(55,today.total); assertEquals(20,today.reminders.size)
    assertTrue(today.reminders.all { it["routine"] == null && it["overdue"] == true })
    assertEquals("2026-10-13",today.session!!["date"])
    widgetConfigure(null,"Today",revision = 1); assertNull(widget().session); assertEquals(55,widget().total)
  }
  @Test fun widgetLockedAndUnsupportedHostNeverReadPrivateContentOrAcceptActions() {
    val id = create(); widgetConfigure(id); val token = widget().doneToken!!
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    assertTrue(widget().locked); assertNull(widget().session)
    assertEquals("LOCKED",widgetAct(token)["errorCode"])
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    assertTrue(request { engine.widgetSnapshot(1,false) }.locked)
    assertEquals("LOCKED", request { engine.widgetAction(1,token,false) }["errorCode"])
    assertEquals(0, read(id)["completedCount"])
  }
  @Test fun widgetDraftPreviewAndCancelledPinNeverWriteConfigurationOrProgress() {
    val id = create(); assertEquals("preview",request { engine.widgetPreview("Routine",id) }.doneToken)
    assertFalse(widget().configured); assertEquals(0,read(id)["completedCount"])
    val pin = request { engine.captureWidgetPin("Routine",id) }
    assertFalse(widget().configured)
    assertTrue(request { engine.finishWidgetPin(pin,9) }); assertFalse(request { engine.finishWidgetPin(pin,10) })
    assertEquals(id,widget(9).configuration.routineId)
    request { engine.pruneWidgets(emptySet()) }; assertFalse(widget(9).configured)
  }

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
  @Test fun immediateEditsPreserveCheckmarksAndOccurrenceIdentityThroughReorder() {
    val id = create(); command(action(read(id)))
    val original = steps(read(id)); val originalSession = read(id)
    val changedDays = week().toMutableList(); val originalMonday = changedDays[0]["exercises"] as List<Map<String,Any?>>
    changedDays[0] = mapOf("type" to "Exercises", "exercises" to originalMonday.reversed().map { it + ("name" to "Renamed ${it["name"]}") })
    changedDays[1] = mapOf("type" to "Exercises", "exercises" to listOf(mapOf("id" to "1-0", "name" to "Changed walk", "target" to "40 min", "notes" to "", "illustration" to "")))
    val preview = request { engine.previewRoutine(draft("Notification") + mapOf("routineId" to id, "startsOn" to "2026-10-12", "minutes" to 600, "days" to changedDays)) }
    assertEquals(instant("2026-10-12T10:00:00Z"), preview["nextAlertMs"])
    fun edit(revision: Int, operation: String) = command(draft() + mapOf("days" to changedDays, "minutes" to 600, "kind" to "EditRoutine", "routineId" to id, "expectedRevision" to revision, "operationId" to operation))
    assertEquals("Applied", edit(1,"edit")["status"]); assertEquals("Applied", edit(2,"edit-again")["status"])
    val updated = read(id)
    assertEquals(originalSession["occurrenceId"],updated["occurrenceId"])
    assertEquals(original.map { it["id"] }.reversed(),steps(updated).map { it["id"] })
    assertTrue(steps(updated).single { it["id"] == "0-0" }["completed"] as Boolean)
    assertTrue((updated["revision"] as Number).toLong() > (originalSession["revision"] as Number).toLong())
    now = instant("2026-10-13T08:00:00Z")
    assertEquals("Changed walk", steps(read(id)).single()["name"])
    assertEquals("40 min", steps(read(id)).single()["target"])
    assertEquals(steps(updated), steps(read(id,"2026-10-12")))
  }
  @Test fun immediateEditReconcilesRestDaysWidgetsAndStaleActionsWithoutCatchup() {
    val id=create("Notification"); command(action(read(id))); widgetConfigure(id)
    val original=read(id); val stale=widget().doneToken!!
    val rest=week().mapIndexed { i, day -> if(i==0) mapOf("type" to "Rest","exercises" to emptyList<Any>()) else day }
    fun edit(days: List<Map<String,Any?>>, rev: Int, operation: String, minutes: Int=540) = command(draft("Notification") + mapOf(
      "kind" to "EditRoutine","routineId" to id,"expectedRevision" to rev,"operationId" to operation,"days" to days,"minutes" to minutes))
    assertEquals("Applied",edit(rest,1,"rest-now")["status"])
    assertEquals("Rest",read(id)["state"]); assertEquals("Rest",widget().session!!["state"]); assertNull(widget().doneToken)
    assertTrue(rows("today").isEmpty()); assertEquals("Rejected",widgetAct(stale)["status"])
    assertEquals("Paused",protectedRows().single { it.occurrenceId==original["occurrenceId"] }.state)
    BackupCodec.decode(request { engine.exportBackup() })
    now=instant("2026-10-12T12:00:00Z")
    assertEquals("Applied",edit(week(),2,"work-now")["status"])
    assertEquals(original["occurrenceId"],read(id)["occurrenceId"]); assertEquals("Ready",widget().session!!["state"])
    assertEquals(1,rows("today").size)
    assertEquals("Available",protectedRows().single { it.occurrenceId==original["occurrenceId"] }.state)
    assertTrue(protectedRows().none { it.state in setOf("Alerting","Notified") })
    val snapshot=widget(); val token=snapshot.doneToken!!
    widgetAct(token); widgetAct(token); assertEquals(1,read(id)["completedCount"])
    assertEquals("Applied",widgetAct(widget().undoToken!!)["status"]); assertEquals(0,read(id)["completedCount"])
    BackupCodec.decode(request { engine.exportBackup() }); restart(); assertEquals("Ready",read(id)["state"])
  }
  @Test fun addingSaturdayTakesEffectOnSaturdayAcrossAgendaAndWidget() {
    val oldDays=week().mapIndexed { i, day -> if(i==5) mapOf("type" to "Rest","exercises" to emptyList<Any>()) else day }
    val created=command(draft("Notification") + mapOf("kind" to "CreateRoutine","operationId" to "before-saturday","startsOn" to "2026-10-12","days" to oldDays))
    val id=(created["routine"] as Map<*,*>)["id"] as String; widgetConfigure(id)
    now=instant("2026-10-17T12:00:00Z"); read(id)
    assertEquals("Rest",widget().session!!["state"])
    val changed=week().mapIndexed { i, day -> if(i==5) mapOf("type" to "Exercises","exercises" to listOf(
      mapOf("id" to "sat-new","name" to "New Saturday exercise","target" to "10 minutes"))) else day }
    command(draft("Notification") + mapOf("kind" to "EditRoutine","routineId" to id,"expectedRevision" to 1,"operationId" to "saturday-now","days" to changed))
    assertEquals("New Saturday exercise",steps(read(id)).single()["name"])
    assertEquals(read(id)["occurrenceId"],widget().session!!["occurrenceId"])
    assertEquals(1,rows("today").size); assertNotNull(widget().doneToken)
  }
  @Test fun extendingCompletedDayUpdatesItsAggregateWhileSkipAndRemovedStepAuditSurvive() {
    val id=create(); widgetConfigure(id)
    repeat(4) { widgetAct(widget().doneToken!!) }
    assertEquals("Completed",read(id)["state"])
    val addition=mapOf("id" to "added","name" to "Added today","target" to "5 min")
    val days=week().mapIndexed { i, day -> if(i==0) day + ("exercises" to (day["exercises"] as List<Map<String,Any?>>) + addition) else day }
    command(draft() + mapOf("kind" to "EditRoutine","routineId" to id,"expectedRevision" to 1,"operationId" to "extend-done","days" to days))
    assertEquals("InProgress",read(id)["state"]); assertEquals(4,read(id)["completedCount"]); assertEquals(5,read(id)["totalCount"])
    assertNotNull(widget().doneToken); assertEquals(1,rows("today").size)
    command(action(read(id),kind="SkipRoutineDay",operation="keep-skip"))
    val removed=days.mapIndexed { i, day -> if(i==0) day + ("exercises" to listOf(addition)) else day }
    command(draft() + mapOf("kind" to "EditRoutine","routineId" to id,"expectedRevision" to 2,"operationId" to "remove-checked","days" to removed))
    assertEquals("Skipped",read(id)["state"]); assertNull(widget().doneToken); assertEquals(0,read(id)["completedCount"])
    assertEquals(4,(read(id)["changes"] as List<Map<String,Any?>>).count { it["kind"]=="SetRoutineExercise" })
    val json=request { engine.exportBackup() }; val decoded=BackupCodec.decode(json)
    assertEquals(8,JSONObject(json).getInt("version")); assertEquals(3,decoded.routineVersions.size)
    assertEquals("Applied",request { engine.importBackup(json,listOf(id),"copy-immediate-audit") }["status"])
  }
  @Test fun immediateEditJournalRecoversAtEveryBoundaryAndRetainsClosedHistory() {
    for(stage in listOf("edit-captured","edit-fenced","edit-before-commit","edit-committed")) {
      now=instant("2026-10-12T07:00:00Z"); val id=create(operation="edit-create-$stage")
      command(action(read(id),operation="check-$stage")); val original=read(id)
      val edited=week().mapIndexed { i, day -> if(i==0) mapOf("type" to "Exercises","exercises" to listOf(
        mapOf("id" to "0-0","name" to "Renamed bird-dog","target" to "3 × 12"),mapOf("id" to "new","name" to "Added exercise","target" to "5 min"))) else day }
      val job=draft("Alarm") + mapOf("kind" to "EditRoutine","operationId" to stage,"routineId" to id,"expectedRevision" to 1,"days" to edited,"minutes" to 600)
      failAt=stage; runCatching { command(job) }; restart()
      assertEquals("Applied",command(job)["status"])
      val updated=read(id); assertEquals(original["occurrenceId"],updated["occurrenceId"])
      assertEquals(1,updated["completedCount"]); assertEquals(2,updated["totalCount"]); assertEquals(600,updated["minutes"])
      assertEquals(instant("2026-10-12T10:00:00Z"),rows("today").single { (it["routine"] as Map<*,*>)["routineId"]==id }["agendaAtMs"])
      BackupCodec.decode(request { engine.exportBackup() })
      now=instant("2026-10-13T08:00:00Z"); read(id)
      command(draft() + mapOf("kind" to "EditRoutine","routineId" to id,"expectedRevision" to 2,"operationId" to "closed-$stage"))
      assertEquals(steps(updated),steps(read(id,"2026-10-12"))); assertEquals(600,read(id,"2026-10-12")["minutes"])
    }
  }
  @Test fun completingAndUndoingAfterEditPreservesExplicitRoutineSnoozeTarget() {
    val id=create("Alarm")
    command(draft("Alarm") + mapOf("kind" to "EditRoutine","routineId" to id,"expectedRevision" to 1,"operationId" to "before-snooze","minutes" to 600))
    val day=read(id); var alert=protectedRows().single { it.occurrenceId==day["occurrenceId"] }
    now=instant("2026-10-12T10:00:00Z"); fireRoutine(alert)
    alert=protectedRows().single { it.occurrenceId==day["occurrenceId"] }
    assertEquals("Alerting",alert.state)
    assertEquals("Applied",command(deliveryCommand(alert,"SnoozeRoutineAlarm","snooze-after-edit"))["status"])
    val snoozed=protectedRows().single { it.occurrenceId==day["occurrenceId"] }.targetMs
    assertTrue(snoozed>now)
    repeat(4) { i -> command(action(read(id),index=i,operation="finish-snoozed-$i")) }
    command(action(read(id),index=3,done=false,operation="undo-snoozed-final"))
    assertEquals(snoozed,protectedRows().single { it.occurrenceId==day["occurrenceId"] }.targetMs)
    assertEquals(3,read(id)["completedCount"])
  }
  @Test fun editedOpenDayCanDeliverLockedButPauseAndStaleCallbacksRemainFenced() {
    for(mode in listOf("Alarm","Notification")) {
      now=instant("2026-10-12T07:00:00Z"); val id=create(mode,"edited-locked-$mode")
      val before=read(id); val old=protectedRows().single { it.occurrenceId==before["occurrenceId"] }
      command(draft(mode) + mapOf("kind" to "EditRoutine","routineId" to id,"expectedRevision" to 1,"operationId" to "edit-locked-$mode","minutes" to 600))
      val edited=protectedRows().single { it.occurrenceId==before["occurrenceId"] }
      shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
      now=instant("2026-10-12T09:00:00Z"); fireRoutine(old)
      assertEquals("Scheduled",protectedRows().single { it.occurrenceId==before["occurrenceId"] }.state)
      now=instant("2026-10-12T10:00:00Z"); fireRoutine(edited)
      assertEquals(if(mode=="Alarm")"Alerting" else "Notified",protectedRows().single { it.occurrenceId==before["occurrenceId"] }.state)
      shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
      family(id,"PauseRoutine",2,"pause-locked-$mode")
      val paused=protectedRows().single { it.occurrenceId==before["occurrenceId"] }
      assertEquals("Paused",paused.state)
      shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false); fireRoutine(edited)
      assertEquals("Paused",protectedRows().single { it.occurrenceId==before["occurrenceId"] }.state)
      shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    }
  }
  @Test fun immediateTimeEditsAndBackupsUseTheRecurrenceGapAndFoldPolicy() {
    TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles"))
    for((date,clock,minutes,expected) in listOf(
      listOf("2027-03-14","2027-03-14T08:30:00Z","150","2027-03-14T10:30:00Z"),
      listOf("2026-11-01","2026-11-01T07:30:00Z","90","2026-11-01T08:30:00Z"))) {
      now=instant(clock)
      val days=week().mapIndexed { i, day -> if(i==6) mapOf("type" to "Exercises","exercises" to listOf(
        mapOf("id" to "sunday","name" to "Sunday walk","target" to "30 min"))) else day }
      val created=command(draft("Notification") + mapOf("kind" to "CreateRoutine","operationId" to "dst-$date","startsOn" to date,"days" to days))
      val id=(created["routine"] as Map<*,*>)["id"] as String; val original=read(id)
      command(draft("Notification") + mapOf("kind" to "EditRoutine","routineId" to id,"expectedRevision" to 1,"operationId" to "edit-dst-$date","minutes" to minutes.toInt(),"days" to days))
      assertEquals(original["occurrenceId"],read(id)["occurrenceId"])
      assertEquals(instant(expected),protectedRows().single { it.occurrenceId==original["occurrenceId"] }.targetMs)
      BackupCodec.decode(request { engine.exportBackup() })
    }
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
    assertEquals(8, JSONObject(json).getInt("version")); assertEquals(1, decoded.routineSessions.size)
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
      draft() + mapOf("startsOn" to "2026-10-12", "mode" to "Invalid"))
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
  private fun fireRoutine(alert: AlertRecord) {
    val done = CompletableFuture<Unit>()
    engine.receive(AlarmScheduler.intent(context, "fire", alert.occurrenceId, alert.generation)) { done.complete(Unit) }
    done.get(20, TimeUnit.SECONDS)
  }
  private fun deliveryCommand(alert: AlertRecord, kind: String, operation: String) = mapOf(
    "kind" to kind, "operationId" to operation, "occurrenceId" to alert.occurrenceId,
    "date" to alert.nominalSlot!!.substringBefore('T'), "expectedGeneration" to alert.generation,
    "expectedSessionId" to alert.sessionId,
    "expectedSnoozeMinutes" to if (kind == "SnoozeRoutineAlarm") alert.snoozeMinutes else null)

  @Test fun alarmSettingsAndNotesAreVersionedWithDatedContentAndBackupSix() {
    val result = command(draft("Alarm") + mapOf("kind" to "CreateRoutine", "operationId" to "alarm-fields", "startsOn" to "2026-10-12",
      "notes" to "Original instructions", "sound" to "system", "vibration" to true))
    val id = (result["routine"] as Map<*, *>)["id"] as String
    assertEquals("Original instructions", read(id)["notes"]); assertEquals("system", read(id)["sound"]); assertEquals(true,read(id)["vibration"])
    now = instant("2026-10-13T08:00:00Z"); read(id)
    command(draft("Notification") + mapOf("kind" to "EditRoutine", "operationId" to "edit-fields", "routineId" to id,
      "expectedRevision" to 1, "notes" to "Tomorrow instructions", "sound" to "remilo", "vibration" to false))
    assertEquals("Tomorrow instructions", read(id)["notes"]); assertEquals("Notification",read(id)["mode"])
    val backup = request { engine.exportBackup() }; val decoded = BackupCodec.decode(backup)
    assertEquals(8,JSONObject(backup).getInt("version")); assertEquals("Original instructions",decoded.routineVersions.first().notes)
    now = instant("2026-10-13T08:00:00Z"); assertEquals("Tomorrow instructions",read(id)["notes"])
    assertEquals("Original instructions",read(id,"2026-10-12")["notes"])
  }
  @Test fun routineAlarmDismissIsDeliveryOnlyAndReceiptSurvivesLockedRestart() {
    val id = create("Alarm"); val session = read(id)
    var alert = protectedRows().single { it.occurrenceId == session["occurrenceId"] }; now = alert.targetMs; fireRoutine(alert)
    alert = protectedRows().single { it.occurrenceId == alert.occurrenceId }; assertEquals("Alerting",alert.state)
    val dismiss = deliveryCommand(alert,"DismissRoutineAlarm","dismiss-once")
    assertEquals("Applied",command(dismiss)["status"]); assertEquals("Applied",command(dismiss)["status"])
    assertEquals(0,read(id)["completedCount"]); assertEquals("Available",protectedRows().single { it.occurrenceId == alert.occurrenceId }.state)
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false); restart()
    assertEquals("Applied",command(dismiss)["status"])
    assertEquals("Rejected",command(dismiss + ("operationId" to "stale-dismiss"))["status"])
    assertEquals("Rejected",command(mapOf("kind" to "Settings","operationId" to "dismiss-once"))["status"])
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    assertEquals(0,read(id)["completedCount"])
  }
  @Test fun explicitRoutineSnoozeRearmsCapturedTargetWithoutCompletingExercises() {
    val id = create("Alarm"); val session = read(id)
    var alert = protectedRows().single { it.occurrenceId == session["occurrenceId"] }; now = alert.targetMs; fireRoutine(alert)
    alert = protectedRows().single { it.occurrenceId == alert.occurrenceId }
    val snoozeCommand = deliveryCommand(alert,"SnoozeRoutineAlarm","routine-snooze")
    assertEquals("Applied",command(snoozeCommand)["status"])
    val snoozed = protectedRows().single { it.occurrenceId == alert.occurrenceId }
    assertEquals("Scheduled",snoozed.state); assertFalse(snoozed.prompted); assertEquals(now + 600000,snoozed.targetMs)
    now += 1000; assertEquals("Applied",command(snoozeCommand)["status"])
    assertEquals(snoozed.targetMs,protectedRows().single { it.occurrenceId == alert.occurrenceId }.targetMs)
    now = snoozed.targetMs; fireRoutine(snoozed)
    assertEquals("Alerting",protectedRows().single { it.occurrenceId == alert.occurrenceId }.state)
    assertEquals(0,read(id)["completedCount"])
  }
  @Test fun mixedAlarmGroupRejectsWholeWorkoutCompletionAndDetachesOnlyFinishedRoutine() {
    val id = create("Alarm"); val session = read(id)
    val initial = protectedRows().single { it.occurrenceId == session["occurrenceId"] }
    val normal = command(mapOf("kind" to "Create","operationId" to "mixed-alarm","title" to "Ordinary alarm","mode" to "Alarm", "alarmAtMs" to initial.targetMs))
    val normalId = (normal["occurrence"] as Map<*, *>)["id"] as String
    now = initial.targetMs; fireRoutine(initial); fireRoutine(protectedRows().single { it.occurrenceId == normalId })
    val active = protectedRows().filter { it.state == "Alerting" }; assertEquals(2,active.size)
    assertEquals("Rejected",command(mapOf("kind" to "StopAll","operationId" to "mixed-stop", "expectedSessionId" to active.first().sessionId))["status"])
    assertEquals("Rejected",command(mapOf("kind" to "DoneAll","operationId" to "mixed-done", "expectedSessionId" to active.first().sessionId,
      "members" to active.map { mapOf("occurrenceId" to it.occurrenceId,"expectedGeneration" to it.generation) }))["status"])
    for (i in 0..3) command(action(read(id),index=i,operation="finish-mixed:$i"))
    assertEquals("Completed",protectedRows().single { it.occurrenceId == initial.occurrenceId }.state)
    assertEquals("Alerting",protectedRows().single { it.occurrenceId == normalId }.state)
    assertEquals(4,read(id)["completedCount"])
  }
  @Test fun midnightExpiresOnlyRoutineMemberAndOldSnoozeCannotReachTuesday() {
    val id = create("Alarm"); val session = read(id)
    var routine = protectedRows().single { it.occurrenceId == session["occurrenceId"] }
    val normal = command(mapOf("kind" to "Create","operationId" to "midnight-ordinary","title" to "Ordinary alarm","mode" to "Alarm", "alarmAtMs" to routine.targetMs))
    val normalId = (normal["occurrence"] as Map<*, *>)["id"] as String
    now = routine.targetMs; fireRoutine(routine); fireRoutine(protectedRows().single { it.occurrenceId == normalId })
    routine = protectedRows().single { it.occurrenceId == routine.occurrenceId }
    val snooze = deliveryCommand(routine,"SnoozeRoutineAlarm","midnight-snooze")
    now = instant("2026-10-12T23:55:00Z")
    assertEquals("DAY_ENDED",command(snooze)["errorCode"])
    now = instant("2026-10-13T00:00:00Z"); engine.expireRoutineDeliveries(); request { Unit }
    assertEquals("Expired",protectedRows().single { it.occurrenceId == routine.occurrenceId }.state)
    assertEquals("Alerting",protectedRows().single { it.occurrenceId == normalId }.state)
    assertEquals("Rejected",command(snooze)["status"])
    assertEquals(0,read(id)["completedCount"]); assertEquals("Incline walk",steps(read(id)).single()["name"])
  }
  @Test fun routineAlarmLateCallbackNeverRingsOrTurnsWorkoutOverdue() {
    val id = create("Alarm"); val monday = read(id)
    val alert = protectedRows().single { it.occurrenceId == monday["occurrenceId"] }
    now = alert.targetMs + 600000; fireRoutine(alert)
    assertEquals("Available",protectedRows().single { it.occurrenceId == alert.occurrenceId }.state)
    assertEquals(0,page("overdue")["total"]); assertEquals("Ready",read(id)["state"])
  }

  @Test fun interruptedRoutineSnoozeUsesOneFrozenIntentAcrossRecoveryCheckpoints() {
    for (stage in listOf("routine-alert-committed", "routine-alert-detached", "routine-alert-registered")) {
      val id = create("Alarm", "uncertain:$stage"); val session = read(id)
      var alert = protectedRows().single { it.occurrenceId == session["occurrenceId"] }; now = alert.targetMs; fireRoutine(alert)
      alert = protectedRows().single { it.occurrenceId == alert.occurrenceId }
      val snooze = deliveryCommand(alert,"SnoozeRoutineAlarm","uncertain-snooze:$stage")
      val originalTarget = now + alert.snoozeMinutes * 60_000L
      failAt = stage
      try { command(snooze); fail("Expected an uncertain native outcome at $stage") } catch (error: java.util.concurrent.ExecutionException) { assertTrue(error.cause is IllegalStateException) }
      now += 1000; restart()
      assertEquals("Applied",command(snooze)["status"])
      val current = protectedRows().single { it.occurrenceId == alert.occurrenceId }
      assertEquals(originalTarget,current.targetMs); assertEquals("Scheduled",current.state)
      assertEquals(0,read(id)["completedCount"])
      // Silence that captured future delivery so each iteration starts independently.
      command(action(read(id),"SkipRoutineDay",operation="uncertain-skip:$stage"))
      now = instant("2026-10-12T07:00:00Z")
    }
  }
  @Test fun alarmNeverFallsBackToNotificationAndReceiptOutcomeStaysStable() {
    exactAllowed = false
    val id = create("Alarm"); val session = read(id)
    assertEquals("Blocked",protectedRows().single { it.occurrenceId == session["occurrenceId"] }.state)
    assertTrue(registrations.none { it.mode == "Alarm" })
    exactAllowed = true; recover()
    var alert = protectedRows().single { it.occurrenceId == session["occurrenceId"] }; now = alert.targetMs; fireRoutine(alert)
    alert = protectedRows().single { it.occurrenceId == alert.occurrenceId }
    val snooze = deliveryCommand(alert,"SnoozeRoutineAlarm","blocked-routine-snooze")
    registrationFails = true
    assertEquals("Blocked",command(snooze)["status"])
    registrationFails = false; recover()
    assertEquals("Scheduled",protectedRows().single { it.occurrenceId == alert.occurrenceId }.state)
    assertEquals("Blocked",command(snooze)["status"])
    now = instant("2026-10-13T00:00:00Z"); recover()
    assertEquals("Blocked",command(snooze)["status"])
    assertEquals(0,read(id)["completedCount"])
  }
  @Test fun legacyBackupFiveSuppliesEmptyNotesAndOriginalAlertDefaults() {
    create("Notification")
    val legacy = JSONObject(request { engine.exportBackup() }).put("version",5)
    val versions = legacy.getJSONArray("routineVersions")
    for (i in 0 until versions.length()) { versions.getJSONObject(i).remove("notes"); versions.getJSONObject(i).remove("sound"); versions.getJSONObject(i).remove("vibration") }
    val decoded = BackupCodec.decode(legacy.toString())
    assertTrue(decoded.routineVersions.all { it.notes == "" && it.sound == "remilo" && !it.vibration && it.mode == "Notification" })
  }

  @Test fun travelBackwardAcrossDateReplansFutureMondayAndRejectsOldCallbackOnSunday() {
    now = instant("2026-10-11T23:00:00Z")
    val created = command(draft("Alarm") + mapOf("kind" to "CreateRoutine", "operationId" to "travel-alarm", "startsOn" to "2026-10-12", "minutes" to 30))
    val id = (created["routine"] as Map<*, *>)["id"] as String
    val old = protectedRows().filter { it.nominalSlot!!.startsWith("2026-10-12") }.single()
    TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles")); now = instant("2026-10-12T00:30:00Z")
    fireRoutine(old)
    assertTrue(protectedRows().none { it.state == "Alerting" })
    assertNull(request { engine.routineSession(id, null) }) // The routine starts Monday; local Sunday precedes its plan.
    val moved = protectedRows().single { it.occurrenceId == old.occurrenceId }
    assertTrue(moved.generation > old.generation); assertEquals(instant("2026-10-12T07:30:00Z"),moved.targetMs)
    now = moved.targetMs; fireRoutine(moved)
    assertEquals("Alerting",protectedRows().single { it.occurrenceId == old.occurrenceId }.state)
    assertEquals(0,read(id)["completedCount"])
  }
  @Test fun protectedRoutineDeliveryReservesItsOperationInCalendarNamespace() {
    val id = create("Alarm"); val session = read(id)
    var alert = protectedRows().single { it.occurrenceId == session["occurrenceId"] }; now = alert.targetMs; fireRoutine(alert)
    alert = protectedRows().single { it.occurrenceId == alert.occurrenceId }
    val operation = java.util.UUID.randomUUID().toString()
    assertEquals("Applied",command(deliveryCommand(alert,"DismissRoutineAlarm",operation))["status"])
    val outcome = CompletableFuture<String>()
    engine.calendarRequest(block = { store -> store.capture(mapOf("operationId" to operation, "occurrenceId" to alert.occurrenceId,
      "expectedRevision" to 1, "expectedConnectionRevision" to 1, "fingerprint" to "captured")) }, resolve = { outcome.complete("unexpected") }, reject = { outcome.complete(it) })
    assertEquals("OPERATION_REUSED",outcome.get(20,TimeUnit.SECONDS))
    assertEquals(0,read(id)["completedCount"])
  }

  @Test fun backwardDateEndsStartedTuesdayBeforeUnlockWithoutEndingFutureWednesday() {
    val id = create("Alarm")
    now = instant("2026-10-13T08:00:00Z")
    val tuesday = read(id)
    var alert = protectedRows().single { it.occurrenceId == tuesday["occurrenceId"] }
    assertTrue(alert.dayStarted)
    val future = protectedRows().first { it.nominalSlot!!.startsWith("2026-10-14") }
    assertFalse(future.dayStarted)
    now = alert.targetMs; fireRoutine(alert)
    alert = protectedRows().single { it.occurrenceId == alert.occurrenceId }; assertEquals("Alerting",alert.state)
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    now = instant("2026-10-12T09:00:00Z"); engine.expireRoutineDeliveries(); request { Unit }
    val ended = protectedRows().single { it.occurrenceId == alert.occurrenceId }
    assertTrue(ended.dayEnded); assertEquals("Expired",ended.state); assertNull(ended.sessionId)
    val stillFuture = protectedRows().single { it.occurrenceId == future.occurrenceId }
    assertFalse(stillFuture.dayEnded); assertFalse(stillFuture.dayStarted); assertEquals("Scheduled",stillFuture.state)
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    assertEquals(true,read(id,"2026-10-13")["ended"])
    now = alert.targetMs; fireRoutine(alert)
    assertEquals(true,read(id)["ended"]); assertEquals(0,read(id)["completedCount"])
    assertTrue(protectedRows().none { it.occurrenceId == alert.occurrenceId && it.state == "Alerting" })
  }

  @Test fun repeatedEffectiveDateAfterClockTravelKeepsImmutableHistoryAndPortableReferences() {
    val id = create("Notification")
    val originalWeek = week().mapIndexed { day, value -> if (day != 1) value else mapOf("type" to "Exercises", "exercises" to listOf(
      mapOf("id" to "1-0", "name" to "Original Tuesday walk", "target" to "35 minutes", "notes" to "Original guidance", "illustration" to ""))) }
    command(draft("Alarm") + mapOf("kind" to "EditRoutine", "routineId" to id, "expectedRevision" to 1, "operationId" to "immutable-first",
      "title" to "Original Tuesday", "notes" to "Original overall notes", "minutes" to 600, "sound" to "system", "vibration" to true, "days" to originalWeek))
    now = instant("2026-10-13T08:00:00Z")
    val tuesday = read(id); command(action(tuesday,operation="immutable-complete"))
    now = instant("2026-10-12T08:00:00Z"); assertEquals(true,read(id,"2026-10-13")["ended"])
    val replacement = week().mapIndexed { day, value -> if (day != 1) value else mapOf("type" to "Exercises", "exercises" to listOf(
      mapOf("id" to "new-tuesday", "name" to "Replacement Tuesday", "target" to "20 minutes", "notes" to "New guidance", "illustration" to ""))) }
    val edit = draft("None") + mapOf("kind" to "EditRoutine", "routineId" to id, "expectedRevision" to 2, "operationId" to "immutable-second",
      "title" to "Replacement plan", "notes" to "Replacement notes", "minutes" to 660, "sound" to "remilo", "vibration" to false, "days" to replacement)
    assertEquals("Applied",command(edit)["status"]); assertEquals("Applied",command(edit)["status"])
    restart()
    val historical = read(id,"2026-10-13")
    assertEquals("Original Tuesday",historical["title"]); assertEquals("Original overall notes",historical["notes"])
    assertEquals("Alarm",historical["mode"]); assertEquals(600,historical["minutes"]); assertEquals("system",historical["sound"]); assertEquals(true,historical["vibration"])
    assertEquals("Original Tuesday walk",steps(historical).single()["name"]); assertEquals(1,historical["completedCount"])
    val backup = request { engine.exportBackup() }; val decoded = BackupCodec.decode(backup)
    assertEquals(3,decoded.routineVersions.count { it.routineId == id && it.effectiveDate == "2026-10-12" })
    val frozen = decoded.routineSessions.single { it.date == "2026-10-13" }
    assertEquals(2L,frozen.versionRevision); assertEquals(3L,decoded.routines.single().revision)
    val tampered = JSONObject(backup); val sessions = tampered.getJSONArray("routineSessions")
    for (index in 0 until sessions.length()) if (sessions.getJSONObject(index).getString("date") == "2026-10-13") sessions.getJSONObject(index).put("versionRevision",3)
    try { BackupCodec.decode(tampered.toString()); fail("A different immutable revision must not validate against frozen content") } catch (_: IllegalArgumentException) { }
    assertEquals("Applied",request { engine.importBackup(backup,listOf(id),"immutable-copy") }["status"])
    assertEquals("Applied",request { engine.importBackup(backup,listOf(id),"immutable-copy") }["status"])
    val copy = request { engine.queryRoutines() }.single { it["id"] != id }["id"] as String
    assertEquals("Original overall notes",read(copy,"2026-10-13")["notes"])
    assertEquals("Applied",command(edit + mapOf("routineId" to copy,"expectedRevision" to 3,"operationId" to "immutable-copy-edit"))["status"])
    BackupCodec.decode(request { engine.exportBackup() })
  }
  @Test fun legacyVersionIdsAreDeterministicDespitePortableArrayOrder() {
    val id = create()
    now = instant("2026-10-13T08:00:00Z"); read(id)
    command(draft() + mapOf("kind" to "EditRoutine","routineId" to id,"expectedRevision" to 1,"operationId" to "legacy-revision-two"))
    now = instant("2026-10-14T08:00:00Z"); read(id)
    command(draft() + mapOf("kind" to "EditRoutine","routineId" to id,"expectedRevision" to 2,"operationId" to "legacy-revision-three"))
    val source = JSONObject(request { engine.exportBackup() }).put("version",5)
    val definitions = source.getJSONArray("routineVersions")
    for (index in 0 until definitions.length()) { val value = definitions.getJSONObject(index); for (key in listOf("revision","notes","sound","vibration")) value.remove(key) }
    val sessions = source.getJSONArray("routineSessions")
    for (index in 0 until sessions.length()) { val session=sessions.getJSONObject(index); session.remove("versionRevision")
      val changes=session.getJSONArray("changes"); session.put("changes",org.json.JSONArray((0 until changes.length()).map { changes.getJSONObject(it) }.filter { it.getString("kind") != "EditRoutine" })) }
    source.getJSONArray("routines").getJSONObject(0).remove("revision")
    val normal = BackupCodec.decode(source.toString())
    source.put("routineVersions",org.json.JSONArray((definitions.length()-1 downTo 0).map { definitions.getJSONObject(it) }))
    val reversed = BackupCodec.decode(source.toString())
    assertEquals(normal.routineVersions.associate { it.effectiveDate to it.revision },reversed.routineVersions.associate { it.effectiveDate to it.revision })
    assertEquals(normal.routineSessions.map { it.date to it.versionRevision },reversed.routineSessions.map { it.date to it.versionRevision })
    assertEquals(3L,reversed.routines.single().revision)
    assertEquals("Applied",request { engine.importBackup(source.toString(),listOf(id),"legacy-immutable-copy") }["status"])
    val copy = request { engine.queryRoutines() }.single { it["id"] != id }["id"] as String
    assertEquals("Applied",command(draft() + mapOf("kind" to "EditRoutine","routineId" to copy,"expectedRevision" to 3,"operationId" to "legacy-immutable-edit"))["status"])
    BackupCodec.decode(request { engine.exportBackup() })
  }

  @Test fun replacementSegmentCannotReviveAnOwnedDateAfterClockTravelEvenBeforeUnlock() {
    for (mode in listOf("Alarm", "Notification", "None")) {
      now = instant("2026-10-12T07:00:00Z")
      val id = create(mode, "owned-date-$mode")
      now = instant("2026-10-13T08:00:00Z")
      val original = read(id)
      now = instant("2026-10-12T08:00:00Z")
      assertEquals(true, read(id, "2026-10-13")["ended"])
      command(draft(mode) + mapOf("kind" to "EditRoutine", "routineId" to id, "expectedRevision" to 1,
        "operationId" to "owned-date-edit-$mode", "minutes" to 660, "title" to "Replacement $mode"))
      val candidate = protectedRows().single { it.nominalSlot == "2026-10-13T11:00" && it.mode == mode }
      assertNotEquals(original["occurrenceId"], candidate.occurrenceId)
      assertTrue(candidate.dayEnded); assertEquals("Expired", candidate.state)
      val future = protectedRows().first { it.segmentId == candidate.segmentId && it.nominalSlot!!.startsWith("2026-10-14") }
      assertFalse(future.dayEnded)
      assertEquals(if (mode == "None") "NoAlert" else "Scheduled", future.state)
      shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
      restart()
      now = instant("2026-10-13T09:30:00Z")
      fireRoutine(candidate)
      shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
      val family = request { engine.queryRepeatFamilies() }.single { it["seriesId"] == id }
      val upcoming = family["upcoming"] as List<Map<String, Any?>>
      assertTrue(upcoming.none { it["nominalSlot"].toString().startsWith("2026-10-13") })
      val segmentUpcoming = (family["current"] as Map<String, Any?>)["upcoming"] as List<Map<String, Any?>>
      assertTrue(segmentUpcoming.none { it["nominalSlot"].toString().startsWith("2026-10-13") })
      assertEquals(rows().count { (it["routine"] as? Map<*, *>)?.get("routineId") == id }, family["unfinishedCount"])
      shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
      now = candidate.targetMs
      fireRoutine(candidate)
      assertTrue(protectedRows().none { it.occurrenceId == candidate.occurrenceId && it.state in setOf("Alerting", "Notified") })
      shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
      val retained = read(id)
      assertEquals(original["occurrenceId"], retained["occurrenceId"]); assertEquals(true, retained["ended"])
      assertTrue(rows("today").none { (it["routine"] as? Map<*, *>)?.get("routineId") == id })
      BackupCodec.decode(request { engine.exportBackup() })
    }
  }

}
