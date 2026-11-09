const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const server = new Server(
  {
    name: "github-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_repository",
      description: "Get basic information about a public GitHub repository.",
      inputSchema: {
        type: "object",
        properties: {
          owner: {
            type: "string",
            description: "GitHub account or organization that owns the repository.",
          },
          repo: {
            type: "string",
            description: "Repository name.",
          },
        },
        required: ["owner", "repo"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== "get_repository") {
    throw new Error(`Unknown tool: ${name}`);
  }

  const owner = args?.owner;
  const repo = args?.repo;
  if (
    typeof owner !== "string" ||
    typeof repo !== "string" ||
    !/^[a-zA-Z0-9-]+$/.test(owner) ||
    !/^[a-zA-Z0-9_.-]+$/.test(repo)
  ) {
    return {
      isError: true,
      content: [{ type: "text", text: "Provide a valid GitHub owner and repository name." }],
    };
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "github-mcp-server",
        },
      }
    );

    if (!response.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: `GitHub API returned ${response.status}: ${response.statusText}` }],
      };
    }

    const data = await response.json();
    const repository = {
      full_name: data.full_name,
      description: data.description,
      html_url: data.html_url,
      default_branch: data.default_branch,
      stargazers_count: data.stargazers_count,
      forks_count: data.forks_count,
      open_issues_count: data.open_issues_count,
      language: data.language,
      visibility: data.visibility,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(repository, null, 2) }],
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: `Failed to contact GitHub API: ${error.message}` }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server failed to start:", error);
  process.exitCode = 1;
});
