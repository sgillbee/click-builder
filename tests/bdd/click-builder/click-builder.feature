Feature: Click builder pipeline
  As a user converting lyric videos into click-track videos
  I want the pipeline to preserve beat timing and hand off between stages cleanly
  So that I can trust the generated output.

  Scenario: Parse a valid config into a strict AST contract
    Given a YAML config with a count-in, a base tempo, and a meter shift
    When the config parser reads the configuration
    Then the parser returns an AST with floating point downbeat offsets and section commands

  Scenario: Build a six-measure click track from a simple 4/4 intro config
    Given the following YAML config
      """
      name: "Simple Intro Click"
      tempo: 80
      time_signature: 4/4
      video_downbeat_offset: 0
      click_profile: assets/click-profiles/PraiseCharts.config.yml
      section_markers_enabled: false
      downbeat_emphasis_enabled: true
      mid_beat_filler_enabled: false
      structure:
        - section: "Lead"
          measures: 1
        - section: "Count-in"
          measures: 1
        - section: "Intro"
          measures: 4
      """
    When the config parser reads the configuration
    And the simple click timeline is generated
    Then the click timeline spans six measures total
    And the timeline duration is 18000 milliseconds

  @real
  Scenario: Render simple intro click WAV and match approved reference
    Given the simple intro click fixture config and reference wav
    When I render the simple intro click wav from the fixture config
    Then the rendered wav matches the approved reference wav

  @mock
  Scenario: Build the final video through the pipeline with mocked media edges
    Given a valid YAML config and an input video file
    When I run the click builder pipeline with mocked media edges
    Then the pipeline produces a final muxed video file
    And each stage hands off structured data to the next stage

  @real @pending
  Scenario: Build the final video through the full ffmpeg pipeline
    Given a valid YAML config and an input video file
    When I run the click builder pipeline end to end with ffmpeg
    Then the pipeline produces a final muxed video file
    And each stage hands off structured data to the next stage
