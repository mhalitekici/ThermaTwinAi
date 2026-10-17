import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays } from "lucide-react";
import type { Snapshot } from "../lib";
import { date, temp } from "../lib";
import { chartRows } from "../science";
import { HelpTip } from "./common";
export default function TemperatureChart({
  snapshot,
  initialDays = 30,
  includeForecast = true,
}: {
  snapshot: Snapshot;
  initialDays?: number;
  includeForecast?: boolean;
}) {
  const [days, setDays] = useState(initialDays),
    [view, setView] = useState<"sst" | "anomaly">("sst");
  const rows = chartRows(snapshot, days, includeForecast),
    origin = Date.parse(snapshot.origin_date);
  return (
    <section
      className="panel temperature-chart"
      aria-label="Deniz sıcaklığı ve model tahmini grafiği"
    >
      <div className="panel-head">
        <div>
          <h2>
            {view === "sst"
              ? "Sıcaklığın zaman içindeki değişimi"
              : "Mevsimsel sıcaklık farkı"}
          </h2>
          <p>
            {date(rows[0]?.date)} — {date(rows.at(-1)?.date)}
          </p>
        </div>
        <div className="segmented" aria-label="Grafik tarih aralığı">
          {[14, 30, 90, 365].map((d) => (
            <button
              key={d}
              aria-pressed={days === d}
              className={days === d ? "active" : ""}
              onClick={() => setDays(d)}
            >
              {d === 365 ? "1 yıl" : `${d} gün`}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-toolbar">
        <div className="chart-tabs" aria-label="Grafik türü">
          <button
            onClick={() => setView("sst")}
            aria-pressed={view === "sst"}
            className={view === "sst" ? "active" : ""}
          >
            Sıcaklık
          </button>
          <button
            onClick={() => setView("anomaly")}
            aria-pressed={view === "anomaly"}
            className={view === "anomaly" ? "active" : ""}
          >
            Anomali
          </button>
        </div>
        <span className="chart-hint">
          <CalendarDays size={14} />
          {includeForecast
            ? "Kesikli çizgi: model tahmini"
            : "Yalnız geçmiş gözlemler"}
          <HelpTip
            label="Grafik nasıl okunur?"
            text="Kesintisiz çizgi günlük uydu analizidir. Kesikli mavi çizgi son gözlemden sonraki model tahminidir. Turuncu noktalar sıcak gün eşiğinin aşıldığı gözlemlerdir. Aradaki eksik gözlemler doldurulmaz."
          />
        </span>
      </div>
      <div className="chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 25, right: 16, bottom: 8, left: 0 }}
            accessibilityLayer
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--chart-grid)"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
              tickFormatter={(t) =>
                date(new Date(t).toISOString()).replace(/ \d{4}/, "")
              }
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              minTickGap={38}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={(v) => temp(v, 1)}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              width={48}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = rows.find((r) => r.time === Number(label));
                if (!point) return null;
                return (
                  <div className="chart-tooltip">
                    <strong>{date(point.date, true)}</strong>
                    <span className="tooltip-kind">
                      {point.actual !== null ? "Uydu gözlemi" : "Model tahmini"}
                    </span>
                    {(point.actual !== null || point.predicted !== null) && (
                      <div>
                        Sıcaklık{" "}
                        <b>{temp(point.actual ?? point.predicted, 2)} °C</b>
                      </div>
                    )}
                    <div>
                      Mevsimsel normal <b>{temp(point.reference, 2)} °C</b>
                    </div>
                    <div>
                      Sıcak gün eşiği <b>{temp(point.threshold, 2)} °C</b>
                    </div>
                    {point.interval && (
                      <div>
                        Tahmin aralığı{" "}
                        <b>
                          {temp(point.interval[0], 2)}–
                          {temp(point.interval[1], 2)} °C
                        </b>
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {includeForecast && (
              <ReferenceArea
                x1={origin}
                x2={rows.at(-1)?.time}
                fill="var(--blue)"
                fillOpacity={0.045}
                label={{
                  value: "TAHMİN",
                  position: "insideTopRight",
                  fill: "var(--blue)",
                  fontSize: 10,
                }}
              />
            )}
            {view === "sst" ? (
              <>
                <Area
                  dataKey="interval"
                  name="Ampirik tahmin aralığı"
                  fill="var(--blue)"
                  fillOpacity={0.12}
                  stroke="none"
                  isAnimationActive={false}
                  connectNulls={false}
                />
                <Area
                  type="linear"
                  dataKey="actual"
                  name="Gözlemlenen sıcaklık"
                  fill="var(--cyan)"
                  fillOpacity={0.06}
                  stroke="var(--cyan)"
                  strokeWidth={2.5}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="reference"
                  name="Mevsimsel normal"
                  stroke="var(--reference-line)"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="threshold"
                  name="Sıcak gün eşiği"
                  stroke="var(--amber-line)"
                  strokeDasharray="3 5"
                  strokeWidth={1.3}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="predicted"
                  name="Model tahmini"
                  stroke="var(--blue)"
                  strokeDasharray="6 4"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--surface)", strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Scatter
                  dataKey="anomalyPoint"
                  name="Gözlenen eşik aşımı"
                  fill="var(--amber-line)"
                  isAnimationActive={false}
                />
              </>
            ) : (
              <>
                <ReferenceLine y={0} stroke="var(--reference-line)" />
                <Area
                  type="linear"
                  dataKey="anomaly"
                  name="Gözlenen fark"
                  fill="var(--amber-line)"
                  fillOpacity={0.08}
                  stroke="var(--amber-line)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  connectNulls={false}
                />
                <Line
                  type="linear"
                  dataKey="predictedAnomaly"
                  name="Tahmini fark"
                  stroke="var(--blue)"
                  strokeDasharray="6 4"
                  dot={{ r: 3 }}
                  strokeWidth={2}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        <span>
          <i className="actual" />
          Gözlemlenen
        </span>
        {includeForecast && (
          <span>
            <i className="predicted" />
            Model tahmini
          </span>
        )}
        <span>
          <i className="reference" />
          Mevsimsel normal
        </span>
        <span>
          <i className="threshold" />
          Sıcak gün eşiği (P90)
        </span>
      </div>
      <p className="axis-caption">Gözlem / tahmin tarihi · Sıcaklık (°C)</p>
    </section>
  );
}
