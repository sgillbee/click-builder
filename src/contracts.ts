import { z } from "zod";

// Shared Schemas
export const MeterSchema = z.tuple([z.number(), z.number()]);
export const MetronomeModeSchema = z.enum(["in-6", "in-4", "in-2"]);
export const SectionDesignatorSchema = z.enum(["song", "click"]);

export const StemRoutingSchema = z.object({
  left_percent: z.number().int().min(0).max(100).optional(),
  right_percent: z.number().int().min(0).max(100).optional(),
});

export const GeneratedStemSourceSchema = z.object({
  type: z.literal("generated"),
  generated_stem: z.enum(["click", "cue"]),
});

export const SourceVideoAudioStemSourceSchema = z.object({
  type: z.literal("source-video-audio"),
});

export const StemSourceSchema = z.union([
  GeneratedStemSourceSchema,
  SourceVideoAudioStemSourceSchema,
]);

export const StemConfigSchema = z.object({
  id: z.string(),
  source: StemSourceSchema,
  routing: StemRoutingSchema.optional(),
});

export const NormalizedStemRoutingSchema = z.object({
  left: z.number().int().min(0).max(100),
  right: z.number().int().min(0).max(100),
});

export const NormalizedStemSchema = z.object({
  id: z.string(),
  source: StemSourceSchema,
  routing: NormalizedStemRoutingSchema,
});

// ==========================================
// 1. YAML Configuration Input Schema
// ==========================================

export const SectionConfigSchema = z.object({
  section: z.string(),
  measures: z.number().int().positive(),
  final_measure_beats: z.number().int().positive().optional(),
  time_signature: z.string().optional(), // E.g., "4/4"
  tempo: z.number().optional(),
  section_designator: SectionDesignatorSchema.optional(),
  count_in_enabled: z.boolean().optional(),
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
  input_video_path: z.string().optional(),
  output_video_path: z.string().optional(),
  count_in_enabled: z.boolean().optional(),
  metronome_mode: MetronomeModeSchema.optional(),
  section_markers_enabled: z.boolean().optional(),
  downbeat_emphasis_enabled: z.boolean().optional(),
  mid_beat_filler_enabled: z.boolean().optional(),
  video_downbeat_offset_ms: z.number().nonnegative().optional(), // Milliseconds
  video_downbeat_offset: z.number().nonnegative().optional(), // Legacy alias
  stems: z.array(StemConfigSchema).optional(),
  structure: z.array(SectionConfigSchema),
}).superRefine((value, ctx) => {
  if (value.video_downbeat_offset_ms === undefined && value.video_downbeat_offset === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "video_downbeat_offset_ms is required",
      path: ["video_downbeat_offset_ms"],
    });
  }
});

export type YamlConfig = z.infer<typeof YamlConfigSchema>;

// ==========================================
// 2. AST JSON Schema (Parser -> Timeline)
// ==========================================

export const TimelineCommandSchema = z.object({
  type: z.literal("section"),
  name: z.string(),
  measures: z.number().int().positive(),
  final_measure_beats: z.number().int().positive().optional(),
  bpm: z.number().positive(),
  meter: MeterSchema,
  section_designator: SectionDesignatorSchema.optional(),
  count_in_enabled: z.boolean().optional(),
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
  input_video_path: z.string().optional(),
  output_video_path: z.string().optional(),
  stems: z.array(NormalizedStemSchema).optional(),
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
  input_video_path: z.string().optional(),
  output_video_path: z.string().optional(),
  stems: z.array(NormalizedStemSchema).optional(),
  total_duration_ms: z.number().nonnegative(),
  events: z.array(TimelineEventSchema),
});

export type TimelineJson = z.infer<typeof TimelineJsonSchema>;