import { parseConfigToAst } from "./parser.js";
import * as fs from "fs";

async function main() {
  if (process.argv.length < 3) {
    console.error("Usage: node config-parser.js <path-to-config.yaml>");
    process.exit(1);
  }

  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node config-parser.js <path-to-config.yaml>");
    process.exit(1);
  }

  let fileContent: string;
  try {
    fileContent = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    process.exit(1);
  }

  try {
    const ast = parseConfigToAst(fileContent);
    // STDOUT contract
    console.log(JSON.stringify(ast, null, 2));
    process.exit(0);
  } catch (error) {
    // STDERR diagnostic routing contract
    console.error(error);
    process.exit(1);
  }
}

main();