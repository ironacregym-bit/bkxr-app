import Head from "next/head";
import { useEffect, useState } from "react";

/**
 * =====================================================
 * AGENT METRICS PAGE
 * =====================================================
 */

export default function AgentMetricsPage() {
  const [metrics, setMetrics] =
    useState<any>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    const response =
      await fetch(
        "/api/agents/metrics"
      );

    const json =
      await response.json();

    setMetrics(json);
  }

  if (!metrics) {
    return (
      <div className="container py-3">
        Loading...
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>
          Agent Metrics
        </title>
      </Head>

      <main
        className="container py-3"
        style={{
          color: "#fff",
        }}
      >
        <div className="row">

          <div className="col-md-3 mb-3">
            <div className="ia-tile ia-tile-pad">
              <h5>
                Executions
              </h5>

              <h2>
                {
                  metrics.totalExecutions
                }
              </h2>
            </div>
          </div>

          <div className="col-md-3 mb-3">
            <div className="ia-tile ia-tile-pad">
              <h5>
                Success %
              </h5>

              <h2>
                {
                  metrics.successRate
                }
                %
              </h2>
            </div>
          </div>

          <div className="col-md-3 mb-3">
            <div className="ia-tile ia-tile-pad">
              <h5>
                Tokens
              </h5>

              <h2>
                {metrics.totalTokens}
              </h2>
            </div>
          </div>

          <div className="col-md-3 mb-3">
            <div className="ia-tile ia-tile-pad">
              <h5>
                Cost
              </h5>

              <h2>
                £
                {Number(
                  metrics.estimatedCost
                ).toFixed(4)}
              </h2>
            </div>
          </div>

        </div>

        <div className="ia-tile ia-tile-pad">

          <h4>
            Average Runtime
          </h4>

          <p>
            {
              metrics.averageDuration
            }
            ms
          </p>

        </div>

      </main>
    </>
  );
}
