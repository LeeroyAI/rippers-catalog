#!/usr/bin/env ruby
# generate_xcodeproj.rb
#
# Regenerates Rippers.xcodeproj so it includes all .swift files under Rippers/.
# Run this whenever you add or remove Swift source files.
#
# Requires: gem install xcodeproj
#
# Usage:
#   ruby scripts/generate_xcodeproj.rb

require 'xcodeproj'
require 'pathname'
require 'set'

REPO_ROOT    = File.expand_path('..', __dir__)
PROJECT_PATH = File.join(REPO_ROOT, 'Rippers.xcodeproj')
SOURCE_ROOT  = File.join(REPO_ROOT, 'Rippers')
TARGET_NAME  = 'Rippers'

# Directories whose Swift files should NOT be added to the app target
EXCLUDED_DIRS = %w[Tests].freeze

project = Xcodeproj::Project.open(PROJECT_PATH)
target  = project.targets.find { |t| t.name == TARGET_NAME }

unless target
  abort "Error: target '#{TARGET_NAME}' not found in #{PROJECT_PATH}\nAvailable targets: #{project.targets.map(&:name).join(', ')}"
end

# Collect all .swift files currently in the app target's Sources build phase
sources_phase = target.source_build_phase
existing_paths = sources_phase.files.map { |f| f.file_ref&.real_path&.to_s }.compact.to_set

# Walk Rippers/ directory and collect all .swift files
swift_files = Dir.glob(File.join(SOURCE_ROOT, '**', '*.swift')).reject do |path|
  EXCLUDED_DIRS.any? { |dir| path.include?("/#{dir}/") }
end

added   = 0
skipped = 0

swift_files.each do |abs_path|
  next if existing_paths.include?(abs_path)

  rel_path = Pathname.new(abs_path).relative_path_from(Pathname.new(REPO_ROOT)).to_s
  group_path = File.dirname(rel_path).split('/').drop(1) # drop 'Rippers' prefix

  # Navigate/create the group hierarchy in the Xcode project
  group = project.main_group
  group_path.each do |component|
    existing = group.children.find { |c| c.is_a?(Xcodeproj::Project::Object::PBXGroup) && c.name == component }
    group = existing || group.new_group(component, component)
  end

  file_ref = group.new_file(abs_path)
  sources_phase.add_file_reference(file_ref)
  puts "  + #{rel_path}"
  added += 1
  skipped += 0
end

if added > 0
  project.save
  puts "\n✓ Added #{added} file(s) to target '#{TARGET_NAME}'. Project saved."
else
  puts "✓ No new files to add — project is up to date."
end

# Report any files in the project that no longer exist on disk
missing = sources_phase.files.select { |f|
  path = f.file_ref&.real_path&.to_s
  path && !File.exist?(path) && path.end_with?('.swift')
}

unless missing.empty?
  puts "\n⚠ The following files are referenced in the project but missing on disk:"
  missing.each { |f| puts "  - #{f.file_ref&.real_path}" }
  puts "  Run this script again after removing them from the project manually, or delete the references in Xcode."
end
