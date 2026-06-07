import { z } from "zod";

// Shared Schemas
export const MeterSchema = z.tuple([z.number(), z.number()]);
export const MetronomeModeSchema = z.enum(["in-6", "in-4", "in-2"]);

// ==========================================
// 1. YAML Configuration Input Schema
// ==========================================

export const SectionConfigSchema = z.object({
  section: z.string(),
  measures: z.number().int().positive(),
  time_signature: z.string().optional(), // E.g., "4/4"
  tempo: z.number().optional(),
  metronome_mode: MetronomeModeSchema.optional(),
  section_markers_enabled: z.boolean().optional(),
  downbeat_emphasis_enabled: z.boolean().optional(),
  mid_beat_filler_enabled: z.boolean().optional(),
  count_cues_enabled: z.boolean().optional(),
  section_cue_override: z.string().optional(),
});

export const YamlConfigSchema = z.object({
  name: z.string(),
  tempo: z.number().positive(),
  time_signature: z.string(),
  click_profile: z.string().optional(),
  metronome_mode: MetronomeModeSchema.optional(),
  section_markers_enabled: z.boolean().optional(),
  downbeat_emphasis_enabled: z.boolean().optional(),
  mid_beat_filler_enabled: z.boolean().optional(),
  video_downbeat_offset: z.number().nonnegative(), // Milliseconds
  structure: z.array(SectionConfigSchema),
});

export type YamlConfig = z.infer<typeof YamlConfigSchema>;

// ==========================================
// 2. AST JSON Schema (Parser -> Timeline)
// ==========================================

export const TimelineCommandSchema = z.object({
  type: z.literal("section"),
  name: z.string(),
  measures: z.number().int().positive(),
  bpm: z.number().positive(),
  meter: MeterSchema,
  metronome_mode: MetronomeModeSchema.optional(),
  section_markers_enabled: z.boolean().optional(),
  downbeat_emphasis_enabled: z.boolean().optional(),
  mid_beat_filler_enabled: z.boolean().optional(),
  count_cues_enabled: z.boolean().optional(),
  section_cue_override: z.string().optional(),
});

export const AstJsonSchema = z.object({
  project_name: z.string(),
  video_downbeat_offset_ms: z.number().nonnegative(), // Floating point explicit in docs
  click_profile: z.string().optional(),
  timeline_commands: z.array(TimelineCommandSchema),
});

export type AstJson = z.infer<typeof AstJsonSchema>;

// ==========================================
// 3. Timeline JSON Schema (Timeline -> Renderer)
// ==========================================

export const TimelineEventSchema = z.object({
  timestamp_ms: z.number().nonnegative(), // Floating point
  stem: z.enum(["click", "cue", "room"]),
  asset: z.string(),
});

export const TimelineJsonSchema = z.object({
  video_downbeat_offset_ms: z.number().nonnegative(),
  click_profile: z.string().optional(),
  total_duration_ms: z.number().nonnegative(),
  events: z.array(TimelineEventSchema),
});

export type TimelineJson = z.infer<typeof TimelineJsonSchema>;