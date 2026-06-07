Feature: Click builder pipeline
  As a user converting lyric videos into click-track videos
  I want the pipeline to preserve beat timing and hand off between stages cleanly
  So that I can trust the generated output.

  Scenario: Parse a valid config into a strict AST contract
    Given a YAML config with a count-in, a base tempo, and a meter shift
    When the config parser reads the configuration
    Then the parser returns an AST with floating point downbeat offsets and section commands

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
