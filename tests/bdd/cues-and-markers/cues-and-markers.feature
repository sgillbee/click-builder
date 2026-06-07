@prd @pending
Feature: Count-in, section cues, and optional markers
  As a band member
  I want spoken and section cues layered on top of the metronome foundation
  So that I can navigate song structure confidently.

  Scenario: Count-in overlays metronome clicks
    Given a configuration with a one-measure metronome pre-roll and a one-measure spoken count-in
    When audio stems are rendered
    Then count-in cues are overlaid at matching beat timestamps on top of click events

  Scenario: Section markers are optional
    Given a song configuration with section markers disabled
    When the click track is generated
    Then only metronome events are emitted
    And no section-cue stem is rendered

  Scenario: Section cues fire at section boundaries
    Given a song with Intro, Verse, Chorus, and Bridge sections
    When the timeline is generated
    Then a section cue is emitted at the first beat of each section
