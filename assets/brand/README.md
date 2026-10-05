# Remilo identity

The owned mark is a geometric **R** with a separated notification dot. Its open
counter and diagonal leg identify Remilo without combining a clock and bell.
The application keeps its blue, `#245CD6`; status colors remain presentation accents.

`scripts/brand.mjs` owns the SVG/path geometry and exports all variants. Run it
from the repository root with an available Sharp package path; no Prebuild is used.
Adaptive and monochrome marks use the central 66 dp safe circle. Legacy and splash
tiles use a slightly larger optical size, while the 24 dp notification alpha mark
has a tighter frame. Every variant uses the same letter and dot geometry.

The exporter also writes an ignored synthetic mask/size review to
`verification/local/brand/icon-review.png`. That review checks circle, squircle,
rounded, monochrome, and small-size presentation; actual launcher/device checks
remain part of the owner acceptance run.
