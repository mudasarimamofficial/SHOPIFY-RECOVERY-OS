import { AssetChecksum, computeAssetChecksum, verifyChecksumPair } from "./binary-hash";

export type ThemeFileType =
  "liquid" | "json" | "css" | "js" | "config" | "locale" | "binary" | "other";

export interface ThemeVerificationResult {
  matches: boolean;
  fileType: ThemeFileType;
  key: string;
  reason?: string;
}

export interface ThemeReport {
  totalFiles: number;
  matchedFiles: number;
  mismatchedFiles: number;
  missingFiles: number;
  details: ThemeVerificationResult[];
}

export function classifyThemeFile(key: string): ThemeFileType {
  if (key.endsWith(".liquid")) return "liquid";
  if (key.endsWith(".json")) return "json";
  if (key.endsWith(".css") || key.endsWith(".scss")) return "css";
  if (key.endsWith(".js") || key.endsWith(".mjs")) return "js";
  if (key.includes("config/")) return "config";
  if (key.includes("locales/")) return "locale";
  if (key.match(/\.(png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|eot|mp4|webm)$/i)) return "binary";
  return "other";
}

export function verifyThemeAssets(
  sourceAssets: AssetChecksum[],
  destinationAssets: AssetChecksum[],
): ThemeReport {
  const destMap = new Map<string, AssetChecksum>(destinationAssets.map((a) => [a.key, a]));
  const report: ThemeReport = {
    totalFiles: sourceAssets.length,
    matchedFiles: 0,
    mismatchedFiles: 0,
    missingFiles: 0,
    details: [],
  };

  for (const src of sourceAssets) {
    const fileType = classifyThemeFile(src.key);
    const dest = destMap.get(src.key);

    if (!dest) {
      report.missingFiles++;
      report.details.push({
        matches: false,
        fileType,
        key: src.key,
        reason: "File missing in destination",
      });
      continue;
    }

    const verification = verifyChecksumPair(src, dest);
    if (verification.matches) {
      report.matchedFiles++;
      report.details.push({
        matches: true,
        fileType,
        key: src.key,
      });
    } else {
      report.mismatchedFiles++;
      report.details.push({
        matches: false,
        fileType,
        key: src.key,
        reason: verification.reason,
      });
    }
  }

  return report;
}
