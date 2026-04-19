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

EXCLUDED_DIRS = %w[Tests].freeze

project = Xcodeproj::Project.open(PROJECT_PATH)
target  = project.targets.find { |t| t.name == TARGET_NAME }

unless target
  abort "Error: target '#{TARGET_NAME}' not found in #{PROJECT_PATH}\nAvailable targets: #{project.targets.map(&:name).join(', ')}"
end

sources_phase = target.source_build_phase
existing_paths = sources_phase.files.map { |f| f.file_ref&.real_path&.to_s }.compact.to_set

swift_files = Dir.glob(File.join(SOURCE_ROOT, '**', '*.swift')).reject do |path|
  EXCLUDED_DIRS.any? { |dir| path.include?("/#{dir}/") }
end

# Find the Rippers source group (the one with path = 'Rippers' directly under main_group)
rippers_group = project.main_group.children.find do |c|
  c.is_a?(Xcodeproj::Project::Object::PBXGroup) && c.path == 'Rippers'
end
abort "Could not find Rippers source group in project" unless rippers_group

added   = 0

swift_files.each do |abs_path|
  next if existing_paths.include?(abs_path)

  # Path relative to Rippers/ source root
  rel_from_source = Pathname.new(abs_path).relative_path_from(Pathname.new(SOURCE_ROOT)).to_s
  subdir_parts = File.dirname(rel_from_source).split('/').reject { |p| p == '.' }
  filename = File.basename(abs_path)

  # Navigate/create group hierarchy inside the Rippers group
  group = rippers_group
  subdir_parts.each do |component|
    existing = group.children.find { |c| c.is_a?(Xcodeproj::Project::Object::PBXGroup) && (c.name == component || c.path == component) }
    group = existing || group.new_group(component, component)
  end

  # Add file reference using just the filename so path resolves via the group hierarchy
  file_ref = group.new_file(filename)
  sources_phase.add_file_reference(file_ref)
  puts "  + Rippers/#{rel_from_source}"
  added += 1
end

if added > 0
  project.save
  puts "\n✓ Added #{added} file(s) to target '#{TARGET_NAME}'. Project saved."
else
  puts "✓ No new files to add — project is up to date."
end

missing = sources_phase.files.select { |f|
  path = f.file_ref&.real_path&.to_s
  path && !File.exist?(path) && path.end_with?('.swift')
}

unless missing.empty?
  puts "\n⚠ The following files are referenced in the project but missing on disk:"
  missing.each { |f| puts "  - #{f.file_ref&.real_path}" }
end
