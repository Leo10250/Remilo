package com.remilo.alarm.system

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.remilo.alarm.core.DeliverySnapshot
import com.remilo.alarm.core.NotificationPostponeRequest
import com.remilo.alarm.core.RoutinePolicy
import com.remilo.alarm.data.AlertRecord
import org.json.JSONObject

/** Direct Activity PendingIntent: no receiver/service trampoline and no delivery mutation. */
internal object NotificationPostponeIntent {
  fun single(context: Context, record: AlertRecord): PendingIntent {
    require(record.profile != RoutinePolicy.PROFILE)
    return open(context, NotificationPostponeRequest.single(record.occurrenceId, record.generation))
  }

  fun group(context: Context, sessionId: String, members: List<AlertRecord>): PendingIntent {
    require(members.none { it.profile == RoutinePolicy.PROFILE })
    return open(context, NotificationPostponeRequest.group(sessionId,
      members.map { DeliverySnapshot.Member(it.occurrenceId, it.generation) }))
  }

  private fun open(context: Context, capture: Map<String, Any>): PendingIntent {
    val uri = Uri.Builder().scheme("remilo").authority("").path("/")
      .appendQueryParameter("postponeRequest", JSONObject(capture).toString()).build()
    val intent = Intent(Intent.ACTION_VIEW, uri)
      .setComponent(ComponentName(context.packageName, context.packageName + ".MainActivity"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }
}
