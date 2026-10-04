$remiloRoot = Split-Path -Parent $PSScriptRoot
$env:Path = (Join-Path $remiloRoot '.tooling\node-v22.23.3-win-x64') + ';' + $env:Path
$env:JAVA_HOME = Join-Path $remiloRoot '.tooling\jdk-17.0.20.1+1'
$env:ANDROID_HOME = Join-Path $remiloRoot '.tooling\android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
