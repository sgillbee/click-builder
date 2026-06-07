import { AstJsonSchema } from "../contracts.js";
import { generateTimeline } from "./generator.js";

async function main() {
  process.stdin.setEncoding("utf-8");
  let inputJson = "";

  process.stdin.on("data", (chunk) => {
    inputJson += chunk;
  });

  process.stdin.on("end", () => {
    try {
      const parsed = JSON.parse(inputJson);
      const ast = AstJsonSchema.parse(parsed);

      const timeline = generateTimeline(ast);

      // STDOUT contract
      console.log(JSON.stringify(timeline, null, 2));
      process.exit(0);
    } catch (error) {
      // STDERR diagnostic routing contract
      console.error(error);
      process.exit(1);
    }
  });
}

main();