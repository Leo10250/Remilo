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
  private class Response(url: URL, private val status: Int = 200) : HttpsURLConnection(url) {
    val sent = ByteArrayOutputStream()
    override fun connect() {}
    override fun disconnect() {}
    override fun usingProxy() = false
    override fun getCipherSuite() = "fake"
    override fun getLocalCertificates(): Array<Certificate>? = null
    override fun getServerCertificates(): Array<Certificate> = emptyArray()
    override fun getResponseCode() = status
    override fun getOutputStream() = sent
    override fun getInputStream() = "{}".byteInputStream()
    override fun getErrorStream() = "private server diagnostics must not escape".byteInputStream()
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
}
