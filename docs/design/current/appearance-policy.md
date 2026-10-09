# Global appearance policy

[A36 owner decision](../approved-time-of-day-realignment.json) · 8 October 2026.
Use [all eight R3 references](../remilo-r3-atmospheres/gallery.html) and
[the shared visual language](visual-language.md) for resolved presentation.

## Selection

Settings → Appearance exposes one **Atmosphere** dropdown with five choices:
**Automatic, Sunrise, Sky, Evening, Night**. Its single-choice list has visible
selection and accessible labels. Brightness remains a separate **System / Light /
Dark** preference. System means the device's Light/Dark appearance, not time-of-day.
Valid selections use the existing serialized auto-saving preference controller.

Automatic follows the current device-local clock and timezone. A manual atmosphere
stays selected until the user selects Automatic again. A manually selected scene
does not acquire a timer or follow a reminder's event, due or alert time.

| Resolved atmosphere | Device-local interval, start inclusive / end exclusive |
|---|---|
| Sunrise | 06:00–10:00 |
| Sky | 10:00–17:00 |
| Evening | 17:00–21:00 |
| Night | 21:00–06:00 |

Every instant maps to one period; 10:00 is Sky, 17:00 Evening, 21:00 Night and
06:00 Sunrise. Night crosses midnight. The scene names are fixed local clock
periods, not astronomical sunrise/sunset, weather or location observations.

New installations and upgrades without an atmosphere preference use **Automatic**.
Preserve existing System/Light/Dark brightness. Unknown/unusable selection follows
the same Automatic fallback without silently overwriting the stored preference.
There is no deployed eight-palette preference to migrate: old catalogs and
per-reminder descriptors are review/planning artifacts, not persisted production fields.

## Resolution and lifecycle

- One shared contract resolves scene identity independently of brightness. App
  pages, sheets and new native sessions consume the same semantic role mapping.
- Reconcile on foreground boundaries, resume, device-clock and timezone changes.
  After a long absence, resolve the current period; do not replay missed transitions.
- Coalesce automatic scene changes while an editor, picker, confirmation or
  uncertain command is active. Apply the latest resolved scene at safe dismissal
  or route exit. Retain draft/composing text, caret, focus, scroll, operation IDs
  and selection; recoloring must not remount the workflow. Explicit preference
  selection updates its preview without discarding state. Reduced motion is immediate.
- A native ringing session captures its resolved atmosphere/brightness at creation.
  Arrivals, member removal, refresh, rotation, unlock and crossing a period boundary
  retain that presentation. A new session resolves again. Audio deadline, sound,
  delivery generations and Done/Snooze are independent of appearance.
- Foreground cosmetic observation is not alarm delivery. Do not add exact alarms,
  closed-app cosmetic workers, network/classification calls or launcher switching.

## Native and pre-unlock boundary

TD-02 documents/implements a minimal allowlisted non-private native appearance
mirror; TD-04 consumes it. The mirror carries global selection and brightness
policy only. Titles, notes, list/category identities, credentials, user image paths
and content-derived choices stay outside device-protected appearance data.

Before first unlock, resolve bundled scenes/roles natively without React, network
or credential reads. If no usable safe preference exists, resolve Automatic with
System brightness. Keep generic Reminder text and operational alarm time/actions.
Unlock does not authorize public notification disclosure of private content.

Artwork/token failure must retain usable native controls and cannot block audio,
foreground promotion or Done/Snooze. Emergency rendering is a failure path, not
the normal pre-unlock design. Storage fields/update ordering are implementation
contracts to verify in TD-02; this document introduces no schema version or engine API.

## Reference correction

Earlier R8 screenshots show four scenic manual choices and omit/hold Automatic.
Keep those images unchanged as accepted style/workflow references. A36's five-value
dropdown and policy supersede their selector/availability differences. Their
held review clock does not demonstrate automatic switching. [Settings](screens/settings.md)
and [the gallery supplement](../remilo-r8-settings-appearance/current-policy.md)
carry this correction beside the original image review.
