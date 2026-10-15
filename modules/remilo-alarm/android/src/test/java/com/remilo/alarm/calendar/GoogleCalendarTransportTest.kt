package com.remilo.alarm.calendar

import android.app.Application
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayOutputStream
import java.net.URL
import java.security.cert.Certificate
import java.time.Instant
import java.time.OffsetDateTime
import javax.net.ssl.HttpsURLConnection

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class GoogleCalendarTransportTest {
  private val rfc3339 = Regex("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})")
  private fun content(value: Any?): Any? = when (value) {
    is JSONObject -> value.keys().asSequence().associateWith { content(value.get(it)) }
    is JSONArray -> (0 until value.length()).map { content(value.get(it)) }
    JSONObject.NULL -> null
    else -> value
  }
  private class Response(url: URL, private val status: Int = 200, private val body: String = "{}", private val error: String = "private server diagnostics must not escape") : HttpsURLConnection(url) {
    val sent = ByteArrayOutputStream()
    override fun connect() {}
    override fun disconnect() {}
    override fun usingProxy() = false
    override fun getCipherSuite() = "fake"
    override fun getLocalCertificates(): Array<Certificate>? = null
    override fun getServerCertificates(): Array<Certificate> = emptyArray()
    override fun getResponseCode() = status
    override fun getOutputStream() = sent
    override fun getInputStream() = body.byteInputStream()
    override fun getErrorStream() = error.byteInputStream()
  }
  @Test fun linkedLookupDistinguishesAmbiguousMissingFromExplicitResourceDeletion() {
    val missing = GoogleCalendarTransport { url -> Response(url, 404) }
    assertEquals(CalendarEventLookup.Missing, missing.lookup("synthetic", "source", "event"))
    assertNull(missing.event("synthetic", "source", "event")) // P4-A contract retained.
    val deleted = GoogleCalendarTransport { url -> Response(url, 410, error = """{"error":{"errors":[{"reason":"deleted"}],"message":"private data"}}""") }
    assertEquals(CalendarEventLookup.Deleted, deleted.lookup("synthetic", "source", "event"))
    try { deleted.event("synthetic", "source", "event"); fail("Legacy contract") }
    catch (e: CalendarFailure) { assertEquals("REMOTE_REMOVED", e.code) }
  }
  @Test fun genericOrExpiredSync410NeverEstablishesDeletionOrExposesDiagnostics() {
    for (reason in listOf("fullSyncRequired", "updatedMinTooLongAgo", "unknown")) {
      val transport = GoogleCalendarTransport { url -> Response(url, 410, error = """{"error":{"errors":[{"reason":"$reason"}],"message":"private diagnostics"}}""") }
      try { transport.lookup("synthetic", "source", "event"); fail("Must classify unavailable") }
      catch (e: CalendarFailure) { assertEquals("REMOTE_UNAVAILABLE", e.code); assertFalse(e.message!!.contains("private")) }
    }
  }
  @Test fun tombstoneLookupRetainsOnlyDataForNativeClassificationAndNeverWrites() {
    lateinit var response: Response
    val found = GoogleCalendarTransport { url -> Response(url, body = """{"id":"event","status":"cancelled"}""").also { response = it } }
      .lookup("synthetic", "source", "event") as CalendarEventLookup.Found
    assertEquals("cancelled", found.event.getString("status")); assertEquals("GET", response.requestMethod); assertEquals(0, response.sent.size())
  }
  @Test fun linkedPatchUsesReviewedEtagAndOnlyExplicitlySelectedFields() {
    val response = Response(URL("https://synthetic.test"))
    val transport = GoogleCalendarTransport { response }
    val payload = JSONObject().put("summary", "Reviewed title").toString()
    transport.patch("synthetic-token", "original@calendar", "event/identity", "\"reviewed\"", payload)
    assertEquals("POST", response.requestMethod)
    assertEquals("PATCH", response.getRequestProperty("X-HTTP-Method-Override"))
    assertEquals("\"reviewed\"", response.getRequestProperty("If-Match"))
    assertEquals(mapOf("summary" to "Reviewed title"), content(JSONObject(response.sent.toString("UTF-8"))))
  }
  @Test fun staleConditionalWriteIsAConflictAndNeverLeaksServerDiagnostics() {
    val transport = GoogleCalendarTransport { url -> Response(url, 412) }
    try { transport.patch("synthetic-token", "source", "event", "old", "{}"); fail("Must reject stale etag") }
    catch (error: CalendarFailure) { assertEquals("STALE_REMOTE", error.code); assertFalse(error.message!!.contains("private")) }
  }
  @Test fun eventListingIsOrderedPaginatedBoundedAndDoesNotWrite() {
    lateinit var response: Response
    GoogleCalendarTransport { url -> Response(url).also { response = it } }
      .events("synthetic", "source@test", "2026-10-12T00:00:00Z", "2026-11-11T00:00:00Z", "next+page")
    assertEquals("GET", response.requestMethod); assertEquals(0, response.sent.size())
    assertTrue(response.url.query.contains("singleEvents=true")); assertTrue(response.url.query.contains("orderBy=startTime"))
    assertTrue(response.url.query.contains("maxResults=100")); assertTrue(response.url.query.contains("pageToken=next%2Bpage"))
  }
  @Test fun incrementalPagesKeepTheExactCollectionQueryWithoutForbiddenFilters() {
    val requests = mutableListOf<Response>()
    val transport = GoogleCalendarTransport { url -> Response(url).also(requests::add) }
    transport.syncEvents("synthetic", "source", "original+token", null)
    transport.syncEvents("synthetic", "source", "original+token", "page+two")
    val first = requests[0].url.query; val second = requests[1].url.query
    assertEquals(first + "&pageToken=page%2Btwo", second)
    assertTrue(first.contains("singleEvents=false")); assertTrue(first.contains("showDeleted=true")); assertTrue(first.contains("maxResults=100"))
    assertTrue(first.contains("syncToken=original%2Btoken"))
    for (forbidden in listOf("timeMin", "timeMax", "orderBy", "q=", "extendedProperty", "eventTypes")) assertFalse(first.contains(forbidden))
    assertTrue(requests.all { it.requestMethod == "GET" && it.sent.size() == 0 })
  }
  @Test fun incremental410InvalidatesOnlyTheCursorAndNeverEstablishesDeletion() {
    val transport = GoogleCalendarTransport { url -> Response(url, 410) }
    try { transport.syncEvents("synthetic", "source", "expired", null); fail("Expired cursor") }
    catch (failure: CalendarFailure) { assertEquals("SYNC_TOKEN_EXPIRED", failure.code) }
    try { transport.lookup("synthetic", "source", "event"); fail("Ambiguous resource") }
    catch (failure: CalendarFailure) { assertEquals("REMOTE_UNAVAILABLE", failure.code) }
  }
  @Test fun instanceLookupUsesOriginalStartAndReturnsTheObservedIdentity() {
    lateinit var response: Response
    val transport = GoogleCalendarTransport { url -> Response(url, body = """{"items":[{"id":"observed-instance","recurringEventId":"master","originalStartTime":{"dateTime":"2027-01-04T09:00:00Z"}}]}""").also { response = it } }
    val actual = transport.instance("synthetic", "source", "master", "2027-01-04T09:00:00Z")!!
    assertEquals("observed-instance", actual.getString("id")); assertTrue(response.url.query.contains("originalStart=2027-01-04T09%3A00%3A00Z"))
    assertTrue(response.url.path.endsWith("/events/master/instances")); assertEquals(0, response.sent.size())
  }
  @Test fun savedMinutePrecisionPayloadIsReencodedWithoutChangingContentDestinationOrIdentity() {
    val payload = JSONObject("""{"id":"00112233445566778899aabbccddeeff","summary":"Original title","description":"Original notes","start":{"dateTime":"2026-10-12T12:00-07:00","timeZone":"America/Los_Angeles"},"end":{"dateTime":"2026-10-12T12:30-07:00","timeZone":"America/Los_Angeles"},"visibility":"private","transparency":"opaque","reminders":{"useDefault":false,"overrides":[]},"extendedProperties":{"private":{"remiloPublication":"00112233445566778899aabbccddeeff"}}}""")
    val captured = payload.toString()
    lateinit var response: Response
    GoogleCalendarTransport { url -> Response(url).also { response = it } }.insert("synthetic-token", "original@calendar", captured)
    val sent = JSONObject(response.sent.toString("UTF-8"))
    assertEquals("/calendar/v3/calendars/original%40calendar/events", response.url.path)
    assertEquals("sendUpdates=none", response.url.query)
    for (field in listOf("start", "end")) {
      val before = payload.getJSONObject(field)
      val after = sent.getJSONObject(field)
      assertTrue(rfc3339.matches(after.getString("dateTime")))
      assertEquals(OffsetDateTime.parse(before.getString("dateTime")).toInstant(), Instant.parse(after.getString("dateTime")))
      assertEquals(before.getString("timeZone"), after.getString("timeZone"))
      before.remove("dateTime"); after.remove("dateTime")
    }
    assertEquals(content(payload), content(sent))
    assertEquals("2026-10-12T12:00-07:00", JSONObject(captured).getJSONObject("start").getString("dateTime"))
  }
  @Test fun serializationPreservesFractionalInstantsAndOffsetsThroughDstFold() {
    for ((time, zone) in listOf("2026-11-01T01:30-07:00" to "America/Los_Angeles",
      "2026-11-01T01:30-08:00" to "America/Los_Angeles", "2026-10-12T12:00:00.123+05:30" to "Asia/Kolkata")) {
      val payload = JSONObject().put("start", JSONObject().put("dateTime", time).put("timeZone", zone))
        .put("end", JSONObject().put("dateTime", time).put("timeZone", zone))
      val response = Response(URL("https://synthetic.test"))
      GoogleCalendarTransport { response }.insert("synthetic-token", "calendar", payload.toString())
      for (field in listOf("start", "end")) {
        val sent = JSONObject(response.sent.toString("UTF-8")).getJSONObject(field).getString("dateTime")
        assertTrue(rfc3339.matches(sent))
        assertEquals(OffsetDateTime.parse(time).toInstant(), Instant.parse(sent))
      }
    }
  }
  @Test fun allDayExclusiveDatesAndReminderSuppressionStayIntact() {
    val payload = JSONObject("""{"start":{"date":"2026-03-08"},"end":{"date":"2026-03-09"},"reminders":{"useDefault":false,"overrides":[]}}""")
    val response = Response(URL("https://synthetic.test"))
    GoogleCalendarTransport { response }.insert("synthetic-token", "calendar", payload.toString())
    assertEquals(content(payload), content(JSONObject(response.sent.toString("UTF-8"))))
  }
  @Test fun badRequestIsDistinguishableWithoutExposingTheServerBody() {
    val response = Response(URL("https://synthetic.test"), 400)
    try { GoogleCalendarTransport { response }.calendars("synthetic-token", null); fail("Expected HTTP 400 rejection") }
    catch (error: CalendarFailure) { assertEquals("BAD_REQUEST", error.code); assertEquals("BAD_REQUEST", error.message) }
  }
  @Test fun managedDiscoveryRetainsCanonicalNameOwnerAndMarkerWithoutTreatingDisplayOverrideAsIdentity() {
    val page = GoogleCalendarTransport().page(JSONObject("""{"items":[{"id":"secondary","summary":"Remilo","summaryOverride":"My reminders","description":"visible provenance","timeZone":"UTC","dataOwner":"verified@example.test","accessRole":"owner","defaultReminders":[]},{"id":"primary","summary":"Remilo","timeZone":"UTC","primary":true,"accessRole":"owner"},{"id":"foreign","summary":"Remilo","accessRole":"reader"}],"nextPageToken":"continuation"}"""))
    assertEquals(2, page.items.size)
    val calendar = page.items.first()
    assertEquals("My reminders", calendar.name); assertEquals("Remilo", calendar.canonicalName)
    assertEquals("verified@example.test", calendar.dataOwner); assertEquals("visible provenance", calendar.description)
    assertFalse(calendar.hasDefaultReminders); assertTrue(page.items.last().primary)
    assertEquals("continuation", page.nextCursor)
  }
  @Test fun calendarCreationSendsOnlyReviewedMetadataAndNeverInventsClientCalendarId() {
    lateinit var response: Response
    val description = CalendarManagedDiscovery.marker("00112233-4455-6677-8899-aabbccddeeff")
    val calendar = GoogleCalendarTransport { url -> Response(url, body = """{"id":"created@calendar","summary":"Remilo","description":"visible provenance","timeZone":"America/Los_Angeles","dataOwner":"verified@example.test"}""").also { response = it } }
      .createCalendar("synthetic", "Remilo", "America/Los_Angeles", description)
    assertEquals("POST", response.requestMethod); assertEquals("/calendar/v3/calendars", response.url.path)
    assertNull(response.url.query); assertNull(response.getRequestProperty("If-Match"))
    assertEquals(mapOf("summary" to "Remilo", "timeZone" to "America/Los_Angeles", "description" to description), content(JSONObject(response.sent.toString("UTF-8"))))
    assertEquals("created@calendar", calendar.id); assertEquals("owner", calendar.accessRole)
    assertEquals("verified@example.test", calendar.dataOwner); assertFalse(calendar.primary)
  }
  @Test fun invalidCalendarCreationZoneFailsBeforeOpeningAnyConnection() {
    var opened = false
    val transport = GoogleCalendarTransport { url -> opened = true; Response(url) }
    try { transport.createCalendar("synthetic", "Remilo", "+04:00", "description"); fail("Unsupported fixed offset") }
    catch (failure: CalendarFailure) { assertEquals("INVALID_INPUT", failure.code) }
    assertFalse(opened)
  }
  @Test fun calendarCreationServerFailureRequiresInspectionWhereRateLimitIsARejection() {
    for ((status, expected) in listOf(503 to "NETWORK", 429 to "RETRY")) {
      val transport = GoogleCalendarTransport { url -> Response(url, status) }
      try { transport.createCalendar("synthetic", "Remilo", "UTC", "reviewed"); fail("Expected rejected or uncertain creation") }
      catch (error: CalendarFailure) { assertEquals(expected, error.code) }
    }
  }
  @Test fun cancelledOpportunityDoesNotOpenAnotherConnection() {
    var opened = false
    val transport = GoogleCalendarTransport { url -> opened = true; Response(url) }
    transport.cancelled = { true }
    try { transport.syncEvents("synthetic", "source", null, null); fail("Expected cancellation") }
    catch (error: CalendarFailure) { assertEquals("CANCELLED", error.code) }
    assertFalse(opened)
  }
}
