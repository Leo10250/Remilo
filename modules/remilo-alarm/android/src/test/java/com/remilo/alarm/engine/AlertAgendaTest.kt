package com.remilo.alarm.engine

import android.app.Application
import android.content.Context
import android.os.UserManager
import com.remilo.alarm.data.*
import com.remilo.alarm.system.AlarmRegistrar
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Instant
import java.time.ZoneId
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[34],application=Application::class)
class AlertAgendaTest {
  private lateinit var context: Context
  private lateinit var engine: AlarmEngine
  private var now = 1_800_000_000_000L
  private val day get() = Instant.ofEpochMilli(now).atZone(ZoneId.systemDefault()).toLocalDate()
  private fun start(days: Long) = day.plusDays(days).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
  @Before fun setup() {
    context=RuntimeEnvironment.getApplication()
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    context.deleteDatabase("remilo-content.db")
    context.createDeviceProtectedStorageContext().deleteDatabase("remilo-operational.db")
    engine=AlarmEngine(context,object:AlarmRegistrar {
      override fun canSchedule()=true
      override fun register(alert:AlertRecord) {}
      override fun cancel(alert:AlertRecord) {}
    },{now},{10_000L})
  }
  @After fun teardown() {engine.close()}
  private fun request(block:()->Any?):Any? {
    val result=CompletableFuture<Any?>()
    engine.request(block,{result.complete(it)},{result.completeExceptionally(AssertionError(it))})
    return result.get(20,TimeUnit.SECONDS)
  }
  private fun insert(id:String,alert:Long,due:Long,event:Long=start(3),mode:String="Alarm",state:String="Scheduled") {
    request {
      val ce=ContentDatabase.open(context);val dp=OperationalDatabase.open(context)
      try {
        ce.records().insert(ReminderRecord(id,id,event,event+1_800_000,due,now,mode=mode,definedAlarmAtMs=alert))
        dp.records().put(AlertRecord(id,alert,1,state,mode=mode))
      } finally {ce.close();dp.close()}
    }
  }
  private fun query(view:String="agenda",cursor:String?=null)=request {engine.query(view,cursor)} as Map<*,*>
  private fun rows(page:Map<*,*>)=(page["items"] as List<*>).map {it as Map<*,*>}

  @Test fun todayAndUpcomingFollowAlertRatherThanIndependentDueOrEvent() {
    insert("due-tomorrow",now+1_000,start(1)+36_000_000)
    insert("alert-tomorrow",start(1)+36_000_000,start(1)-1)
    assertEquals(listOf("due-tomorrow"),rows(query("today")).map {it["id"]})
    assertEquals(listOf("alert-tomorrow"),rows(query("upcoming")).map {it["id"]})
    assertEquals(now+1_000,rows(query("today")).single()["agendaAtMs"])
    assertEquals(day.toString(),rows(query("today")).single()["agendaGroup"])
  }
  @Test fun overdueRemainsFirstWithFuturePostponeAndNoAlertUsesDue() {
    insert("postponed",start(1)+36_000_000,now-1,event=start(-2))
    insert("none",start(4),now+1_000,mode="None",state="NoAlert")
    val page=query();val rows=rows(page)
    assertEquals("postponed",rows[0]["id"]);assertEquals("overdue",rows[0]["agendaGroup"])
    assertEquals(start(1)+36_000_000,rows[0]["agendaAtMs"])
    assertEquals(now+1_000,rows[1]["agendaAtMs"])
    assertEquals(1,(page["groups"] as Map<*,*>)["overdue"])
    assertEquals(1,query("overdue")["total"])
  }
  @Test fun nativeOrderingCountsAndEqualTimeIdsAreStableBeforePagination() {
    for(i in 0 until 64)insert("row-${i.toString().padStart(2,'0')}",now+1_000+(i/2)*60_000L,start(2),event=start(4)-i*1_000)
    val first=query();val second=query(cursor=first["nextCursor"] as String)
    val combined=rows(first)+rows(second)
    assertEquals(64,first["total"]);assertEquals(64,(first["groups"] as Map<*,*>)[day.toString()])
    assertEquals(50,rows(first).size);assertEquals(14,rows(second).size);assertNull(second["nextCursor"])
    assertEquals((0 until 64).map {"row-${it.toString().padStart(2,'0')}"},combined.map {it["id"]})
    assertTrue(combined.zipWithNext().all {(a,b)->(a["agendaAtMs"] as Long) <= (b["agendaAtMs"] as Long)})
  }
  @Test fun midnightDstAndDeviceZoneChangesUseOneLocalAnchorDate() {
    val original = java.util.TimeZone.getDefault()
    try {
      java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("America/Los_Angeles"))
      now = Instant.parse("2026-03-08T08:00:00Z").toEpochMilli()
      val today = Instant.parse("2026-03-09T06:59:00Z").toEpochMilli()
      val tomorrow = Instant.parse("2026-03-09T07:00:00Z").toEpochMilli()
      insert("today", today, tomorrow + 86_400_000)
      insert("tomorrow", tomorrow, tomorrow + 86_400_000)
      assertEquals(listOf("today"), rows(query("today")).map { it["id"] })
      assertEquals(listOf("tomorrow"), rows(query("upcoming")).map { it["id"] })
      now = tomorrow
      assertEquals(listOf("today", "tomorrow"), rows(query()).map { it["id"] })
      assertEquals("earlier", rows(query())[0]["agendaGroup"])
      assertEquals(listOf("tomorrow"), rows(query("today")).map { it["id"] })
      java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("UTC"))
      assertEquals(listOf("today", "tomorrow"), rows(query("today")).map { it["id"] })
      assertTrue(rows(query()).all { it["agendaGroup"] == "2026-03-09" })
    } finally { java.util.TimeZone.setDefault(original) }
  }

  @Test fun intendedAndPastDeliveryStatesKeepTheirAnchorWithoutChangingEligibility() {
    for((i,state) in listOf("Blocked","Pending","Paused","Missed","Notified").withIndex())
      insert(state,if(state=="Missed"||state=="Notified")start(-1)+36_000_000 else now+1_000+i, start(2),state=state)
    val rows=rows(query())
    assertEquals(setOf("Blocked","Pending","Paused","Missed","Notified"),rows.map {it["deliveryState"]}.toSet())
    assertEquals(2,rows.count {it["agendaGroup"]=="earlier"})
    assertTrue(rows.all {it["completed"]==false})
  }
}
