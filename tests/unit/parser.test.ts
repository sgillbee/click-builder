import { describe, expect, it } from "vitest";
import { parseConfigToAst } from "../../src/parser/parser.js";

describe("Given a YAML config, when parsed, then the AST matches the data contract", () => {
  it("parses tempo, offsets, and mid-song meter shifts", () => {
    const yamlContent = `
name: "Great Are You Lord"
tempo: 72
time_signature: 6/8
video_downbeat_offset: 4230.5
structure:
  - section: "Count-in"
    measures: 1
  - section: "Verse 1"
    measures: 8
  - section: "Bridge"
    measures: 4
    time_signature: 4/4
`;

    const ast = parseConfigToAst(yamlContent);

    expect(ast.project_name).toBe("Great Are You Lord");
    expect(ast.video_downbeat_offset_ms).toBe(4230.5);
    expect(ast.timeline_commands).toHaveLength(3);
    expect(ast.timeline_commands[0]).toMatchObject({
      type: "section",
      name: "Count-in",
      measures: 1,
      bpm: 72,
      meter: [6, 8],
    });
    expect(ast.timeline_commands[2]).toMatchObject({
      type: "section",
      name: "Bridge",
      measures: 4,
      bpm: 72,
      meter: [4, 4],
    });
  });

  it("throws on malformed input missing required config fields", () => {
    const yamlContent = `
name: "Broken Song"
tempo: 72
time_signature: 6/8
structure:
  - section: "Intro"
    measures: 1
`;

    expect(() => parseConfigToAst(yamlContent)).toThrow();
  });
});
