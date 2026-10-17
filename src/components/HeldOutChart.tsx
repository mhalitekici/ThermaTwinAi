import type { Trace } from "../performance";
import { date, temp } from "../lib";

export default function HeldOutChart({ rows }: { rows: Trace[] }) {
  const points = rows.slice(-90);
  if (!points.length) return null;
  const low =
    Math.min(...points.map((r) => Math.min(r[2], r[3] - r[9], r[4]))) - 0.1;
  const high =
    Math.max(...points.map((r) => Math.max(r[2], r[3] + r[9], r[4]))) + 0.1;
  const first = Date.parse(points[0][1]),
    last = Date.parse(points.at(-1)![1]);
  const x = (r: Trace) =>
    12 + ((Date.parse(r[1]) - first) / (last - first || 1)) * 976;
  const y = (n: number) => 12 + (1 - (n - low) / (high - low)) * 236;
  const path = (col: 2 | 3 | 4) =>
    points
      .map(
        (r, i) =>
          `${i && Date.parse(r[1]) - Date.parse(points[i - 1][1]) === 86400000 ? "L" : "M"}${x(r)},${y(r[col])}`,
      )
      .join(" ");
  return (
    <figure className="lab-figure">
      <figcaption>
        <strong>Gözlem ile test tahmini</strong>
        <span>
          Seçili kapsamın son {points.length} kaydı · Eksik tarihler
          birleştirilmez
        </span>
      </figcaption>
      <div className="lab-chart-legend">
        <span>━ Gözlem</span>
        <span>┄ Model</span>
        <span>··· Persistence</span>
        <span>Soluk dikey aralık: nominal %80</span>
      </div>
      <div className="lab-chart-bound">{temp(high, 1)} °C</div>
      <svg
        viewBox="0 0 1000 260"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Gerçek gözlem ve test tahmini; ${date(points[0][1])} – ${date(points.at(-1)![1])}. Sayısal alternatif aşağıdaki tabloda.`}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1="0"
            x2="1000"
            y1={12 + i * 59}
            y2={12 + i * 59}
            stroke="var(--chart-grid)"
          />
        ))}
        {points.map((r) => (
          <line
            key={r[1]}
            x1={x(r)}
            x2={x(r)}
            y1={y(r[3] - r[9])}
            y2={y(r[3] + r[9])}
            stroke="var(--cyan)"
            strokeOpacity="0.18"
            strokeWidth="5"
          >
            <title>
              {date(r[1])}: {temp(r[3] - r[9], 2)} – {temp(r[3] + r[9], 2)} °C
            </title>
          </line>
        ))}
        <path
          d={path(4)}
          stroke="var(--text-muted)"
          strokeDasharray="2 5"
          fill="none"
          strokeWidth="1.7"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path(2)}
          stroke="var(--text)"
          fill="none"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path(3)}
          stroke="var(--cyan)"
          strokeDasharray="7 4"
          fill="none"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="lab-chart-bound">{temp(low, 1)} °C</div>
      <div className="lab-chart-dates">
        <span>{date(points[0][1])}</span>
        <span>{date(points.at(-1)![1])}</span>
      </div>
      <details>
        <summary>Grafiğin {points.length} kaydını tablo olarak oku</summary>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Grafik kayitlari"
        >
          <table>
            <caption>
              Grafikte gösterilen gerçek test kayıtları; tüm kapsam HTML
              raporunda.
            </caption>
            <thead>
              <tr>
                <th scope="col">Başlangıç / hedef</th>
                <th scope="col">Gözlem °C</th>
                <th scope="col">Model °C</th>
                <th scope="col">Persistence °C</th>
                <th scope="col">Aralık °C</th>
              </tr>
            </thead>
            <tbody>
              {points.map((r) => (
                <tr key={r[1]}>
                  <th scope="row">
                    {date(r[0])} / {date(r[1])}
                  </th>
                  <td>{temp(r[2], 3)}</td>
                  <td>{temp(r[3], 3)}</td>
                  <td>{temp(r[4], 3)}</td>
                  <td>
                    {temp(r[3] - r[9], 3)} – {temp(r[3] + r[9], 3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
