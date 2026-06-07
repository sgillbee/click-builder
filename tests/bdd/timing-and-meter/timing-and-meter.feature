@prd @mock
Feature: Tempo, meter, and beat placement
  As a music director
  I want beat timing to remain sample-accurate across all sections
  So that the click track never drifts from the intended arrangement.

  Scenario: Mid-song meter shift keeps timeline mathematically consistent
    Given a song that starts in 4/4
    And switches to 2/4 for one measure
    And returns to 4/4
    When the timeline is generated
    Then all subsequent beat timestamps remain aligned to absolute time

  Scenario: 6/8 click subdivision supports in-6, in-4, and in-2 modes
    Given a song in 6/8 meter
    When the metronome mode is set to "in-6"
    Then six click pulses are generated per bar
    When the metronome mode is set to "in-4"
    Then four click pulses are generated per bar
    When the metronome mode is set to "in-2"
    Then two click pulses are generated per bar

  Scenario: Floating-point millisecond precision is preserved
    Given a section at 139 BPM
    When beat timestamps are emitted
    Then timestamp values retain floating-point precision
    And they are not rounded to integer milliseconds
