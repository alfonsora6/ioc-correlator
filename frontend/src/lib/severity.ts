export function severityClass(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "sev-critical";
    case "HIGH":
      return "sev-high";
    case "MEDIUM":
      return "sev-medium";
    default:
      return "sev-low";
  }
}
