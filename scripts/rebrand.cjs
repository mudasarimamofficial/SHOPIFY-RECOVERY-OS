const fs = require("fs");
const path = require("path");

const DIRECTORIES_TO_SCAN = ["src", "scripts", "PROJECT_MEMORY", "tests", "supabase"];

const ROOT_FILES_TO_SCAN = [
  "package.json",
  "shopify.app.toml",
  "README.md",
  "system-architecture.md",
  ".env.example",
  ".env.production",
];

const REPLACEMENTS = [
  { from: /Imam Migration OS/g, to: "Imam Migration OS" },
  { from: /Migration OS/g, to: "Migration OS" },
  { from: /Imam Migration/g, to: "Imam Migration" },
  { from: /Migration Book/g, to: "Migration Book" }, // Basic mapping, we'll refine manually if needed.
];

function processFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;

    // Skip node_modules, .git, etc. just in case
    if (
      filePath.includes("node_modules") ||
      filePath.includes(".git") ||
      filePath.includes(".system_generated")
    )
      return;

    let content = fs.readFileSync(filePath, "utf8");
    let originalContent = content;

    for (const r of REPLACEMENTS) {
      content = content.replace(r.from, r.to);
    }

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`Updated: ${filePath}`);
    }
  } catch (e) {
    console.error(`Error processing ${filePath}: ${e.message}`);
  }
}

function processDirectory(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        processDirectory(fullPath);
      } else {
        processFile(fullPath);
      }
    }
  } catch (e) {
    console.error(`Error processing dir ${dirPath}: ${e.message}`);
  }
}

// 1. Process root files
for (const file of ROOT_FILES_TO_SCAN) {
  const fullPath = path.join(__dirname, "..", file);
  if (fs.existsSync(fullPath)) {
    processFile(fullPath);
  }
}

// 2. Process directories
for (const dir of DIRECTORIES_TO_SCAN) {
  const fullPath = path.join(__dirname, "..", dir);
  if (fs.existsSync(fullPath)) {
    processDirectory(fullPath);
  }
}

console.log("Rebranding complete.");
