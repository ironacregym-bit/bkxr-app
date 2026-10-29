import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * =====================================================
 * AGENT EXECUTIONS PAGE
 * =====================================================
 *
 * Purpose
 * -------
 *
 * Central observability dashboard.
 *
 * Shows:
 *
 * - Agent Runs
 * - Duration
 * - Status
 * - Tools Used
 * - Draft Created
 * - Runtime Trace Links
 *
 * Future
 * -------
 *
 * - Search
 * - Filters
 * - Cost Tracking
 * - Token Usage
 * - Agent Metrics
 * - Tenant Metrics
 *
 */

interface Execution {
  id: string;

  executionId?: string;

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
          paddingBottom: 100,
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
            runtime performance and
            outcomes across all
            platform agents.
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

                  <h5 className="mb-2">
                    {
                      execution.agentName
                    }
                  </h5>

                  <div className="small">

                    <div>
                      <strong>
                        Execution:
                      </strong>
                      {" "}
                      {
                        execution.executionId
                      }
                    </div>

                    <div>
                      <strong>
                        Type:
                      </strong>
                      {" "}
                      {
                        execution.executionType
                      }
                    </div>

                    <div>
                      <strong>
                        Duration:
                      </strong>
                      {" "}
                      {
                        execution.durationMs
                      }
                      ms
                    </div>

                    <div>
                      <strong>
                        Tools:
                      </strong>
                      {" "}
                      {execution.toolsUsed
                        ?.length
                        ? execution.toolsUsed.join(
                            ", "
                          )
                        : "None"}
                    </div>

                    <div>
                      <strong>
                        Draft:
                      </strong>
                      {" "}
                      {
                        execution.draftId ||
                        "-"
                      }
                    </div>

                  </div>

                </div>

                <div className="text-end">

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

                  {execution.executionId && (
                    <div className="mt-3">

                      <Link href={`/admin/ai/executions/${execution.executionId}`}>
                        View Trace
                      </Link>

                    </div>
                  )}

                </div>

              </div>
            </div>
          )
        )}

      </main>
    </>
  );
}
