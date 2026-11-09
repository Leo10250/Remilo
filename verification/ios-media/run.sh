#!/bin/sh
set -eu

cd "$(dirname "$0")/../.."
pod="$(pwd)/ios/Pods/libwebp"
build_dir="$(mktemp -d)"
trap 'rm -f "$build_dir/module.modulemap" "$build_dir/libwebp.dylib" "$build_dir/checks"; rmdir "$build_dir"' EXIT

# Compile the same pinned CocoaPods source for the macOS fixture executable.
xcrun clang -dynamiclib -O2 -D_THREAD_SAFE -I "$pod" \
  -install_name "$build_dir/libwebp.dylib" -o "$build_dir/libwebp.dylib" \
  "$pod"/sharpyuv/*.c "$pod"/src/dec/*.c "$pod"/src/dsp/*.c \
  "$pod"/src/enc/*.c "$pod"/src/utils/*.c
cat > "$build_dir/module.modulemap" <<EOF
module libwebp {
    header "$pod/src/webp/encode.h"
    header "$pod/src/webp/decode.h"
    export *
}
EOF
xcrun swiftc -swift-version 5 -parse-as-library -I "$build_dir" -L "$build_dir" -lwebp \
  -o "$build_dir/checks" modules/remilo-alarm/ios/RemiloIOSExerciseImages.swift verification/ios-media/MediaChecks.swift
"$build_dir/checks"
