// Optional AI summary hook. Returns null when no key set.
// Wire your provider here (OpenAI/Anthropic/etc). Keep file-report working without it.
export async function summarizeFiles(files) {
  if (!process.env.AI_KEY) return null;
  // v1: cheap heuristic summary so bot works offline. Replace with API call later.
  const top = [...files].sort((a, b) => b.changes - a.changes).slice(0, 5);
  return `Largest churn in: ${top.map((f) => `\`${f.filename}\` (+${f.additions}/-${f.deletions})`).join(", ")}.`;
}
