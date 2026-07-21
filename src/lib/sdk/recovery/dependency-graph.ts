export interface DependencyNode {
  key: string;
  name: string;
  status: "completed" | "skipped" | "failed" | "pending" | "blocked";
  reason?: string;
}

export function generateDependencyGraphMermaid(nodes: DependencyNode[], edges: Record<string, string[]>): string {
  let mermaid = "graph TD\n";

  const statusColors = {
    completed: "fill:#4ade80,stroke:#22c55e", // Green
    skipped: "fill:#94a3b8,stroke:#64748b",   // Gray
    failed: "fill:#f87171,stroke:#ef4444",     // Red
    pending: "fill:#fbbf24,stroke:#f59e0b",    // Yellow
    blocked: "fill:#fca5a5,stroke:#ef4444",    // Light Red
  };

  // Add Nodes
  nodes.forEach(node => {
    mermaid += `  ${node.key}["${node.name}"]\n`;
    mermaid += `  style ${node.key} ${statusColors[node.status]},color:#fff,stroke-width:2px\n`;
  });

  // Add Edges
  nodes.forEach(node => {
    const deps = edges[node.key] || [];
    deps.forEach(dep => {
      // Arrow points from dependency to the current node
      mermaid += `  ${dep} --> ${node.key}\n`;
    });
  });

  return mermaid;
}
