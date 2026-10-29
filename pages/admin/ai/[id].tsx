import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

/**
 * =====================================================
 * AGENT EDITOR
 * =====================================================
 *
 * Purpose
 * -------
 *
 * Edit and manage AI Agents
 * without touching Firestore.
 *
 * Capabilities
 * ------------
 *
 * - Edit Agent Details
 * - Edit Prompt
 * - Add / Remove Rules
 * - Enable / Disable Agent
 * - Configure Tools
 * - Configure Models
 *
 * Future
 * ------
 *
 * - Test Agent
 * - Version History
 * - Execution Logs
 * - Cost Tracking
 * - Prompt Comparison
 * - Templates
 *
 */

import {
  AVAILABLE_TOOLS,
} from "../../../lib/agents/availableTools";


export default function EditAgentPage() {
  const router = useRouter();

  const { id } = router.query;

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

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

  const [active, setActive] =
    useState(true);

  const [provider, setProvider] =
    useState("google");

  const [model, setModel] =
    useState("gemini-2.5-flash");

  const [
    agentType,
    setAgentType,
  ] = useState("custom");

  const [rules, setRules] =
    useState<string[]>([]);

  const [tools, setTools] =
    useState<string[]>([]);

  const [newRule, setNewRule] =
    useState("");

  useEffect(() => {
    if (id) {
      loadAgent();
    }
  }, [id]);

  async function loadAgent() {
    try {
      const response =
        await fetch(
          `/api/agents/get?id=${id}`
        );

      const json =
        await response.json();

      const agent = json.agent;

      setName(
        agent.name || ""
      );

      setDescription(
        agent.description || ""
      );

      setSystemPrompt(
        agent.system_prompt || ""
      );

      setActive(
        agent.active ?? true
      );

      setProvider(
        agent.provider ||
          "google"
      );

      setModel(
        agent.model ||
          "gemini-2.5-flash"
      );

      setAgentType(
        agent.agent_type ||
          "custom"
      );

      setRules(
        agent.rules || []
      );

      setTools(
        agent.tools || []
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function saveAgent() {
    try {
      setSaving(true);

      const response =
        await fetch(
          "/api/agents/update",
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
              system_prompt:
                systemPrompt,
              active,
              provider,
              model,
              agent_type:
                agentType,
              rules,
              tools,
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

      alert(
        "Agent Saved"
      );
    } catch (error: any) {
      alert(
        error.message
      );
    } finally {
      setSaving(false);
    }
  }

  function addRule() {
    if (!newRule.trim()) {
      return;
    }

    setRules([
      ...rules,
      newRule,
    ]);

    setNewRule("");
  }

  function removeRule(
    index: number
  ) {
    setRules(
      rules.filter(
        (_, i) => i !== index
      )
    );
  }

  function toggleTool(
    tool: string
  ) {
    if (
      tools.includes(tool)
    ) {
      setTools(
        tools.filter(
          (t) => t !== tool
        )
      );
    } else {
      setTools([
        ...tools,
        tool,
      ]);
    }
  }

  if (loading) {
    return (
      <main className="container py-3">
        Loading Agent...
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>
          Edit Agent
        </title>
      </Head>

      <main
        className="container py-3"
        style={{
          color: "#fff",
        }}
      >
        <div className="ia-tile ia-tile-pad">

          <h2>
            🤖 Agent Editor
          </h2>

          <div className="mt-4">

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
            />

          </div>

          <div className="mt-3">

            <label>
              Description
            </label>

            <textarea
              rows={3}
              className="form-control"
              value={
                description
              }
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
              Model
            </label>

            <input
              className="form-control"
              value={model}
              onChange={(e) =>
                setModel(
                  e.target.value
                )
              }
            />

          </div>

          <div className="form-check mt-4">

            <input
              type="checkbox"
              className="form-check-input"
              checked={active}
              onChange={(e) =>
                setActive(
                  e.target.checked
                )
              }
            />

            <label
              className="form-check-label"
            >
              Agent Active
            </label>

          </div>

          <hr />

          <h4>
            System Prompt
          </h4>

          <textarea
            rows={12}
            className="form-control"
            value={systemPrompt}
            onChange={(e) =>
              setSystemPrompt(
                e.target.value
              )
            }
          />

          <hr />

          <h4>Rules</h4>

          {rules.map(
            (
              rule,
              index
            ) => (
              <div
                key={index}
                className="d-flex justify-content-between align-items-center mb-2"
              >
                <span>
                  {rule}
                </span>

                <button
                  className="btn btn-sm btn-danger"
                  onClick={() =>
                    removeRule(
                      index
                    )
                  }
                >
                  Delete
                </button>

              </div>
            )
          )}

          <div className="mt-3 d-flex">

            <input
              className="form-control"
              value={
                newRule
              }
              onChange={(e) =>
                setNewRule(
                  e.target.value
                )
              }
            />

            <button
              className="btn btn-success ms-2"
              onClick={addRule}
            >
              Add
            </button>

          </div>

          <hr />

          <h4>Tools</h4>

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
                      checked={tools.includes(
                        tool.id
                      )}
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
                    {tool.description}
                  </div>
          
                  <div
                    className="small mt-1"
                    style={{
                      color: "#9ca3af",
                    }}
                  >
                    Category:
                    {" "}
                    {tool.category}
                  </div>
          
                </div>
              </div>
            )
          )}

          <div className="mt-4">

            <button
              className="btn btn-success"
              onClick={
                saveAgent
              }
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save Agent"}
            </button>

          </div>

        </div>
      </main>
    </>
  );
}
