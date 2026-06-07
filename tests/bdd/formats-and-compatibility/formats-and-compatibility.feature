@prd @mock
Feature: Input and output format compatibility
  As a production user
  I want common media format support for input and output
  So that I can work with existing church media libraries.

  Scenario: Accept common video container formats
    Given source video files in mp4 and mov
    When inputs are validated
    Then each supported format is accepted

  Scenario: Accept common source audio fragment formats
    Given cue and click fragments in wav and mp3
    When fragments are loaded
    Then each supported format is accepted for rendering

  Scenario: Output container and audio codec are configurable
    Given an output target of mp4 with AAC audio
    When pipeline rendering completes
    Then output uses the configured container and codec combination
