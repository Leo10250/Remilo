package com.remilo.alarm.calendar

import com.remilo.alarm.presentation.L10n

internal fun CalendarConnection.localizedMessage(): CalendarConnection {
  val localized = L10n.calendarDescriptor(message)
  return copy(messageKey = localized?.key.orEmpty(), messageArgs = L10n.argsJson(localized))
}
internal fun CalendarOperation.localizedMessage(): CalendarOperation {
  val localized = L10n.calendarDescriptor(message)
  return copy(messageKey = localized?.key.orEmpty(), messageArgs = L10n.argsJson(localized))
}
internal fun CalendarLink.localizedMessage(): CalendarLink {
  val localized = L10n.calendarDescriptor(message)
  return copy(messageKey = localized?.key.orEmpty(), messageArgs = L10n.argsJson(localized))
}
internal fun CalendarLinkOperation.localizedMessage(): CalendarLinkOperation {
  val localized = L10n.calendarDescriptor(message)
  return copy(messageKey = localized?.key.orEmpty(), messageArgs = L10n.argsJson(localized))
}
internal fun CalendarManagedBinding.localizedMessage(): CalendarManagedBinding {
  val localized = L10n.calendarDescriptor(message)
  return copy(messageKey = localized?.key.orEmpty(), messageArgs = L10n.argsJson(localized))
}
internal fun CalendarManagedSetupOperation.localizedMessage(): CalendarManagedSetupOperation {
  val localized = L10n.calendarDescriptor(message)
  return copy(messageKey = localized?.key.orEmpty(), messageArgs = L10n.argsJson(localized))
}
