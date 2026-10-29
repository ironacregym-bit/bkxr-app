import Head from "next/head";
import { useEffect, useState } from "react";

/**
 * =====================================================
 * AGENT EXECUTIONS PAGE
 * =====================================================
 *
 * Purpose
 * -------
 *
 * Provides visibility into every
 * agent execution within the platform.
 *
 * Future
 * -------
 *
 * - Filters
 * - Search
 * - Runtime Explorer
 * - Cost Tracking
 * - Token Tracking
 * - Tenant Isolation
 *
 */

interface Execution {
  id: string;

  agentName?: string;

  executionType?: string;

  status?: string;

  durationMs?: number;

  toolsUsed?: string[];

  createdAt?: any;

  draftId?: string;
}

export default function AgentExecutionsPage() {
  const [
    executions,
    setExecutions,
  ] = useState<Execution[]>(
    []
  );

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    loadExecutions();
  }, []);

  async function loadExecutions() {
    try {
      const response =
        await fetch(
          "/api/agents/executions"
        );

      const json =
        await response.json();

      setExecutions(
        json.executions || []
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>
          Agent Executions
        </title>
      </Head>

      <main
        className="container py-3"
        style={{
          color: "#fff",
        }}
      >
        <div className="ia-tile ia-tile-pad mb-3">

          <div className="ia-kicker">
            OBSERVABILITY
          </div>

          <div className="ia-page-title">
            Agent Executions
          </div>

          <div className="ia-page-subtitle">
            Track execution history,
            performance and outcomes.
          </div>

        </div>

        {loading && (
          <div>
            Loading executions...
          </div>
        )}

        {!loading &&
          executions.length === 0 && (
            <div>
              No executions found.
            </div>
          )}

        {executions.map(
          (execution) => (
            <div
              key={execution.id}
              className="ia-tile ia-tile-pad mb-3"
            >
              <div className="d-flex justify-content-between">

                <div>

                  <h5>
                    {
                      execution.agentName
                    }
                  </h5>

                  <div className="small">

                    <div>
                      Type:
                      {" "}
                      {
                        execution.executionType
                      }
                    </div>

                    <div>
                      Duration:
                      {" "}
                      {
                        execution.durationMs
                      }
                      ms
                    </div>

                    <div>
                      Tools:
                      {" "}
                      {
                        execution
                          .toolsUsed
                          ?.join(", ")
                      }
                    </div>

                    <div>
                      Draft:
                      {" "}
                      {
                        execution.draftId ||
                        "-"
                      }
                    </div>

                  </div>

                </div>

                <div>

                  <span
                    className={
                      execution.status ===
                      "success"
                        ? "badge bg-success"
                        : "badge bg-danger"
                    }
                  >
                    {
                      execution.status
                    }
                  </span>

                </div>

              </div>
            </div>
          )
        )}

      </main>
    </>
  );
}
