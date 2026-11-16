require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# Facts about the installed binary: the store receipt's name, the version and the build. iOS only.
Pod::Spec.new do |s|
  s.name           = 'AgenticoInstallInfo'
  s.version        = package['version']
  s.summary        = 'Store receipt name, version and build of the installed binary'
  s.description    = s.summary
  s.license        = { type: 'MIT' }
  s.author         = 'OpenAgentsPocket contributors'
  s.homepage       = 'https://github.com/openagentspocket'
  s.platforms      = { ios: '18.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
end
