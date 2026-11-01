import type { Place } from "./data";

export type UsageLog = {
  id: string;
  place_id: string;
  author_id: string;
  used_at: string;
  actual_fee: number | null;
  usual_fee: number | null;
  created_at: string;
};
export type SurveyPhase = "baseline" | "followup";
export type Survey = {
  author_id: string;
  phase: SurveyPhase;
  monthly_fee: number;
};
export type SurveySummary = {
  phase: SurveyPhase;
  responses: number;
  avg_fee: number | null;
};

export const targetKeys = [
  "participation_rate",
  "district_count",
  "monthly_usage",
  "monthly_savings",
] as const;
export type TargetKey = (typeof targetKeys)[number];
export type KpiTargets = Partial<Record<TargetKey, number>>;

export const seoulDistricts = [
  "강남구",
  "강동구",
  "강북구",
  "강서구",
  "관악구",
  "광진구",
  "구로구",
  "금천구",
  "노원구",
  "도봉구",
  "동대문구",
  "동작구",
  "마포구",
  "서대문구",
  "서초구",
  "성동구",
  "성북구",
  "송파구",
  "양천구",
  "영등포구",
  "용산구",
  "은평구",
  "종로구",
  "중구",
  "중랑구",
];

export function districtOf(address: string): string | null {
  if (!address.includes("서울")) return null;
  return seoulDistricts.find((district) => address.includes(district)) ?? null;
}

// 주차장 요금 표시. 무료이거나 요금이 입력된 경우에만 값이 있다.
export function feeLabel(place: Place): string {
  if (place.category !== "parking") return "";
  if (place.parking_free) return "무료";
  if (place.fee_per_30min === null || place.fee_per_30min === undefined)
    return "";
  const base = `30분 ${place.fee_per_30min.toLocaleString("ko-KR")}원`;
  return place.free_minutes ? `${base} · ${place.free_minutes}분 무료` : base;
}

// 절감액 = 평소 주차비 - 실제 주차비 (둘 다 입력한 기록만, 음수는 0)
export function savingOf(log: UsageLog): number | null {
  if (log.actual_fee === null || log.usual_fee === null) return null;
  return Math.max(0, log.usual_fee - log.actual_fee);
}

export function monthOf(date: string) {
  return date.slice(0, 7);
}

// 설문 평균은 응답 3건 이상일 때만 공개한다(데이터베이스 함수 survey_summary와 동일).
export function summarizeSurveys(rows: Survey[]): SurveySummary[] {
  return (["baseline", "followup"] as const).flatMap((phase) => {
    const phaseRows = rows.filter((row) => row.phase === phase);
    if (!phaseRows.length) return [];
    const average = phaseRows.reduce((sum, row) => sum + row.monthly_fee, 0);
    return [
      {
        phase,
        responses: phaseRows.length,
        avg_fee:
          phaseRows.length >= 3 ? Math.round(average / phaseRows.length) : null,
      },
    ];
  });
}

export type MonthRow = {
  month: string;
  count: number;
  savings: number;
  savingCount: number;
  users: number;
};

export function kpiSummary(places: Place[], logs: UsageLog[], month: string) {
  const buckets = new Map<
    string,
    { count: number; savings: number; savingCount: number; users: Set<string> }
  >();
  for (const log of logs) {
    const key = monthOf(log.used_at);
    const bucket = buckets.get(key) ?? {
      count: 0,
      savings: 0,
      savingCount: 0,
      users: new Set<string>(),
    };
    bucket.count += 1;
    bucket.users.add(log.author_id);
    const saved = savingOf(log);
    if (saved !== null) {
      bucket.savings += saved;
      bucket.savingCount += 1;
    }
    buckets.set(key, bucket);
  }
  const months: MonthRow[] = [...buckets.entries()]
    .map(([key, bucket]) => ({
      month: key,
      count: bucket.count,
      savings: bucket.savings,
      savingCount: bucket.savingCount,
      users: bucket.users.size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const current = months.find((row) => row.month === month) ?? {
    month,
    count: 0,
    savings: 0,
    savingCount: 0,
    users: 0,
  };
  const districtCounts = new Map<string, number>();
  for (const place of places) {
    if (place.category !== "parking") continue;
    const district = districtOf(place.address);
    if (district)
      districtCounts.set(district, (districtCounts.get(district) ?? 0) + 1);
  }
  return {
    months,
    current,
    totalCount: logs.length,
    totalSavings: months.reduce((sum, row) => sum + row.savings, 0),
    districtCounts,
  };
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// 엑셀에서 한글이 깨지지 않도록 BOM을 붙인다.
export function toCsv(rows: (string | number)[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

export function monthlyCsv(months: MonthRow[]) {
  return toCsv([
    ["월", "이용 건수", "활성 멤버", "추정 절감액(원)", "절감액 입력 건수"],
    ...months.map((row) => [
      row.month,
      row.count,
      row.users,
      row.savings,
      row.savingCount,
    ]),
  ]);
}

export function placesCsv(places: Place[]) {
  return toCsv([
    [
      "이름",
      "종류",
      "구",
      "주소",
      "요금",
      "요금 안내",
      "위도",
      "경도",
      "등록일",
    ],
    ...places.map((place) => [
      place.name,
      place.category === "parking" ? "주차장" : "맛집",
      districtOf(place.address) ?? "",
      place.address,
      feeLabel(place),
      place.price,
      place.lat,
      place.lng,
      place.created_at.slice(0, 10),
    ]),
  ]);
}
