import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";

import {
  AVAILABLE_TOOLS,
} from "../../../lib/agents/availableTools";

/**
 * =====================================================
 * CREATE AGENT PAGE
 * =====================================================
 *
 * Purpose
 * -------
 *
 * Create new AI Agents without
 * needing direct Firestore access.
 *
 * Agents created here become
 * immediately available throughout
 * the platform.
 *
 * Future Enhancements
 * -------------------
 *
 * - Agent Templates
 * - AI Generated Prompts
 * - Tool Categories
 * - Agent Wizard
 * - Tenant Ownership
 * - Cost Controls
 * - Schema Builder
 *
 */

export default function NewAgentPage() {
  const router = useRouter();

  const [saving, setSaving] =
    useState(false);

  const [id, setId] =
    useState("");

  const [name, setName] =
    useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    systemPrompt,
    setSystemPrompt,
  ] = useState("");

  const [
    agentType,
    setAgentType,
  ] = useState(
    "workout_generator"
  );

  const [tools, setTools] =
    useState<string[]>([]);

  /**
   * Toggle Tool Selection
   */
  function toggleTool(
    toolId: string
  ) {
    if (
      tools.includes(toolId)
    ) {
      setTools(
        tools.filter(
          (t) => t !== toolId
        )
      );
    } else {
      setTools([
        ...tools,
        toolId,
      ]);
    }
  }

  /**
   * Create Agent
   */
  async function createAgent() {
    try {
      setSaving(true);

      const response =
        await fetch(
          "/api/agents/create",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              id,
              name,
              description,

              agent_type:
                agentType,

              provider:
                "google",

              model:
                "gemini-2.5-flash",

              tools,

              rules: [],

              system_prompt:
                systemPrompt,
            }),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.error
        );
      }

      router.push(
        "/admin/ai-agents"
      );
    } catch (error: any) {
      alert(
        error.message
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head>
        <title>
          Create Agent
        </title>
      </Head>

      <main
        className="container py-3"
        style={{
          color: "#fff",
          paddingBottom: 100,
        }}
      >
        <div className="ia-tile ia-tile-pad">

          <h2>
            🤖 Create Agent
          </h2>

          <p
            style={{
              opacity: 0.7,
            }}
          >
            Create a new platform
            agent and define its
            behaviour.
          </p>

          <div className="mt-4">

            <label>
              Agent Id
            </label>

            <input
              className="form-control"
              value={id}
              onChange={(e) =>
                setId(
                  e.target.value
                )
              }
              placeholder="workout-import"
            />

            <div className="small mt-1">
              Used as Firestore
              document id.
            </div>

          </div>

          <div className="mt-3">

            <label>
              Agent Name
            </label>

            <input
              className="form-control"
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value
                )
              }
              placeholder="Workout Import Agent"
            />

          </div>

          <div className="mt-3">

            <label>
              Description
            </label>

            <textarea
              rows={3}
              className="form-control"
              value={description}
              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }
            />

          </div>

          <div className="mt-3">

            <label>
              Agent Type
            </label>

            <select
              className="form-select"
              value={agentType}
              onChange={(e) =>
                setAgentType(
                  e.target.value
                )
              }
            >
              <option value="workout_generator">
                Workout Generator
              </option>

              <option value="workout_import">
                Workout Import
              </option>

              <option value="validator">
                Validator
              </option>

              <option value="reporting">
                Reporting
              </option>

              <option value="custom">
                Custom
              </option>

            </select>

          </div>

          <div className="mt-3">

            <label>
              System Prompt
            </label>

            <textarea
              rows={12}
              className="form-control"
              value={
                systemPrompt
              }
              onChange={(e) =>
                setSystemPrompt(
                  e.target.value
                )
              }
              placeholder="Describe exactly what this agent should do..."
            />

          </div>

          <hr />

          <h4>
            Available Tools
          </h4>

          <p
            className="small"
            style={{
              opacity: 0.7,
            }}
          >
            Select tools this agent
            is allowed to use.
          </p>

          {AVAILABLE_TOOLS.map(
            (tool) => (
              <div
                key={tool.id}
                className="card bg-dark border-secondary mb-2"
              >
                <div className="card-body">

                  <div className="form-check">

                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={
                        tools.includes(
                          tool.id
                        )
                      }
                      onChange={() =>
                        toggleTool(
                          tool.id
                        )
                      }
                    />

                    <label
                      className="form-check-label"
                    >
                      <strong>
                        {tool.name}
                      </strong>
                    </label>

                  </div>

                  <div
                    className="small mt-2"
                    style={{
                      opacity: 0.75,
                    }}
                  >
                    {
                      tool.description
                    }
                  </div>

                  <div
                    className="small"
                    style={{
                      color:
                        "#9ca3af",
                    }}
                  >
                    Category:
                    {" "}
                    {
                      tool.category
                    }
                  </div>

                </div>
              </div>
            )
          )}

          <div className="mt-4">

            <button
              className="btn btn-success"
              onClick={
                createAgent
              }
              disabled={saving}
            >
              {saving
                ? "Creating Agent..."
                : "Create Agent"}
            </button>

            <button
              className="btn btn-outline-light ms-2"
              onClick={() =>
                router.push(
                  "/admin/ai-agents"
                )
              }
            >
              Cancel
            </button>

          </div>

        </div>
      </main>
    </>
  );
}
