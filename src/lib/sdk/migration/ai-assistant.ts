import { RECOVERY_KNOWLEDGE_BASE, type RecoveryWizardPlan } from "./intelligence";

export interface ExplanationRequest {
  resourceType: string;
  limitationReason: string;
  extractedConfiguration: any;
}

export async function explainShopifyLimitation(
  req: ExplanationRequest,
): Promise<RecoveryWizardPlan> {
  const apiKey = process.env.NVIDIA_API_KEY;
  const baseUrl = process.env.NVIDIA_BASE_URL;

  // Fallback if AI is disabled or keys are missing (Zero Trust requirement)
  if (!apiKey || !baseUrl) {
    return generateFallbackPlan(req.resourceType, req.extractedConfiguration);
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-70b-instruct", // Correct NVIDIA NIM model string
        messages: [
          {
            role: "system",
            content:
              "You are the Imam Migration OS AI Assistant. Your job is to generate Migration Books, Migration Timelines, Conflict Analysis, and explain Shopify API limitations. Translate extracted JSON configurations into simple, step-by-step manual migration instructions. Never hallucinate data. ONLY use the provided JSON.",
          },
          {
            role: "user",
            content: `Resource: ${req.resourceType}\nLimitation: ${req.limitationReason}\nConfiguration:\n${JSON.stringify(req.extractedConfiguration)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`NVIDIA API Error: ${response.status}`);
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content;

    if (!explanation) throw new Error("Empty AI response");

    // The AI generated a text explanation. We wrap it in a custom step.
    const basePlan = generateFallbackPlan(req.resourceType, req.extractedConfiguration);
    basePlan.steps = [
      { title: "AI Recovery Guidance", instruction: explanation },
      ...basePlan.steps,
    ];

    return basePlan;
  } catch (error) {
    console.warn("AI Assistant failed, falling back to static knowledge base:", error);
    return generateFallbackPlan(req.resourceType, req.extractedConfiguration);
  }
}

function generateFallbackPlan(resourceType: string, extractedData: any): RecoveryWizardPlan {
  const base = RECOVERY_KNOWLEDGE_BASE[resourceType] || {
    estimatedTimeMinutes: 5,
    difficulty: "Easy",
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
    steps: base.steps,
    extractedData,
    confidenceScore: 0,
    warnings: ["AI Assistant unavailable. Using static fallback logic."],
  };
}
