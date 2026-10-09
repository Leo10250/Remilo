# Fixed artwork and scrolling content — 9 October 2026

The owner clarified that browsing artwork must stay still while the body moves
up and covers it. This supersedes the moving-scene detail in the original beta
plan. It changes shared component behavior without revising approved artwork.

## Research and decision

| Primary source | What it establishes | Remilo application |
|---|---|---|
| [Android collapsing layout parameters](https://developer.android.com/reference/com/google/android/material/appbar/CollapsingToolbarLayout.LayoutParams) | Android distinguishes pinned children from parallax; a zero parallax multiplier means zero movement. | Keep scene geometry independent of the scroll offset. Pin toolbar controls. |
| [Material scrolling techniques](https://m1.material.io/patterns/scrolling-techniques.html) | Fixed toolbars can retain their position while content scrolls beneath them. Flexible space can sit behind overlapping content in a separate layer. | Use an opaque reading surface above scenic decoration and below toolbar controls. |
| [Material 3 app bars](https://m3.material.io/components/app-bars/) | App bars separate navigation/title controls from content and adapt their presentation while scrolling. | Retain an opaque, readable toolbar once the scenic opening is covered. |
| [React Native 0.86 animations](https://reactnative.dev/docs/0.86/animations) | Native Animated directly maps scroll events to supported transforms; layout properties are not supported by the native driver. | Animate only the reading surface's translation. Do not resize the header, recrop imagery or update layout every frame. |

The older Material image example moves its image; it does not prescribe Remilo's
exact stationary composition. Stationary artwork with progressive occlusion is
the owner's product decision, built from the documented layering/pinning pattern.

## Layer contract

Use a fixed 200 dp opening below the status inset and a measured toolbar of at
least 56 dp. Let decorative height be opening minus toolbar height, and let `y`
be content scroll offset. The scene is always rendered at its original bounds
with its hero focal metadata. Its transform is always identity.

The opaque reading plane's leading edge is `toolbar + max(decoration - y, 0)`.
Content starts below the opening and moves naturally with scrolling. At the
decorative boundary the plane fills the body viewport, the toolbar becomes
opaque, and later content scrolls beneath it. Reverse scrolling reveals exactly
the remaining decorative height; full artwork returns only at the content top.
Never tie scene position, scale, crop or opacity to `y`.

The implementation shares one scroll value between FormViewport and Agenda's
SectionList. Its only animated header-related transform belongs to the opaque
reading plane. React state changes only at the opaque-toolbar boundary. Restored
scroll offsets initialize that plane before the page appears. Short/empty pages
retain enough scroll extent to cover decoration. Compact editing, small-height
and large-font fallbacks remove decorative space without changing content reach.
Reduced motion retains this direct relationship and introduces no spring, fade
or independent decorative transition.

Apply the shared behavior to Agenda, Lists, Repeats, named lists, Completed,
Trash, Settings, Appearance, reminder/family Details and Activity. Sheets and
editing/management/data workflows retain their compact treatment. Host fixtures
can check fixed geometry and layering; actual Android gesture performance,
TalkBack and lifecycle observations use the consolidated acceptance checklist.
