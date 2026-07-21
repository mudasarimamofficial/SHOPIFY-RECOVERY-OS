const fs = require("fs");
const path = require("path");

const BRAIN_DIR = path.join(__dirname, "..", "PROJECT_BRAIN");

const folders = [
  "00_START_HERE",
  "01_BUSINESS",
  "02_ARCHITECTURE",
  "03_CODEBASE",
  "04_DATABASE",
  "05_SHOPIFY",
  "06_INFRASTRUCTURE",
  "07_SECURITY",
  "08_ACCEPTANCE",
  "09_HISTORY",
  "10_OPERATIONS",
  "11_AI",
  "12_REFERENCE",
  "13_LOGS",
];

const files = {
  "README.md": "Main entry point for the Project Brain.",
  "00_START_HERE/01_Project_Summary.md": "High-level overview of Imam Recovery OS.",
  "00_START_HERE/02_Current_Status.md": "Current branch, deployment, URL, tech debt, and blockers.",
  "00_START_HERE/03_AI_Handover.md": "Onboarding guide for future AI models.",
  "00_START_HERE/04_Reading_Order.md": "Suggested reading order for new developers/AIs.",

  "01_BUSINESS/Vision.md": "Product vision and long-term goals.",
  "01_BUSINESS/Goals.md": "Short and medium-term business objectives.",
  "01_BUSINESS/Roadmap.md": "Feature roadmap and milestones.",
  "01_BUSINESS/Competitors.md": "Market analysis and competitors.",
  "01_BUSINESS/Pricing.md": "Pricing strategy and tiers.",
  "01_BUSINESS/Users.md": "Target audience and user personas.",
  "01_BUSINESS/Client_Feedback.md": "Aggregated feedback from clients/users.",

  "02_ARCHITECTURE/High_Level.md": "High-level system architecture.",
  "02_ARCHITECTURE/Frontend.md": "Frontend architecture (TanStack Start).",
  "02_ARCHITECTURE/Backend.md": "Backend edge functions and API architecture.",
  "02_ARCHITECTURE/State_Machine.md": "State machine for backup/restore jobs.",
  "02_ARCHITECTURE/Authentication.md": "Authentication flows (Supabase).",
  "02_ARCHITECTURE/Authorization.md": "Authorization rules and RBAC.",
  "02_ARCHITECTURE/Encryption.md": "AES-256-GCM encryption for tokens and payloads.",
  "02_ARCHITECTURE/Backup.md": "Backup engine architecture and stages.",
  "02_ARCHITECTURE/Restore.md": "Restore engine architecture and dependency mapping.",
  "02_ARCHITECTURE/Recovery_Package.md": "Recovery package generation and format.",
  "02_ARCHITECTURE/Queue_System.md": "Background jobs and queue system.",
  "02_ARCHITECTURE/Workers.md": "Worker processes for long-running tasks.",
  "02_ARCHITECTURE/Scaling.md": "Strategies for scaling the application.",

  "03_CODEBASE/Folder_Map.md": "Directory structure and purpose.",
  "03_CODEBASE/Route_Map.md": "Frontend and API route definitions.",
  "03_CODEBASE/Component_Map.md": "React component hierarchy.",
  "03_CODEBASE/Library_Map.md": "Internal libraries and utilities (`src/lib`).",
  "03_CODEBASE/Server_Functions.md": "TanStack server functions.",
  "03_CODEBASE/Utilities.md": "Helper functions and utilities.",
  "03_CODEBASE/Dependencies.md": "External npm dependencies and their purpose.",

  "04_DATABASE/Schema.md": "Overall database schema diagram/explanation.",
  "04_DATABASE/Tables.md": "Detailed table definitions.",
  "04_DATABASE/Indexes.md": "Database indexes and performance optimizations.",
  "04_DATABASE/Policies.md": "Row Level Security (RLS) policies.",
  "04_DATABASE/Storage.md": "Supabase Storage bucket configurations.",
  "04_DATABASE/Migrations.md": "Migration history and strategy.",

  "05_SHOPIFY/OAuth.md": "OAuth flow (deprecated for Custom App flow).",
  "05_SHOPIFY/REST.md": "Shopify REST API integration.",
  "05_SHOPIFY/GraphQL.md": "Shopify GraphQL API integration.",
  "05_SHOPIFY/Bulk_Operations.md": "Handling Shopify Bulk Operations.",
  "05_SHOPIFY/Markets.md": "Shopify Markets support.",
  "05_SHOPIFY/Scopes.md": "Required Shopify API scopes.",
  "05_SHOPIFY/Rate_Limits.md": "Handling Shopify API rate limits.",
  "05_SHOPIFY/Webhooks.md": "Shopify Webhook subscriptions and handling.",
  "05_SHOPIFY/Admin_API.md": "General Admin API concepts.",

  "06_INFRASTRUCTURE/Vercel.md": "Vercel deployment configuration.",
  "06_INFRASTRUCTURE/Supabase.md": "Supabase project configuration.",
  "06_INFRASTRUCTURE/GitHub.md": "GitHub repository and actions.",
  "06_INFRASTRUCTURE/Storage.md": "Cloud storage architecture.",
  "06_INFRASTRUCTURE/Secrets.md": "Secret management strategy.",
  "06_INFRASTRUCTURE/Environment.md": "Environment variables list and definitions.",
  "06_INFRASTRUCTURE/Deployment.md": "Deployment pipelines and processes.",

  "07_SECURITY/Threat_Model.md": "Security threat model.",
  "07_SECURITY/Encryption.md": "Data encryption at rest and in transit.",
  "07_SECURITY/Token_Lifecycle.md": "Shopify and Supabase token lifecycle.",
  "07_SECURITY/Secrets.md": "Handling of sensitive credentials.",
  "07_SECURITY/Permissions.md": "App permissions and scopes.",
  "07_SECURITY/Compliance.md": "Privacy and compliance (GDPR, CCPA).",

  "08_ACCEPTANCE/Acceptance_Checklist.md": "Pre-deployment acceptance checklist.",
  "08_ACCEPTANCE/Evidence.md": "Logs and evidence of successful tests.",
  "08_ACCEPTANCE/Production_Status.md": "Current production health.",
  "08_ACCEPTANCE/Open_Issues.md": "Known issues and blockers.",

  "09_HISTORY/Timeline.md": "Project history and major milestones.",
  "09_HISTORY/Architecture_Decisions.md": "Log of ADRs.",
  "09_HISTORY/Rejected_Designs.md": "Approaches that were tried and discarded.",
  "09_HISTORY/Production_Bugs.md": "Log of production bugs.",
  "09_HISTORY/Incidents.md": "Log of major incidents.",
  "09_HISTORY/Deployments.md": "Deployment history.",
  "09_HISTORY/Lessons_Learned.md": "Key takeaways from development.",

  "10_OPERATIONS/Runbook.md": "General operations runbook.",
  "10_OPERATIONS/Monitoring.md": "Monitoring and alerting setup.",
  "10_OPERATIONS/Backup_Runbook.md": "How to manually trigger/verify backups.",
  "10_OPERATIONS/Restore_Runbook.md": "How to manually trigger/verify restores.",
  "10_OPERATIONS/Disaster_Recovery.md": "Disaster recovery plan.",

  "11_AI/AI_Onboarding.md": "How to onboard a new AI assistant.",
  "11_AI/AI_Workflow.md": "Standard operating procedures for AI development.",
  "11_AI/AI_Rules.md": "Rules for modifying the codebase and docs.",
  "11_AI/AI_Memory.md": "How the AI memory system works.",
  "11_AI/Prompt_Library.md": "Useful prompts for specific tasks.",

  "12_REFERENCE/Glossary.md": "Project-specific terminology.",
  "12_REFERENCE/API.md": "Internal API reference.",
  "12_REFERENCE/Commands.md": "Useful CLI commands (npm, vercel, etc).",
  "12_REFERENCE/Useful_SQL.md": "Common debugging SQL queries.",
  "12_REFERENCE/Useful_Scripts.md": "Documentation of scripts/ folder.",
};

function generateFrontmatter(id, title) {
  return `---
id: ${id}
title: ${title}
status: ACTIVE
importance: UNKNOWN
owner: Imam Recovery OS
last_verified: ${new Date().toISOString().split("T")[0]}
verification_method: MANUAL
related: []
depends_on: []
used_by: []
introduced_in: []
deprecated_by: []
production_ready: false
acceptance_status: UNKNOWN
ai_priority: NORMAL
tags: []
---

# ${title}

*Note: This document was auto-generated. Please update with relevant details.*

`;
}

// Create folders
if (!fs.existsSync(BRAIN_DIR)) {
  fs.mkdirSync(BRAIN_DIR, { recursive: true });
}
folders.forEach((f) => {
  const p = path.join(BRAIN_DIR, f);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// Create files
Object.entries(files).forEach(([filepath, desc]) => {
  const fullPath = path.join(BRAIN_DIR, filepath);
  if (!fs.existsSync(fullPath)) {
    const title = path.basename(filepath, ".md").replace(/_/g, " ");
    const id = `DOC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const content =
      generateFrontmatter(id, title) + `## Purpose\n${desc}\n\n## Content\n\nUNKNOWN\n`;
    fs.writeFileSync(fullPath, content);
  }
});

console.log("PROJECT_BRAIN generated successfully.");
