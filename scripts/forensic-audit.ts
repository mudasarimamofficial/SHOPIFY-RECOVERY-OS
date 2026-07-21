import fs from "fs";
import path from "path";

function walkDir(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      walkDir(path.join(dir, file), fileList);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

const files = walkDir("src");
const results: { file: string; query: string; line: number }[] = [];

files.forEach((file) => {
  const content = fs.readFileSync(file, "utf-8");
  const lines = content.split("\n");

  let inQuery = false;
  let currentQuery = "";
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Simple heuristic to catch multiline template literals containing GraphQL
    if (
      line.includes("query = `{") ||
      line.includes("query = `") ||
      line.includes("const gql = `") ||
      line.includes("queryStr = `{") ||
      line.includes("queryStr: string = `{") ||
      line.includes("mutation = `") ||
      line.includes("createMutation = `")
    ) {
      inQuery = true;
      currentQuery = line;
      startLine = i + 1;
      if (line.split("`").length > 2) {
        // inline query
        inQuery = false;
        results.push({ file, query: currentQuery.trim(), line: startLine });
      }
    } else if (inQuery) {
      currentQuery += "\n" + line;
      if (line.includes("`")) {
        inQuery = false;
        results.push({ file, query: currentQuery.trim(), line: startLine });
      }
    }
  }
});

fs.writeFileSync("graphql_inventory.json", JSON.stringify(results, null, 2));
console.log(`Found ${results.length} queries. Wrote to graphql_inventory.json`);
