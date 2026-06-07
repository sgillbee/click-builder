import { TimelineJsonSchema } from "../contracts.js";
import { renderAudio } from "./renderer.js";

async function main() {
  process.stdin.setEncoding("utf-8");
  let inputJson = "";

  process.stdin.on("data", (chunk) => {
    inputJson += chunk;
  });

  process.stdin.on("end", async () => {
    try {
      const parsed = JSON.parse(inputJson);
      const timeline = TimelineJsonSchema.parse(parsed);

      const audioPath = await renderAudio(timeline);

      const payload = {
        generated_audio_path: audioPath
      };

      // STDOUT contract
      console.log(JSON.stringify(payload, null, 2));
      process.exit(0);
    } catch (error) {
      // STDERR diagnostic routing contract
      console.error(error);
      process.exit(1);
    }
  });
}

main();