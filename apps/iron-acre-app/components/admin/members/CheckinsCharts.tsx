import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
  type ChartDataset,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

export type CheckinsChartsRow = {
  date: string;            // ISO
  weight_kg: number | null;
  body_fat_pct: number | null;
  photo_url?: string | null;
};

export type CheckinsChartsProps = {
  results: CheckinsChartsRow[];   // pass newest-first or any; we re-order for charts
};

const AXIS_COLOR = "#9fb0c3";
const GRID_COLOR = "rgba(255,255,255,0.08)";

const baseLineOptions: ChartOptions<"line"> = {
  responsive: true,
  plugins: { legend: { labels: { color: "#e9eef6" } } },
  scales: {
    x: { ticks: { color: AXIS_COLOR }, grid: { color: GRID_COLOR } },
    y: { ticks: { color: AXIS_COLOR }, grid: { color: GRID_COLOR } },
  },
};

export default function CheckinsCharts({ results }: CheckinsChartsProps) {
  const weightChart = useMemo(() => {
    const src = (results || []).slice().reverse();
    if (!src.length) return null;

    const labels = src.map((r) =>
      new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    );
    const data = src.map((r) => (typeof r.weight_kg === "number" ? r.weight_kg : null));

    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Weight (kg)",
          data: data as (number | null)[],
          borderColor: "#4fa3a5",
          backgroundColor: "rgba(79,163,165,0.25)",
          tension: 0.3,
          pointRadius: 2,
        } as ChartDataset<"line">,
      ],
    };

    return { chartData, options: baseLineOptions };
  }, [results]);

  const bodyFatChart = useMemo(() => {
    const src = (results || []).slice().reverse();
    if (!src.length) return null;

    const labels = src.map((r) =>
      new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    );
    const data = src.map((r) => (typeof r.body_fat_pct === "number" ? r.body_fat_pct : null));

    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Body fat (%)",
          data: data as (number | null)[],
          borderColor: "#ff4fa3",
          backgroundColor: "rgba(255,79,163,0.25)",
          tension: 0.3,
          pointRadius: 2,
        } as ChartDataset<"line">,
      ],
    };

    return { chartData, options: baseLineOptions };
  }, [results]);

  return (
    <div className="row gx-3">
      <div className="col-12 col-md-6 mb-3">
        <div className="futuristic-card p-3">
          <h6 className="mb-2" style={{ fontWeight: 700 }}>
            Weight
          </h6>
          {weightChart ? (
            <Line data={weightChart.chartData} options={weightChart.options} />
          ) : (
            <div className="text-dim">No check‑ins yet.</div>
          )}
        </div>
      </div>
      <div className="col-12 col-md-6 mb-3">
        <div className="futuristic-card p-3">
          <h6 className="mb-2" style={{ fontWeight: 700 }}>
            Body fat
          </h6>
          {bodyFatChart ? (
            <Line data={bodyFatChart.chartData} options={bodyFatChart.options} />
          ) : (
            <div className="text-dim">No check‑ins yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
