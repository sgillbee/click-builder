@prd @mock
Feature: CLI and processing error handling
  As an operator
  I want clear diagnostics for invalid inputs and processing failures
  So that I can quickly correct configuration and media problems.

  Scenario: Missing config file fails with actionable error
    Given a missing config file path
    When the parser CLI is executed
    Then the command exits non-zero
    And the error is written to stderr

  Scenario: Invalid YAML schema fails before pipeline handoff
    Given YAML missing required fields
    When config parsing runs
    Then schema validation fails with a structured error message

  Scenario: ffmpeg failure surfaces command diagnostics
    Given ffmpeg exits with an error code during render or mux
    When the pipeline runs
    Then the failing stage logs diagnostics to stderr
    And the pipeline exits non-zero
