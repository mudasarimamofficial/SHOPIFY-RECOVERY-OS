export interface RecoveryStep {
  title: string;
  instruction: string;
}

export interface RecoveryWizardPlan {
  resourceType: string;
  estimatedTimeMinutes: number;
  difficulty: "Easy" | "Medium" | "Hard";
  confidenceScore: number;
  warnings: string[];
  steps: RecoveryStep[];
  extractedData?: any;
}

export const RECOVERY_KNOWLEDGE_BASE: Record<
  string,
  Omit<RecoveryWizardPlan, "resourceType" | "extractedData">
> = {
  payments: {
    estimatedTimeMinutes: 7,
    difficulty: "Easy",
    confidenceScore: 90,
    warnings: [
      "Shopify does not expose third-party payment provider secrets.",
      "You must re-authenticate with your provider manually.",
    ],
    steps: [
      { title: "Open Shopify Admin", instruction: "Go to Settings -> Payments." },
      {
        title: "Select Gateway",
        instruction: "Click 'Choose a provider' under Payment providers.",
      },
      {
        title: "Authorize",
        instruction: "Sign in to your third-party payment provider (e.g. Stripe, PayPal).",
      },
      {
        title: "Configure Supported Cards",
        instruction: "Match your previous card settings shown in the comparison below.",
      },
    ],
  },
  domains: {
    estimatedTimeMinutes: 15,
    difficulty: "Medium",
    confidenceScore: 85,
    warnings: [
      "DNS propagation can take up to 48 hours.",
      "Ensure your old store is disconnected from the domain before verifying.",
    ],
    steps: [
      { title: "Open Shopify Admin", instruction: "Go to Settings -> Domains." },
      {
        title: "Connect Existing Domain",
        instruction: "Click 'Connect existing domain' and enter your domain.",
      },
      {
        title: "Update DNS",
        instruction:
          "Log in to your domain registrar and point your A record to 23.227.38.65 and CNAME to shops.myshopify.com.",
      },
      {
        title: "Verify Connection",
        instruction: "Return to Shopify and click 'Verify connection'.",
      },
    ],
  },
  shipping: {
    estimatedTimeMinutes: 20,
    difficulty: "Hard",
    confidenceScore: 75,
    warnings: [
      "Carrier calculated rates require third-party carrier accounts.",
      "Check that all product weights have been successfully restored.",
    ],
    steps: [
      { title: "Open Shopify Admin", instruction: "Go to Settings -> Shipping and delivery." },
      {
        title: "Recreate Profiles",
        instruction: "Create matching shipping profiles based on the extracted configuration.",
      },
      { title: "Assign Zones", instruction: "Manually recreate the geographical zones." },
      { title: "Set Rates", instruction: "Add the exact flat rates or carrier-calculated rates." },
    ],
  },
  third_party_apps: {
    estimatedTimeMinutes: 30,
    difficulty: "Medium",
    confidenceScore: 60,
    warnings: [
      "App settings are stored on the third-party provider's servers and cannot be migrated.",
      "Some apps may charge you again for installation.",
    ],
    steps: [
      { title: "Open Shopify Admin", instruction: "Go to Apps." },
      {
        title: "Reinstall Apps",
        instruction:
          "Search the App Store for the exact apps listed in your extracted configuration.",
      },
      { title: "Grant Permissions", instruction: "Approve OAuth permissions for each app." },
      {
        title: "Manual Reconfiguration",
        instruction: "Open each app and manually restore its internal settings.",
      },
    ],
  },
};

export function generateRecoveryPlan(resourceType: string, extractedData: any): RecoveryWizardPlan {
  const base = RECOVERY_KNOWLEDGE_BASE[resourceType] || {
    estimatedTimeMinutes: 5,
    difficulty: "Easy",
    confidenceScore: 50,
    warnings: [
      "No specific intelligence available for this resource type. Please verify manually.",
    ],
    steps: [
      {
        title: "Manual Review Required",
        instruction: "This resource requires manual configuration in the Shopify Admin.",
      },
    ],
  };

  return {
    resourceType,
    estimatedTimeMinutes: base.estimatedTimeMinutes,
    difficulty: base.difficulty,
    confidenceScore: base.confidenceScore,
    warnings: base.warnings,
    steps: base.steps,
    extractedData,
  };
}
