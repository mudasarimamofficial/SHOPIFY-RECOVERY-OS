const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src");
const MEMORY_DIR = path.join(ROOT_DIR, "PROJECT_MEMORY");
const GRAPH_DIR = path.join(MEMORY_DIR, "26_KNOWLEDGE_GRAPH");

if (!fs.existsSync(GRAPH_DIR)) {
  fs.mkdirSync(GRAPH_DIR, { recursive: true });
}

const index = {
  functions: [],
  files: [],
  routes: [],
  environment: [],
  last_generated: new Date().toISOString(),
};

// Simple Regex Parsers
const exportFuncRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g;
const exportServerFnRegex = /export\s+const\s+([a-zA-Z0-9_]+)\s*=\s*createServerFn/g;
const importRegex = /from\s+['"]([^'"]+)['"]/g;
const dbRegex = /from\(['"]([a-zA-Z0-9_]+)['"]\)/g;
const envRegex = /process\.env\.([A-Za-z0-9_]+)/g;

function scanDirectory(dir, relativePath = "") {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const entryRelativePath = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath, entryRelativePath);
    } else {
      if ([".ts", ".tsx", ".js", ".jsx"].includes(path.extname(entry.name))) {
        const content = fs.readFileSync(fullPath, "utf8");

        let fileImports = [];
        let m;
        while ((m = importRegex.exec(content)) !== null) {
          if (!fileImports.includes(m[1])) fileImports.push(m[1]);
        }

        let dbTables = [];
        while ((m = dbRegex.exec(content)) !== null) {
          if (!dbTables.includes(m[1])) dbTables.push(m[1]);
        }

        while ((m = envRegex.exec(content)) !== null) {
          if (!index.environment.includes(m[1])) index.environment.push(m[1]);
        }

        const isRoute = entryRelativePath.includes("routes");
        if (isRoute) {
          index.routes.push({
            file: `src/${entryRelativePath}`.replace(/\\/g, "/"),
            imports: fileImports,
          });
        }

        index.files.push({
          file: `src/${entryRelativePath}`.replace(/\\/g, "/"),
          imports: fileImports,
          databaseTables: dbTables,
        });

        // Extract functions
        const funcs = [];
        while ((m = exportFuncRegex.exec(content)) !== null) {
          if (!funcs.includes(m[1])) funcs.push(m[1]);
        }
        while ((m = exportServerFnRegex.exec(content)) !== null) {
          if (!funcs.includes(m[1])) funcs.push(m[1]);
        }

        funcs.forEach((f) => {
          index.functions.push({
            name: f,
            file: `src/${entryRelativePath}`.replace(/\\/g, "/"),
            databaseTables: dbTables,
            tags: isRoute ? ["route-action"] : ["utility", "server-function"],
          });
        });
      }
    }
  }
}

scanDirectory(SRC_DIR);

// Write JSON Index
fs.writeFileSync(path.join(MEMORY_DIR, "project.index.json"), JSON.stringify(index, null, 2));

// Generate Dependency Graph MMD
let depGraph = "graph TD\n";
index.files.forEach((f) => {
  const nodeA = f.file
    .split("/")
    .pop()
    .replace(/[^a-zA-Z0-9_]/g, "");
  depGraph += `  ${nodeA}["${f.file.split("/").pop()}"]\n`;
});
fs.writeFileSync(path.join(GRAPH_DIR, "dependency-graph.mmd"), depGraph);

// Generate Database Map MMD
let dbGraph = "graph TD\n";
const tables = new Set();
index.functions.forEach((f) => {
  if (f.databaseTables.length > 0) {
    const fnNode = f.name.replace(/[^a-zA-Z0-9_]/g, "");
    f.databaseTables.forEach((t) => {
      const tNode = t.replace(/[^a-zA-Z0-9_]/g, "");
      tables.add(tNode);
      dbGraph += `  ${fnNode}["${f.name}"] --> ${tNode}DB[("${t}")]\n`;
    });
  }
});
if (dbGraph === "graph TD\n") dbGraph += '  NoDB["No DB Calls Found"]\n';
fs.writeFileSync(path.join(GRAPH_DIR, "database-map.mmd"), dbGraph);

// Generate Route Map MMD
let routeGraph = 'graph TD\n  Router["Application Router"]\n';
index.routes.forEach((r) => {
  const rNode = r.file
    .split("/")
    .pop()
    .replace(/[^a-zA-Z0-9_]/g, "");
  routeGraph += `  Router --> ${rNode}["${r.file.split("/").pop()}"]\n`;
});
fs.writeFileSync(path.join(GRAPH_DIR, "route-map.mmd"), routeGraph);

console.log(
  "AST Index and Knowledge Graphs (Dependency, DB, Route) generated directly from source code.",
);
