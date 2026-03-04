import { SignalPotClient } from "signalpot";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  readFileSync(resolve(__dirname, "../signalpot.config.json"), "utf-8")
);

const apiKey = process.env.SIGNALPOT_API_KEY;
if (!apiKey) {
  console.error("SIGNALPOT_API_KEY environment variable is required");
  process.exit(1);
}

const agentBaseUrl = process.env.AGENT_BASE_URL ?? "https://signalpot-agent-text-analyzer.vercel.app";

const client = new SignalPotClient({
  apiKey,
  baseUrl: "https://www.signalpot.dev",
});

async function main() {
  console.log(`Registering agent "${config.name}" (${config.slug})...`);

  try {
    // Try to update first, create if not found
    const existing = await client.agents.get(config.slug).catch(() => null);

    const agentData = {
      ...config,
      endpoint_url: `${agentBaseUrl}/a2a/rpc`,
      mcp_endpoint: `${agentBaseUrl}/mcp/tools`,
    };

    if (existing) {
      await client.agents.update(config.slug, agentData);
      console.log(`✓ Updated agent: https://www.signalpot.dev/agents/${config.slug}`);
    } else {
      await client.agents.create(agentData);
      console.log(`✓ Created agent: https://www.signalpot.dev/agents/${config.slug}`);
    }
  } catch (err) {
    console.error("Registration failed:", err);
    process.exit(1);
  }
}

main();
