import { Octokit } from "@octokit/rest";

export function createClient() {
  const token = process.env.BOT_PAT;
  if (!token) throw new Error("BOT_PAT env missing. Put bot-user PAT in .env (never commit).");
  return new Octokit({ auth: token, userAgent: "dev-bot/0.1.0" });
}

// Paginate all changed files for a PR
export async function listPullRequestFiles(octokit, owner, repo, pull_number) {
  return await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number,
    per_page: 100,
  });
}

export async function getPull(octokit, owner, repo, pull_number) {
  const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number });
  return data;
}
