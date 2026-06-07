@prd @pending
Feature: Stem mixing and output leveling
  As an engineer
  I want stem-based mixing with controlled output levels
  So that musicians hear a consistent click volume across songs.

  Scenario: Metronome is the foundational stem
    Given generated click and cue events
    When stems are built
    Then the metronome stem is rendered continuously as the base layer
    And cue stems are mixed as overlays

  Scenario: Output normalization target is configurable
    Given a config value for normalization target of -3 dB
    When stems are mixed down
    Then output processing applies the configured target level

  Scenario: Clipping prevention is applied during mix
    Given overlapping click and cue transients
    When the mix is rendered
    Then the resulting output does not clip
