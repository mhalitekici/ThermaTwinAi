import type { Snapshot } from "./lib";
const DAY = 86400000;
export function freshnessState(snap: Snapshot, now = Date.now()) {
  const origin = Date.parse(`${snap.origin_date}T00:00:00Z`);
  const today = Math.floor(now / DAY) * DAY;
  if (
    !Number.isFinite(origin) ||
    new Date(origin).toISOString().slice(0, 10) !== snap.origin_date ||
    origin > today ||
    !Number.isFinite(snap.observation.sst_c)
  )
    return {
      status: "unavailable" as const,
      label: "Veri doğrulanamadı",
      age: null,
      reason:
        "Gözlem tarihi veya sayısal değer geçersiz; güncel gözlem olarak yorumlanamaz.",
    };
  const age = Math.floor((today - origin) / DAY);
  if (snap.mode === "replay")
    return {
      status: "historical" as const,
      label: "Geçmiş kayıt",
      age,
      reason:
        "Tarihsel tekrar. Güncel gözlem veya güncel bildirim uygunluğu değildir.",
    };
  const dates = new Map(snap.history.map((r) => [r.date, r.sst_c]));
  const complete = Array.from({ length: 15 }, (_, i) =>
    new Date(origin - i * DAY).toISOString().slice(0, 10),
  ).every(
    (day) =>
      typeof dates.get(day) === "number" && Number.isFinite(dates.get(day)),
  );
  if (!complete)
    return {
      status: "missing" as const,
      label: "Yakın geçmiş eksik",
      age,
      reason:
        "Son 15 takvim gününde eksik/geçersiz SST var; model girdisinin sürekliliği doğrulanamıyor.",
    };
  if (snap.stale || age > 3)
    return {
      status: "delayed" as const,
      label: "Gecikmiş gözlem",
      age,
      reason:
        "Üç günlük güncellik penceresi aşılmış veya kaynak eski işaretlenmiş. Eski veri için canlı e-posta bastırılır.",
    };
  return {
    status: "current" as const,
    label: "Güncellik penceresinde",
    age,
    reason:
      "Son gözlem en fazla üç takvim günü yaşında. Günlük uydu analizi, anlık sensör verisi değildir.",
  };
}
export function timestamp(value: string | undefined) {
  if (
    !value ||
    !/T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    return null;
  return (
    new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(value)) + " UTC"
  );
}
