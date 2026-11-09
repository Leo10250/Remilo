Pod::Spec.new do |s|
  s.name = 'RemiloAlarm'
  s.version = '0.4.0'
  s.summary = 'Remilo reminder engine and Expo module for iOS.'
  s.homepage = 'https://github.com/Leo10250/Remilo'
  s.license = { :type => 'Proprietary' }
  s.author = 'Remilo'
  s.source = { :git => 'https://github.com/Leo10250/Remilo.git' }
  s.platform = :ios, '26.0'
  s.swift_version = '5.0'
  s.static_framework = true
  s.source_files = '**/*.swift'
  s.dependency 'ExpoModulesCore'
  s.dependency 'ZIPFoundation', '0.9.20'
  s.dependency 'libwebp/webp', '1.6.0'
  s.resources = ['ZIPFoundation-LICENSE', 'libwebp-COPYING', 'libwebp-PATENTS']
  s.frameworks = 'AlarmKit', 'AppIntents', 'BackgroundTasks', 'PhotosUI', 'UserNotifications'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
