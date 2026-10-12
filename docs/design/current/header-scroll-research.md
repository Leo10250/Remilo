# Fixed artwork and continuous browsing header — 11 October 2026

The owner clarified that browsing artwork must stay still while the body moves
up and covers it. This supersedes the moving-scene detail in the original beta
plan. It changes shared component behavior without revising approved artwork.

On 11 October the owner rejected the sudden opaque-header transition and chose
the soft surface blend, stable title/icon colors, and direct scroll blending even
with Remove animations enabled. This supersedes the earlier boundary-switch and
no-fade rules below; the fixed-artwork and opaque-reading-plane requirements remain.

## Research and decision

| Primary source | What it establishes | Remilo application |
|---|---|---|
| [Android collapsing layout parameters](https://developer.android.com/reference/com/google/android/material/appbar/CollapsingToolbarLayout.LayoutParams) | Android distinguishes pinned children from parallax; a zero parallax multiplier means zero movement. | Keep scene geometry independent of the scroll offset. Pin toolbar controls. |
| [Material scrolling techniques](https://m1.material.io/patterns/scrolling-techniques.html) | Fixed toolbars can retain their position while content scrolls beneath them. Flexible space can sit behind overlapping content in a separate layer. | Use an opaque reading surface above scenic decoration and below toolbar controls. |
| [Material 3 app bars](https://m3.material.io/components/app-bars/) | App bars separate navigation/title controls from content and adapt their presentation while scrolling. | Retain an opaque, readable toolbar once the scenic opening is covered. |
| [React Native 0.86 animations](https://reactnative.dev/docs/0.86/animations) | Native Animated maps scroll events to transforms and opacity without per-frame React updates. | Drive reading-plane translation and protective-surface opacity from one value; keep artwork and layout fixed. |
| [Apple materials](https://developer.apple.com/design/human-interface-guidelines/materials) | Soft scroll-edge effects separate controls from moving content while protecting legibility. | Borrow gradual separation, using Remilo's canvas surface rather than introducing Apple-specific controls. |
| [Android app-bar colors](https://developer.android.com/reference/kotlin/androidx/compose/material3/TopAppBarColors) | Container color adapts to scroll state independently of foreground colors. | Keep title/icons in one foreground role throughout the blend. |
| [Expo SDK 57 LinearGradient](https://docs.expo.dev/versions/v57.0.0/sdk/linear-gradient/) | A supported native/Web gradient view is available as ~57.0.2. | Use a static gradient inside an opacity-driven Animated.View instead of the experimental background-image property. |

The older Material image example moves its image; it does not prescribe Remilo's
exact stationary composition. Stationary artwork with progressive occlusion is
the owner's product decision, built from the documented layering/pinning pattern.
The [June 2026 mobile-motion review](https://apps-eprint4-l.ncl.ac.uk/312636)
supports purposeful feedback and continuity; the [2022 animation study](https://arxiv.org/abs/2211.11993)
documents distraction from irrelevant motion. Neither directly tests this header.
The 64 dp span and scrim policy are explicit Remilo choices, not published optima.

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
SectionList. The reading plane retains its existing translation. A single static
canvas-colored gradient has a plateau through measured title/actions/subtitle
bounds and a 40 dp feather below them. Until subtitle measurement is available,
protect the full opening. Foreground uses the current pair's onSurface throughout;
Night Light therefore has dark controls over a light protective surface. Existing
scene-specific header tokens and native alarm presentation are not revised.

Let D be decorative height and B = min(64, D). For D > 0,
p = clamp((y - (D - B)) / B, 0, 1), blend = p²(3 - 2p), and surface opacity is
0.66 + 0.34 × blend. With the ordinary 200/56 dp geometry, blending begins at
80 dp, reaches 83% opacity at 112 dp, and becomes opaque at 144 dp. The 66%
canvas scrim/onSurface pair must retain at least 4.5:1 normal-text contrast over
black/white artwork bounds and every intermediate state in all eight pairs.

Use native Animated arithmetic on Android; no threshold state or per-scroll React
update controls appearance. Title/actions remain mounted once, with stable
positions, semantics and interaction styling. Decorative layers ignore input and
are excluded from accessibility. Restoration initializes both cover and opacity
before appearance; overscroll clamps, and reverse scrolling follows the same curve.
Short/empty pages retain cover extent. Compact editing, small-height and large-font
fallbacks remove decoration and render an opaque toolbar. Reduced motion retains
the direct blend and introduces no timer, spring, delay or independent movement.

Apply the shared behavior to Agenda, Lists, Repeats, named lists, Completed,
Trash, Settings, Appearance, reminder/family Details and Activity. Sheets and
editing/management/data workflows retain their compact treatment. Host fixtures
can check fixed geometry and layering; actual Android gesture performance,
TalkBack and lifecycle observations use the consolidated acceptance checklist.
