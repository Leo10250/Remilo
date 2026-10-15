package com.remilo.alarm.calendar

import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject

class CalendarManagedDiscoveryTest {
  private val owned = OwnedCalendar("secondary", "My reminders", "UTC", canonicalName = "Remilo", dataOwner = "verified@example.test")
  @Test fun managedOwnershipRequiresDataOwnerRatherThanJustManagerAccess() {
    assertNull(CalendarManagedDiscovery.eligibility(owned, "verified@example.test"))
    assertNull(CalendarManagedDiscovery.eligibility(owned, "Verified@EXAMPLE.test"))
    assertEquals("NOT_OWNER", CalendarManagedDiscovery.eligibility(owned, "verified+alias@example.test"))
    assertEquals("NOT_OWNER", CalendarManagedDiscovery.eligibility(owned.copy(dataOwner = "different@example.test"), "verified@example.test"))
    assertEquals("OWNERSHIP_UNKNOWN", CalendarManagedDiscovery.eligibility(owned.copy(dataOwner = ""), "verified@example.test"))
    assertEquals("NOT_OWNER", CalendarManagedDiscovery.eligibility(owned.copy(primary = true), "verified@example.test"))
    assertEquals("NOT_OWNER", CalendarManagedDiscovery.eligibility(owned.copy(accessRole = "writer"), "verified@example.test"))
    assertEquals("NOT_OWNER", CalendarManagedDiscovery.eligibility(owned.copy(deleted = true), "verified@example.test"))
  }
  @Test fun markerRecognitionRequiresExactVersionAndCanonicalUuidAndDoesNotGrantOwnership() {
    val id = "00112233-4455-6677-8899-aabbccddeeff"
    val marker = CalendarManagedDiscovery.marker(id)
    assertEquals(id, CalendarManagedDiscovery.markerOperation(marker))
    assertNull(CalendarManagedDiscovery.markerOperation(marker + "\nCopied text"))
    assertNull(CalendarManagedDiscovery.markerOperation(marker.replace("v1", "v2")))
    assertNull(CalendarManagedDiscovery.markerOperation(marker.uppercase()))
    val marked = owned.copy(canonicalName = "Renamed", description = marker)
    assertTrue(CalendarManagedDiscovery.candidate(marked, "verified@example.test"))
    assertFalse(CalendarManagedDiscovery.candidate(marked.copy(dataOwner = "foreign@example.test"), "verified@example.test"))
  }
  @Test fun canonicalNameIsCaseInsensitiveAndNfcWhileDisplayNameIsNotUsedForDiscovery() {
    assertTrue(CalendarManagedDiscovery.matchingName(owned.copy(canonicalName = "REMiLO")))
    assertFalse(CalendarManagedDiscovery.matchingName(owned.copy(name = "Remilo", canonicalName = "Unrelated")))
    assertTrue(CalendarManagedDiscovery.matchingName(owned.copy(canonicalName = " Remilo ")))
    assertEquals(CalendarManagedDiscovery.normalizedName("\u00c9"), CalendarManagedDiscovery.normalizedName("E\u0301"))
  }
  @Test fun grantedCreationScopeIsCheckedOnlyForCalendarCreationAndPartialConsentDoesNotPass() {
    CalendarConsent.requireGranted(CalendarConsent.required.toList())
    try { CalendarConsent.requireGranted(CalendarConsent.required.toList(), true); fail("Missing feature permission") }
    catch (failure: CalendarFailure) { assertEquals("NEEDS_ACCESS", failure.code) }
    CalendarConsent.requireGranted(CalendarConsent.requiredFor(true).toList(), true)
    assertFalse(CalendarConsent.required.contains(CalendarConsent.calendarCreation))
  }
}
