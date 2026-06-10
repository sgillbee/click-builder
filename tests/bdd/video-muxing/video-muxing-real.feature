@prd @real @muxsync
Feature: Real video mux sync validation
  As an operator
  I want deterministic real mux sync checks for signed alignment deltas
  So that I can trust D = 0, D > 0, and D < 0 behavior in production-like runs.

  Scenario: D = 0 keeps audio and video starts aligned
    Given video sync scenario fixture "d0"
    When real muxing is executed for the scenario
    Then ffprobe stream start timings align with the signed delta expectation

  Scenario: D > 0 delays video stream relative to audio
    Given video sync scenario fixture "dpos"
    When real muxing is executed for the scenario
    Then ffprobe stream start timings align with the signed delta expectation

  Scenario: D < 0 delays audio stream relative to video
    Given video sync scenario fixture "dneg"
    When real muxing is executed for the scenario
    Then ffprobe stream start timings align with the signed delta expectation

  Scenario: Section labels transition at section boundaries in fixture metadata
    Given section label fixture metadata "sections-4-4-80"
    Then section label windows match Lead Intro Verse 1 Chorus Outro boundaries
