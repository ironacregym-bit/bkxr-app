import type { NextApiRequest, NextApiResponse } from "next";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  approvedEmailRequestSchema,
} from "@pt/email-engine";
import {
  ApiError,
  sendApiError,
} from "@/lib/server-auth";
import {
  listApprovedEmailTemplates,
  requireEmailApiCredential,
  sendApprovedTemplateEmail,
} from "@/lib/email-api";

function createMcpServer(
  credential: Awaited<ReturnType<typeof requireEmailApiCredential>>
) {
  const server = new Server(
    { name: "enaible-email", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const templates = await listApprovedEmailTemplates(credential.tenantId);
    if (templates.length === 0) return { tools: [] };

    const templateList = templates
      .map(
        (template) =>
          `${template.name} (${template.templateId}; variables: ${template.variables.join(", ") || "none"})`
      )
      .join("; ");

    return {
      tools: [
        {
          name: "send_approved_email",
          description:
            `Send a tenant-approved plain-text template to a recipient on this API key's allowed domains. Limit: 20 attempts per key per UTC day. Available templates: ${templateList}. Reuse the same idempotencyKey when retrying a request.`,
          inputSchema: {
            type: "object",
            properties: {
              templateId: {
                type: "string",
                enum: templates.map((template) => template.templateId),
                description: "ID of a tenant-approved email template.",
              },
              to: {
                type: "string",
                format: "email",
                description: "Recipient; its exact domain must be allowlisted on this key.",
              },
              variables: {
                type: "object",
                description:
                  "Values for the selected template's placeholders. Supply exactly the listed variables.",
                additionalProperties: { type: "string", maxLength: 500 },
              },
              idempotencyKey: {
                type: "string",
                minLength: 8,
                maxLength: 128,
                description: "Stable key for this send; reuse it for retries.",
              },
            },
            required: ["templateId", "to", "variables", "idempotencyKey"],
            additionalProperties: false,
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "send_approved_email") {
      return {
        content: [{ type: "text", text: "Unknown email tool." }],
        isError: true,
      };
    }

    const parsed = approvedEmailRequestSchema.safeParse(
      request.params.arguments
    );
    if (!parsed.success) {
      return {
        content: [
          {
            type: "text",
            text: parsed.error.issues[0]?.message || "Invalid email request.",
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await sendApprovedTemplateEmail(credential, parsed.data);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    } catch (error) {
      if (!(error instanceof ApiError)) {
        console.error("[EnAible MCP tool]", error);
      }
      const message =
        error instanceof ApiError
          ? error.message
          : "Could not send approved email.";
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }
  });

  return server;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const credential = await requireEmailApiCredential(req);
    const server = createMcpServer(credential);
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
      maxRequestBodySize: 64 * 1024,
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    try {
      await transport.handleRequest(req, res);
    } finally {
      await server.close();
    }
  } catch (error) {
    if (res.headersSent) {
      console.error("[EnAible MCP]", error);
      return;
    }
    if (error instanceof ApiError && error.statusCode === 401) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="EnAible MCP"');
    }
    return sendApiError(res, error, "MCP request failed");
  }
}
