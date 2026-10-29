package com.remilo.alarm.core

import org.junit.Assert.*
import org.junit.Test

class StorageFailureDiagnosticsTest {
  private fun missing(from: Int, to: Int) = IllegalStateException(
    "A migration from $from to $to was required but not found. Please provide the necessary Migration path via " +
      "RoomDatabase.Builder.addMigration(Migration ...) or allow for destructive migrations via one of the " +
      "RoomDatabase.Builder.fallbackToDestructiveMigration* methods. Private title: Take secret medicine.")

  @Test fun reportsOnlyNumericVersionsForBothNewerInstalledDatabaseDowngrades() {
    assertEquals("type=room_missing_migration from=9 to=8 exception=IllegalStateException",
      StorageFailureDiagnostics.summary(missing(9, 8)))
    assertEquals("type=room_missing_migration from=17 to=13 exception=IllegalStateException",
      StorageFailureDiagnostics.summary(missing(17, 13)))
  }

  @Test fun readsRecognizedRoomFailureThroughWrappedCauses() {
    val wrapper = java.util.concurrent.ExecutionException("Private wrapper text", RuntimeException("Another private wrapper", missing(7, 8)))
    assertEquals("type=room_missing_migration from=7 to=8 exception=IllegalStateException",
      StorageFailureDiagnostics.summary(wrapper))
  }

  @Test fun identityMismatchDoesNotExposeEitherHashOrAnyDatabaseContent() {
    val error = IllegalStateException("Room cannot verify the data integrity. Looks like you've changed schema but forgot to update " +
      "the version number. You can simply fix this by increasing the version number. Expected identity hash: " +
      "private-expected-hash, found: private-found-hash. SELECT title,notes FROM reminders; /private/database/path")
    assertEquals("type=room_identity_mismatch exception=IllegalStateException", StorageFailureDiagnostics.summary(error))
  }

  @Test fun arbitrarySqlSchemaAndUserMessagesFallBackToExceptionClassOnly() {
    listOf(
      "Migration didn't properly handle: reminders. Expected: title=Private name Found: notes=Private notes",
      "no such table: a_private_table; SELECT title FROM reminders",
      "A migration from 9 to 8 contained private instructions but was not a Room failure.",
      "Private note: A migration from 9 to 8 was required but not found.",
      "Room cannot verify the data integrity. Private content without the expected Room identity marker.",
      "A migration from 9999999999 to 8 was required but not found.",
      "A migration from 0 to 8 was required but not found."
    ).forEach { message ->
      assertEquals("type=unknown exception=IllegalStateException", StorageFailureDiagnostics.summary(IllegalStateException(message)))
    }
    assertEquals("type=unknown exception=IllegalArgumentException", StorageFailureDiagnostics.summary(
      RuntimeException("wrapper contains private text", IllegalArgumentException("a private value"))))
  }

  @Test fun nullMessagesAndAnonymousExceptionClassesDoNotExposeUnboundedMetadata() {
    assertEquals("type=unknown exception=IllegalStateException", StorageFailureDiagnostics.summary(IllegalStateException()))
    assertEquals("type=unknown exception=Throwable", StorageFailureDiagnostics.summary(object : RuntimeException("Private content") {}))
  }

  @Test fun causeTraversalIsCycleSafeAndBounded() {
    val first = RuntimeException("private first"); val second = IllegalArgumentException("private second")
    first.initCause(second); second.initCause(first)
    assertEquals("type=unknown exception=IllegalArgumentException", StorageFailureDiagnostics.summary(first))
    var deep: Throwable = missing(17, 13)
    repeat(20) { deep = RuntimeException("private wrapper $it", deep) }
    assertEquals("type=unknown exception=RuntimeException", StorageFailureDiagnostics.summary(deep))
  }

  private class UnreadableMessage : RuntimeException() {
    override val message: String get() = throw IllegalStateException("Do not expose a secondary failure")
  }

  @Test fun diagnosticFailureCannotReplaceTheOriginalException() {
    assertEquals("type=unknown exception=UnreadableMessage", StorageFailureDiagnostics.summary(UnreadableMessage()))
  }
}
