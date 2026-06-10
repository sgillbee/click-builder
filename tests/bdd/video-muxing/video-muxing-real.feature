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

  Scenario: Leader-aware click intro yields D > 0 and delays video
    Given leader-aware real mux config with a click intro and 400ms video downbeat offset
    When leader-aware real pipeline muxing is executed
    Then ffprobe stream start timings align with leader-aware effective delta

  Scenario: Complex 6/8 click cues preserve the longer beat grid through mux
    Given video sync scenario fixture "complex-6-8"
    And section label fixture metadata "sections-6-8-70"
    When real muxing is executed for the scenario
    Then ffprobe stream start timings align with the signed delta expectation
    Then complex 6/8 click cues preserve the longer beat grid through mux
    Then complex 6/8 click cues remain phase aligned over extended duration
    Then complex 6/8 section label windows match long-form arrangement

  Scenario: Section labels transition at section boundaries in fixture metadata
    Given section label fixture metadata "sections-4-4-80"
    Then section label windows match Lead Intro Verse 1 Chorus Outro boundaries
