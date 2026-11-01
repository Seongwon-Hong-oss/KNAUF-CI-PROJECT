import type { Comment, Like, Place, Profile } from "./data";

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

export type RankRow = {
  key: string;
  name: string;
  sub?: string;
  value: string;
  person?: boolean;
  avatar?: string | null;
};
export type RankCard = { title: string; rows: RankRow[] };

// 멤버 대시보드용 재미 순위(각 TOP 3). 금액은 노출하지 않고 횟수만 보여준다.
export function funRankCards(input: {
  places: Place[];
  members: Profile[];
  likes: Like[];
  comments: Comment[];
  logs: UsageLog[];
  month: string;
}): RankCard[] {
  const { places, members, likes, comments, logs, month } = input;
  const placeById = new Map(places.map((place) => [place.id, place]));
  const memberById = new Map(members.map((member) => [member.id, member]));
  const count = (keys: string[]) => {
    const map = new Map<string, number>();
    for (const key of keys) map.set(key, (map.get(key) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  };
  const people = (entries: [string, number][], unit: string): RankRow[] =>
    entries.flatMap(([id, value]) => {
      const member = memberById.get(id);
      return member
        ? [
            {
              key: id,
              name: member.name,
              sub: member.department,
              value: `${value}${unit}`,
              person: true,
              avatar: member.avatar_path,
            },
          ]
        : [];
    });
  const spots = (entries: [string, number][], unit: string): RankRow[] =>
    entries.flatMap(([id, value]) => {
      const place = placeById.get(id);
      return place
        ? [
            {
              key: id,
              name: place.name,
              sub: districtOf(place.address) ?? feeLabel(place),
              value: `${value}${unit}`,
            },
          ]
        : [];
    });
  const parking = places.filter((place) => place.category === "parking");
  const parkingIds = new Set(parking.map((place) => place.id));
  const restaurantIds = new Set(
    places.filter((place) => place.category === "restaurant").map((p) => p.id),
  );
  const newest = [...places]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);
  return [
    {
      title: "좋아요 최다 멤버",
      rows: people(
        count(
          likes.flatMap((like) => {
            const owner = placeById.get(like.place_id)?.author_id;
            return owner ? [owner] : [];
          }),
        ),
        "개",
      ),
    },
    {
      title: "좋아요 최다 맛집",
      rows: spots(
        count(
          likes
            .map((like) => like.place_id)
            .filter((id) => restaurantIds.has(id)),
        ),
        "개",
      ),
    },
    {
      title: "가장 많이 이용한 주차장",
      rows: spots(
        count(
          logs.map((log) => log.place_id).filter((id) => parkingIds.has(id)),
        ),
        "회",
      ),
    },
    {
      title: "무료 주차장 등록왕",
      rows: people(
        count(
          parking
            .filter((place) => place.parking_free)
            .map((place) => place.author_id),
        ),
        "곳",
      ),
    },
    {
      title: "가장 많이 등록한 멤버",
      rows: people(count(places.map((place) => place.author_id)), "곳"),
    },
    {
      title: "이번 달 이용왕",
      rows: people(
        count(
          logs
            .filter((log) => monthOf(log.used_at) === month)
            .map((log) => log.author_id),
        ),
        "회",
      ),
    },
    {
      title: "소통왕 (댓글)",
      rows: people(count(comments.map((comment) => comment.author_id)), "개"),
    },
    {
      title: "주차장이 가장 많은 구",
      rows: count(
        parking.flatMap((place) => {
          const district = districtOf(place.address);
          return district ? [district] : [];
        }),
      ).map(([district, value]) => ({
        key: district,
        name: district,
        value: `${value}곳`,
      })),
    },
    {
      title: "새로 등록된 장소",
      rows: newest.map((place) => ({
        key: place.id,
        name: place.name,
        sub: place.category === "parking" ? "주차장" : "맛집",
        value: `${Number(place.created_at.slice(5, 7))}월 ${Number(place.created_at.slice(8, 10))}일`,
      })),
    },
  ];
}

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
