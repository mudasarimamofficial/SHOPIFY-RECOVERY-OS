import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { generateRecoveryPlan } from "../../../lib/sdk/migration/intelligence";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";

export const Route = createFileRoute("/_authenticated/recovery/wizard")({
  component: RecoveryWizardPage,
});

function RecoveryWizardPage() {
  const plan = generateRecoveryPlan("payments", {
    supportedDigitalWallets: ["APPLE_PAY", "GOOGLE_PAY"],
    acceptedCardBrands: ["VISA", "MASTERCARD", "AMEX"],
    customManualPaymentMethods: [{ name: "Bank Transfer" }],
  });

  const [progress, setProgress] = useState(0);
  const storageKey = `recovery_progress_${plan.resourceType}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setProgress(parseInt(saved, 10));
  }, [storageKey]);

  const updateProgress = (val: number) => {
    setProgress(val);
    localStorage.setItem(storageKey, val.toString());
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Interactive Recovery Wizard</h1>
        <p className="text-muted-foreground mt-2">
          Shopify limitations prevent automatic restoration of some resources. Follow these steps to
          manually recover your configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recovery Profile</CardTitle>
              <CardDescription>{plan.resourceType.toUpperCase()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Time:</span>
                <span className="font-medium">{plan.estimatedTimeMinutes} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Difficulty:</span>
                <span className="font-medium">{plan.difficulty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confidence:</span>
                <span className="font-medium text-green-600">{plan.confidenceScore}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium">
                  {progress >= plan.steps.length ? "Complete" : "Incomplete"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Progress:</span>
                <span className="font-medium">
                  {Math.min(100, Math.round((progress / plan.steps.length) * 100))}%
                </span>
              </div>
              {plan.warnings && plan.warnings.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 text-red-800 border border-red-200 rounded text-xs space-y-1">
                  <span className="font-semibold block uppercase tracking-wider text-[10px]">
                    Warnings
                  </span>
                  <ul className="list-disc pl-4">
                    {plan.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                className="w-full mt-4"
                onClick={() => updateProgress(0)}
                disabled={progress < plan.steps.length}
                variant="outline"
              >
                Reset Progress
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Step-by-Step Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {plan.steps.map((step, idx) => (
                <div
                  key={idx}
                  className={`p-4 border rounded-lg ${progress > idx ? "bg-muted/50 border-green-500/50" : progress === idx ? "border-primary" : "opacity-50"}`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${progress > idx ? "bg-green-500 text-white border-green-500" : progress === idx ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    >
                      {idx + 1}
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold leading-none tracking-tight">{step.title}</h4>
                      <p className="text-sm text-muted-foreground">{step.instruction}</p>

                      {progress === idx && (
                        <Button
                          size="sm"
                          className="mt-4"
                          onClick={() => updateProgress(progress + 1)}
                        >
                          Mark Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Store Comparison</CardTitle>
          <CardDescription>Extracted JSON configuration metadata</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded bg-muted/20 overflow-x-auto">
              <h5 className="font-semibold mb-2 text-blue-600">Store A (Extracted Backup)</h5>
              <pre className="text-xs">{JSON.stringify(plan.extractedData, null, 2)}</pre>
            </div>
            <div className="p-4 border rounded bg-muted/20 overflow-x-auto">
              <h5 className="font-semibold mb-2 text-orange-600">Store B (Target Store)</h5>
              <pre className="text-xs text-muted-foreground">
                Currently Missing - Action Required in Admin
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
