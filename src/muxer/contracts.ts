import { z } from "zod";

export const MuxerInputSchema = z.object({
  // Raw source video downbeat offset in ms from config.
  video_downbeat_offset_ms: z.number(),
  // First click timestamp relative to song downbeat in ms (negative when click intro leads).
  first_click_timestamp_ms: z.number().optional(),
  // Signed alignment delta in ms. Positive delays video; negative delays audio.
  effective_signed_delta_ms: z.number().optional(),
  generated_audio_path: z.string(),
  original_video_path: z.string(),
  output_video_path: z.string(),
  audio_codec: z.string().optional(),
});

export type MuxerInput = z.infer<typeof MuxerInputSchema>;