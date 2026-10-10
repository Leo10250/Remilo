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
      store.authorizationEmail(publicationId)
    }, resolve = { email -> runOnUiThread {
      Identity.getAuthorizationClient(this).authorize(CalendarRuntime.request(email))
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
    try { CalendarConsent.requireGranted(result.grantedScopes) }
    catch (_: CalendarFailure) { Toast.makeText(this, "Google access was not fully granted. Your confirmed connection is unchanged.", Toast.LENGTH_LONG).show(); finish(); return }
    val token = result.accessToken
    if (token == null) { failed(); return }
    CalendarRuntime.get(applicationContext).authenticated(token, revision, publicationId) { success ->
      runOnUiThread { if (!success) Toast.makeText(this, "Google access was not confirmed. Return to Calendar settings to retry.", Toast.LENGTH_LONG).show(); finish() }
    }
  }
  private fun failed() { Toast.makeText(this, "Google access could not be opened. Check Google Play services and OAuth setup.", Toast.LENGTH_LONG).show(); finish() }
}
