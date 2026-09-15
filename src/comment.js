// Pure markdown renderer. No network. Easy to unit test.
export const MARKER = "<!-- dev-bot-pr-report -->";

function groupByDir(files) {
  const groups = new Map();
  for (const f of files) {
    const parts = f.filename.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "(root)";
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(f);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function flagRisks(files) {
  const flags = [];
  for (const f of files) {
    const n = f.filename.toLowerCase();
    if (f.changes > 500) flags.push(`- \`${f.filename}\` large diff (+${f.additions}/-${f.deletions}) — split PR?`);
    else if (n.includes("migration") || n.includes("schema.prisma") || n.endsWith(".sql"))
      flags.push(`- \`${f.filename}\` touches DB — check migrate/rollback`);
    else if (n.endsWith("package-lock.json") || n.endsWith("pnpm-lock.yaml") || n.endsWith("yarn.lock"))
      flags.push(`- \`${f.filename}\` lockfile changed — verify dep intent`);
    else if (n.includes(".env") || n.includes("secret") || n.includes("credential") || n.includes("token"))
      flags.push(`- \`${f.filename}\` looks secret-adjacent — confirm no leaked key`);
    else if (n.includes("auth") || n.includes("login") || n.includes("permission"))
      flags.push(`- \`${f.filename}\` auth area — needs careful review`);
  }
  return [...new Set(flags)].slice(0, 15);
}

export function renderComment({ files, pull, aiSummary }) {
  const totalAdd = files.reduce((s, f) => s + (f.additions || 0), 0);
  const totalDel = files.reduce((s, f) => s + (f.deletions || 0), 0);
  const groups = groupByDir(files);
  const risks = flagRisks(files);

  const statusIcon = (s) =>
    s === "added" ? "🟢" : s === "removed" ? "🔴" : s === "renamed" ? "🔀" : s === "modified" ? "🟡" : "⚪";

  let md = `${MARKER}\n## 🤖 dev-bot — PR file report\n\n`;
  md += `**${files.length} files** changed: \`+${totalAdd} / -${totalDel}\` · base \`${pull?.base?.ref ?? "?"}\` → head \`${pull?.head?.ref ?? "?"}\`\n\n`;

  if (aiSummary) md += `### Summary\n${aiSummary}\n\n`;

  if (risks.length) md += `### ⚠️ Needs eye\n${risks.join("\n")}\n\n`;

  md += `### Changed files by dir\n`;
  for (const [dir, list] of groups) {
    md += `\n**${dir}** (${list.length})\n`;
    for (const f of list.slice(0, 50)) {
      const prev = f.previous_filename ? ` (was \`${f.previous_filename}\`)` : "";
      md += `- ${statusIcon(f.status)} \`${f.filename}\`${prev} \`+${f.additions}/-${f.deletions}\`\n`;
    }
    if (list.length > 50) md += `- … +${list.length - 50} more in \`${dir}\`\n`;
  }

  // Full collapsible table for copy/paste
  md += `\n<details><summary>Full table (${files.length})</summary>\n\n| File | Status | +Add | -Del |\n|---|---|---:|---:|\n`;
  for (const f of files.slice(0, 300)) {
    md += `| \`${f.filename}\` | ${f.status} | ${f.additions} | ${f.deletions} |\n`;
  }
  if (files.length > 300) md += `| … +${files.length - 300} more | | | |\n`;
  md += `\n</details>\n\n<sub>Posted as \`${process.env.BOT_NAME || "dev-bot"}\` (bot-user via PAT). Updates in place on sync.</sub>\n`;
  return md;
}

export async function upsertComment(octokit, owner, repo, issue_number, body) {
  // Find our previous comment by marker, update instead of spam
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number,
    per_page: 100,
  });
  const mine = comments.find((c) => c.body?.includes(MARKER));
  if (mine) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: mine.id, body });
    return { action: "updated", id: mine.id };
  }
  const { data } = await octokit.rest.issues.createComment({ owner, repo, issue_number, body });
  return { action: "created", id: data.id };
}
