@prd @pending
Feature: Split-track and stem routing
  As a monitor engineer
  I want per-stem routing controls
  So that room and in-ear mixes can be built from the same pipeline.

  Scenario: Stems can be routed to left and right channels
    Given click stem is routed to right channel only
    And room stem is routed to left channel only
    When audio is rendered
    Then output contains channel-specific routing as configured

  Scenario: Cue stem can be isolated to in-ear channel
    Given cue stem routing is set to band-only
    When output is generated
    Then cues are absent from room channel output
