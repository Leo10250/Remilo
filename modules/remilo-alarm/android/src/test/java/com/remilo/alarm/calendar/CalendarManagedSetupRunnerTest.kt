package com.remilo.alarm.calendar

import android.app.Application
import androidx.room.Room
import com.remilo.alarm.data.ContentDatabase
import org.json.JSONArray
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class CalendarManagedSetupRunnerTest {
  private lateinit var db: ContentDatabase
  private lateinit var store: CalendarStore
  private var now = 1_800_000_000_000L
  private var elapsed = 0L
  private val calendars = mutableListOf<OwnedCalendar>()
  private var posts = 0
  private var creationRequests = 0
  private var lostReply = false
  private var creationPermission = true
  private var verifiedEmail = true
  private var rejectCreate: String? = null
  private var calendarReadsUnavailable = 0
  private var calendarListFailure: String? = null
  private var paginated: ((String?) -> CalendarPage)? = null
  private var afterPost: (() -> Unit)? = null
  private val pageRequests = mutableListOf<String?>()
  private val access = object : CalendarStateAccess {
    override fun <T> access(write: Boolean, block: (CalendarStore) -> T): T = block(store)
  }
  private val auth = object : CalendarAuthorization {
    override fun token(email: String) = "ordinary"
    override fun tokenForCalendarCreation(email: String): String {
      creationRequests++
      if (!creationPermission) throw CalendarFailure("NEEDS_ACCESS")
      return "creation"
    }
    override fun clear(token: String) {}
    override fun revoke(email: String) {}
  }
  private val transport = object : CalendarTransport {
    override fun account(token: String) = CalendarAccount("subject", "verified@example.test", verifiedEmail)
    override fun calendars(token: String, cursor: String?): CalendarPage {
      pageRequests.add(cursor)
      calendarListFailure?.let { throw CalendarFailure(it) }
      return paginated?.invoke(cursor) ?: CalendarPage(calendars.toList(), null)
    }
    override fun calendar(token: String, id: String): OwnedCalendar {
      if (calendarReadsUnavailable > 0) { calendarReadsUnavailable--; throw CalendarFailure("NOT_FOUND") }
      return calendars.firstOrNull { it.id == id } ?: throw CalendarFailure("NOT_FOUND")
    }
    override fun createCalendar(token: String, name: String, zoneId: String, description: String): OwnedCalendar {
      assertEquals("creation", token)
      rejectCreate?.let { rejectCreate = null; throw CalendarFailure(it) }
      posts++
      val created = OwnedCalendar("created-$posts", name, zoneId, description = description, dataOwner = "verified@example.test")
      calendars.add(created); afterPost?.invoke()
      if (lostReply) { lostReply = false; throw CalendarFailure("NETWORK") }
      return created
    }
    override fun event(token: String, calendarId: String, eventId: String): JSONObject? = throw AssertionError("Setup must not read event payloads")
    override fun insert(token: String, calendarId: String, payload: String): JSONObject = throw AssertionError("Setup must not create events")
  }
  @Before fun setup() {
    db = Room.inMemoryDatabaseBuilder(RuntimeEnvironment.getApplication(), ContentDatabase::class.java).allowMainThreadQueries().build()
    store = CalendarStore(db, { now }, { "UTC" })
    store.connect(CalendarAccount("subject", "verified@example.test"), 0)
  }
  @After fun close() { db.close() }
  private fun capture(create: Boolean = true, selected: OwnedCalendar? = null): String {
    val preview = store.managed.previewSetup(mapOf("calendarZone" to "UTC"),
      JSONArray(selected?.let { listOf(it.managedJson()) } ?: emptyList<JSONObject>()), true, selected?.id, create)
    val id = UUID.randomUUID().toString()
    store.managed.captureSetup(mapOf("kind" to "Setup", "operationId" to id, "previewId" to preview["previewId"],
      "expectedRevision" to preview["expectedRevision"], "selectedItemIds" to emptyList<String>()))
    return id
  }
  private fun run(id: String) = CalendarManagedSetupRunner(access, transport, auth, { elapsed }).run(id)
  @Test fun lostCreateReplyIsRecoveredFromExactMarkerAfterStoreRestartWithoutAnotherPost() {
    val id = capture(); lostReply = true
    assertEquals("CreationUnconfirmed", run(id).phase); assertEquals(1, posts)
    assertTrue(store.managed.setupOperation(id)!!.attempted)
    store = CalendarStore(db, { now }, { "UTC" })
    assertEquals("Confirmed", run(id).phase); assertEquals(1, posts)
    assertEquals("created-1", store.managed.binding().calendarId)
    assertEquals("InitialImport", store.managed.binding().phase)
  }
  @Test fun zeroMatchesAfterUnknownSentCreateRemainUnconfirmedAcrossRepeatedInspection() {
    val id = capture(); lostReply = true
    run(id); calendars.clear()
    assertEquals("CreationUnconfirmed", run(id).phase)
    assertEquals("CreationUnconfirmed", run(id).phase)
    assertEquals(1, posts); assertEquals("Disabled", store.managed.binding().mode)
  }
  @Test fun multipleExactMarkersCannotChooseAnArbitraryCalendarOrResendCreation() {
    val id = capture(); lostReply = true
    run(id); calendars.add(calendars.single().copy(id = "duplicate"))
    assertEquals("CreationUnconfirmed", run(id).phase)
    assertEquals(1, posts); assertEquals("Disabled", store.managed.binding().mode)
  }
  @Test fun savedRenamedSelectionUsesItsIdentityAndDoesNotRequestCreationScope() {
    val calendar = OwnedCalendar("existing", "Renamed reminders", "UTC", dataOwner = "verified@example.test")
    calendars.add(calendar)
    assertEquals("Confirmed", run(capture(false, calendar)).phase)
    assertEquals("existing", store.managed.binding().calendarId)
    assertEquals(0, posts); assertEquals(0, creationRequests); assertTrue(pageRequests.isEmpty())
  }
  @Test fun emptyContinuationPagesCheckpointAndResumeBeforeAnyCalendarCreation() {
    paginated = { cursor -> val index = cursor?.toInt() ?: 0; CalendarPage(emptyList(), if (index == 10) null else (index + 1).toString()) }
    val id = capture()
    val first = run(id)
    assertEquals(10, first.pages); assertTrue(first.continuation); assertEquals(0, posts)
    assertEquals("10", store.managed.setupOperation(id)!!.discoveryCursor)
    store = CalendarStore(db, { now }, { "UTC" })
    assertEquals("Confirmed", run(id).phase)
    assertEquals(1, posts); assertEquals(11, pageRequests.size)
    assertEquals("10", pageRequests.last())
  }
  @Test fun delayedScopeGrantRechecksDiscoveryAndDoesNotCreateBesideANewMatchingCalendar() {
    val id = capture(); creationPermission = false
    assertEquals("AccessRequired", run(id).phase)
    assertFalse(store.managed.setupOperation(id)!!.attempted); assertEquals(0, posts)
    calendars.add(OwnedCalendar("appeared", "Remilo", "UTC", dataOwner = "verified@example.test")); creationPermission = true
    assertEquals("Reviewing", run(id).phase); assertEquals(0, posts)
  }
  @Test fun knownSuccessfulCreationCannotReactivateAfterDisconnectDuringItsReply() {
    val id = capture()
    afterPost = { store.disconnect(UUID.randomUUID().toString(), store.connection().revision) }
    run(id)
    assertEquals(1, posts); assertEquals("Disabled", store.managed.binding().mode)
    assertFalse(store.connection().connected)
    assertEquals("Fenced", store.managed.setupOperation(id)!!.phase)
  }
  @Test fun unknownDataOwnerAndUnverifiedAccountCannotActivateAManagedCalendar() {
    val unknown = OwnedCalendar("existing", "Remilo", "UTC")
    calendars.add(unknown)
    assertEquals("OwnershipUnknown", run(capture(false, unknown)).phase)
    assertEquals("Disabled", store.managed.binding().mode)
    assertEquals(0, posts)
  }
  @Test fun unverifiedEmailStopsDiscoveryAndCreationWithoutUsingEmailAsAccountIdentity() {
    val id = capture(); verifiedEmail = false
    assertEquals("OwnershipUnknown", run(id).phase)
    assertEquals(0, posts); assertEquals(0, creationRequests); assertTrue(pageRequests.isEmpty())
    assertFalse(store.managed.setupOperation(id)!!.attempted)
  }
  @Test fun elapsedBudgetRetainsTheExactContinuationInsteadOfClaimingNoMatch() {
    paginated = { cursor -> val index = cursor?.toInt() ?: 0; elapsed += 65_000; CalendarPage(emptyList(), (index + 1).toString()) }
    val id = capture(); val result = run(id)
    assertEquals(2, result.pages); assertTrue(result.continuation)
    assertEquals("2", store.managed.setupOperation(id)!!.discoveryCursor)
    assertFalse(store.managed.setupOperation(id)!!.discoveryComplete); assertEquals(0, posts)
  }
  @Test fun returnedIdentityIsSavedBeforeCalendarListPropagationAndInspectionNeverPostsAgain() {
    val id = capture(); calendarReadsUnavailable = 1
    assertEquals("CreationUnconfirmed", run(id).phase)
    assertEquals("created-1", store.managed.setupOperation(id)!!.resultCalendarId)
    assertEquals(now + 60_000, store.managed.nextRetryMs())
    assertEquals("Disabled", store.managed.binding().mode)
    assertEquals("Confirmed", run(id).phase); assertEquals(1, posts)
    assertEquals("created-1", store.managed.binding().calendarId)
  }
  @Test fun definitivelyUnsentCreationCanRetryWithTheSameCapturedIdentity() {
    val id = capture(); rejectCreate = "NOT_AVAILABLE"
    assertEquals("PreparingCalendar", run(id).phase)
    assertFalse(store.managed.setupOperation(id)!!.attempted); assertEquals(0, posts)
    assertEquals(now + 60_000, store.managed.nextRetryMs())
    assertEquals("Confirmed", run(id).phase); assertEquals(1, posts)
  }
  @Test fun failedReadOnlyDiscoveryCannotSuspendTheAlreadyAuthorizedManagedBinding() {
    val calendar = OwnedCalendar("existing", "Remilo", "UTC", dataOwner = "verified@example.test")
    calendars.add(calendar); assertEquals("Confirmed", run(capture(false, calendar)).phase)
    store.managed.initialComplete(store.managed.binding().bootstrapGeneration)
    val before = store.managed.binding()
    val discovery = store.managed.beginDiscovery(UUID.randomUUID().toString(), store.connection().revision, "UTC", "")
    calendarListFailure = "NETWORK"
    run(discovery.operationId)
    assertEquals(before, store.managed.binding()); assertTrue(store.managed.active())
    assertEquals("NETWORK", store.managed.setupOperation(discovery.operationId)!!.message)
    assertTrue(store.managed.dao.issues().isEmpty())
  }
  @Test fun futureDefaultsCannotInvalidateAnInFlightCreationOrRewriteItsCapturedInitialPolicy() {
    val id = capture()
    afterPost = {
      val preview = store.managed.previewPolicyChange(mapOf("importMode" to "None"))
      store.managed.applyPolicy(mapOf("kind" to "ApplyManagedCalendarPolicy", "operationId" to UUID.randomUUID().toString(), "previewId" to preview["previewId"]))
    }
    assertEquals("Confirmed", run(id).phase); assertEquals(1, posts)
    assertEquals("created-1", store.managed.binding().calendarId)
    assertEquals("None", store.managed.policy().importMode)
    assertEquals("Alarm", store.managed.binding().initialMode)
    assertEquals("Alarm", JSONObject(store.managed.setupOperation(id)!!.policy).getString("importMode"))
  }
}
