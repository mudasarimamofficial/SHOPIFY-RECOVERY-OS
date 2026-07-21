const fs = require("fs");
const path = require("path");

const DIRECTORIES = ["src", "scripts"];

function processFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;

    let content = fs.readFileSync(filePath, "utf8");
    let original = content;

    content = content.replace(/sdk\/recovery\//g, "sdk/migration/");

    if (content !== original) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log("Fixed import in " + filePath);
    }
  } catch (e) {}
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
  } catch (e) {}
}

for (const dir of DIRECTORIES) {
  const fullPath = path.join(__dirname, "..", dir);
  if (fs.existsSync(fullPath)) {
    processDirectory(fullPath);
  }
}
