import "dotenv/config";
import express from "express";
import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import { createClient, listPullRequestFiles, getPull } from "./github.js";
import { renderComment, upsertComment } from "./comment.js";
import { summarizeFiles } from "./ai.js";

const PORT = process.env.PORT || 3000;
const SECRET = process.env.WEBHOOK_SECRET;

if (!SECRET) {
  console.error("Missing WEBHOOK_SECRET in env. Set it, must match GitHub webhook secret.");
  process.exit(1);
}

const webhooks = new Webhooks({ secret: SECRET });
const app = express();
app.get("/healthz", (_req, res) => res.send("ok"));

// Manual trigger for testing without GitHub: POST /run {owner,repo,pull_number}
app.use(express.json());
app.post("/run", async (req, res) => {
  try {
    const { owner, repo, pull_number } = req.body;
    if (!owner || !repo || !pull_number) return res.status(400).send("need owner,repo,pull_number");
    const result = await handlePR({ owner, repo, pull_number });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).send(String(e.message || e));
  }
});

async function handlePR({ owner, repo, pull_number }) {
  const octokit = createClient();
  const [files, pull] = await Promise.all([
    listPullRequestFiles(octokit, owner, repo, pull_number),
    getPull(octokit, owner, repo, pull_number),
  ]);
  const aiSummary = await summarizeFiles(files);
  const body = renderComment({ files, pull, aiSummary });
  const out = await upsertComment(octokit, owner, repo, pull_number, body);
  console.log(`PR ${owner}/${repo}#${pull_number}: ${files.length} files -> comment ${out.action} ${out.id}`);
  return out;
}

webhooks.on(["pull_request.opened", "pull_request.synchronize", "pull_request.reopened"], async ({ payload }) => {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const pull_number = payload.pull_request.number;
  try {
    await handlePR({ owner, repo, pull_number });
  } catch (e) {
    console.error(`handlePR fail ${owner}/${repo}#${pull_number}:`, e.message);
  }
});

webhooks.onError((e) => console.error("webhook verify fail:", e.message));

app.use("/webhooks", createNodeMiddleware(webhooks));

app.listen(PORT, () => console.log(`dev-bot listening :${PORT} -> POST /webhooks`));
