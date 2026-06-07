@prd @mock
Feature: Video muxing and sync alignment
  As an operator
  I want to preserve original video quality while syncing new click audio
  So that publish-ready outputs are fast and lossless.

  Scenario: Video stream is copied without re-encoding
    Given an input video and generated click audio
    When muxing is executed
    Then ffmpeg uses video stream copy mode
    And video is not re-encoded

  Scenario: Manual downbeat timecode drives sync offset
    Given a configured video downbeat offset
    And a generated count-in duration
    When muxing is executed
    Then the effective stream offset aligns beat one of the song with beat one in the video

  Scenario: First-frame pause is used for MVP delay behavior
    Given positive video delay is required
    When output is muxed for MVP mode
    Then the video stream starts after the configured delay window
