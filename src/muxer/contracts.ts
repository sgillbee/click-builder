import { z } from "zod";

export const MuxerInputSchema = z.object({
  video_downbeat_offset_ms: z.number().nonnegative(),
  generated_audio_path: z.string(),
  original_video_path: z.string(),
  output_video_path: z.string(),
});

export type MuxerInput = z.infer<typeof MuxerInputSchema>;