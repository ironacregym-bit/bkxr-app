import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function ExecutionPage() {
  const router = useRouter();

  const { executionId } =
    router.query;

  const [execution, setExecution] =
    useState<any>(null);

  const [logs, setLogs] =
    useState<any[]>([]);

  useEffect(() => {
    if (executionId) {
      loadExecution();
    }
  }, [executionId]);

  async function loadExecution() {
    const response =
      await fetch(
        `/api/agents/execution-details?executionId=${executionId}`
      );

    const json =
      await response.json();

    setExecution(
      json.execution
    );

    setLogs(
      json.runtimeLogs || []
    );
  }

  return (
    <>
      <Head>
        <title>
          Execution Explorer
        </title>
      </Head>

      <main
        className="container py-3"
        style={{
          color: "#fff",
        }}
      >
        {execution && (
          <div className="ia-tile ia-tile-pad mb-3">

            <h2>
              {execution.agentName}
            </h2>

            <div>
              Status:
              {" "}
              {execution.status}
            </div>

            <div>
              Duration:
              {" "}
              {execution.durationMs}
              ms
            </div>

          </div>
        )}

        <div className="ia-tile ia-tile-pad">

          <h3>
            Runtime Timeline
          </h3>

          {logs.map(
            (log) => (
              <div
                key={log.id}
                className="mb-3"
              >
                <strong>
                  {log.step}
                </strong>

                <div>
                  {log.message}
                </div>
              </div>
            )
          )}

        </div>

      </main>
    </>
  );
}
