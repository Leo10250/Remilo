package com.remilo.alarm.calendar

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.IntentSenderRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.remilo.alarm.engine.AlarmEngine

/** No Direct Boot, exported entry point, persistent tokens, or reminder content in its Intent. */
class CalendarAuthorizationActivity : ComponentActivity() {
  private var revision = 0L
  private var awaitingResult = false
  private val publicationId get() = intent.getStringExtra("publicationId")
  private val managedCalendarCreation get() = intent.getBooleanExtra("managedCalendarCreation", false)
  private val launcher = registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
    if (result.resultCode != RESULT_OK || result.data == null) finish()
    else try { accept(Identity.getAuthorizationClient(this).getAuthorizationResultFromIntent(result.data)) }
    catch (_: Exception) { failed() }
  }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    revision = savedInstanceState?.getLong("revision") ?: 0L
    awaitingResult = savedInstanceState?.getBoolean("awaitingResult") ?: false
    if (savedInstanceState != null) {
      if (!awaitingResult) finish() // No token persistence: retry interrupted setup from Settings.
      return // Android restores an outstanding Activity Result.
    }
    if (CalendarRuntime.get(applicationContext).revoking) { failed(); return }
    AlarmEngine.get(applicationContext).calendarRequest(block = { store ->
      revision = store.connection().revision
      if (managedCalendarCreation) store.connection().takeIf { it.connected }?.email ?: throw CalendarFailure("NEEDS_ACCESS")
      else store.authorizationEmail(publicationId)
    }, resolve = { email -> runOnUiThread {
      Identity.getAuthorizationClient(this).authorize(GoogleCalendarAuthorization.request(email, managedCalendarCreation))
        .addOnSuccessListener { result ->
          if (isDestroyed || isFinishing) return@addOnSuccessListener
          if (result.hasResolution()) { awaitingResult = true; launcher.launch(IntentSenderRequest.Builder(result.pendingIntent!!.intentSender).build()) }
          else accept(result)
        }.addOnFailureListener { failed() }
    } }, reject = { runOnUiThread { failed() } })
  }
  override fun onSaveInstanceState(outState: Bundle) { outState.putLong("revision", revision); outState.putBoolean("awaitingResult", awaitingResult); super.onSaveInstanceState(outState) }
  private fun accept(result: AuthorizationResult) {
    awaitingResult = false
    try { CalendarConsent.requireGranted(result.grantedScopes, managedCalendarCreation) }
    catch (_: CalendarFailure) { Toast.makeText(this, "Google access was not fully granted. Your confirmed connection is unchanged.", Toast.LENGTH_LONG).show(); finish(); return }
    val token = result.accessToken
    if (token == null) { failed(); return }
    val done: (Boolean) -> Unit = { success ->
      runOnUiThread { if (!success) Toast.makeText(this, "Google access was not confirmed. Return to Calendar settings to retry.", Toast.LENGTH_LONG).show(); finish() }
    }
    if (managedCalendarCreation) CalendarRuntime.get(applicationContext).managedAuthenticated(token, revision, done)
    else CalendarRuntime.get(applicationContext).authenticated(token, revision, publicationId, done)
  }
  private fun failed() { Toast.makeText(this, "Google access could not be opened. Check Google Play services and OAuth setup.", Toast.LENGTH_LONG).show(); finish() }
}
