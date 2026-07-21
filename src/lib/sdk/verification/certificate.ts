import crypto from "node:crypto";
import type { ComparisonReport } from "./compare";

export interface PerformanceMetrics {
  cpuUsageMs?: number;
  memoryUsageMb?: number;
  graphqlCost?: number;
  throughputObjectsPerSec?: number;
  retries?: number;
}

export interface RecoveryCertificate {
  migrationId: string;
  backupId: string;
  jobId: string;
  manifestHash?: string;
  sourceStore: string;
  destinationStore: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  totalObjects: number;
  overallAccuracy: number;
  failureClassification?: string;
  performance?: PerformanceMetrics;
  reports: ComparisonReport[];
  signature: string;
}

export function generateRecoveryCertificate(
  migrationId: string,
  backupId: string,
  jobId: string,
  sourceStore: string,
  destinationStore: string,
  startTime: Date,
  endTime: Date,
  reports: ComparisonReport[],
  options?: {
    manifestHash?: string;
    failureClassification?: string;
    performance?: PerformanceMetrics;
  },
): RecoveryCertificate {
  let totalObjects = 0;
  let totalMatches = 0;

  for (const report of reports) {
    totalObjects += report.resourcesChecked;
    totalMatches += report.matches;
  }

  const durationMs = endTime.getTime() - startTime.getTime();
  const overallAccuracy = totalObjects === 0 ? 100 : (totalMatches / totalObjects) * 100;

  // Auto-calculate throughput if not provided
  const throughputObjectsPerSec =
    options?.performance?.throughputObjectsPerSec ||
    (durationMs > 0 ? totalObjects / (durationMs / 1000) : 0);

  const performance = {
    ...options?.performance,
    throughputObjectsPerSec,
  };

  const certificateBase = {
    migrationId,
    backupId,
    jobId,
    manifestHash: options?.manifestHash,
    sourceStore,
    destinationStore,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationMs,
    totalObjects,
    overallAccuracy,
    failureClassification: options?.failureClassification,
    performance,
    reports,
  };

  // Generate SHA-256 signature to guarantee immutability of the verification
  const certString = JSON.stringify(certificateBase, null, 2);
  const signature = crypto.createHash("sha256").update(certString).digest("hex");

  return {
    ...certificateBase,
    signature,
  };
}
