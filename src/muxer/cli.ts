import { MuxerInputSchema } from "./contracts.js";
import { muxVideo } from "./muxer.js";

async function main() {
  process.stdin.setEncoding("utf-8");
  let inputJson = "";

  process.stdin.on("data", (chunk) => {
    inputJson += chunk;
  });

  process.stdin.on("end", async () => {
    try {
      const parsed = JSON.parse(inputJson);
      const input = MuxerInputSchema.parse(parsed);

      const outputPath = await muxVideo(input);

      const payload = {
        success: true,
        final_video: outputPath
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