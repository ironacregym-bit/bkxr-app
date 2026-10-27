import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";

/**
 * =====================================================
 * CREATE AGENT PAGE
 * =====================================================
 *
 * Allows platform administrators
 * to create new agents without
 * editing Firestore manually.
 *
 * Future:
 *
 * - Templates
 * - Auto Prompt Generation
 * - AI Agent Wizard
 * - Tool Discovery
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

              tools: [],

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
          New Agent
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
            🤖 Create Agent
          </h2>

          <div className="mt-3">

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
              rows={10}
              className="form-control"
              value={
                systemPrompt
              }
              onChange={(e) =>
                setSystemPrompt(
                  e.target.value
                )
              }
            />

          </div>

          <div className="mt-4">

            <button
              className="btn btn-success"
              onClick={
                createAgent
              }
              disabled={saving}
            >
              {saving
                ? "Creating..."
                : "Create Agent"}
            </button>

          </div>

        </div>
      </main>
    </>
  );
}
