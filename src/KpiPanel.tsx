import type { FormEvent } from "react";
import { Download } from "lucide-react";
import type { Place } from "./data";
import { monthlyCsv, placesCsv, seoulDistricts, targetKeys } from "./kpi";
import type { KpiTargets, SurveyPhase, SurveySummary, kpiSummary } from "./kpi";

type Summary = ReturnType<typeof kpiSummary>;

const targetLabels: Record<(typeof targetKeys)[number], string> = {
  participation_rate: "참여율 목표 (%)",
  district_count: "주차장 등록 구 수 목표 (서울 25개 구 중)",
  monthly_usage: "월 이용 건수 목표",
  monthly_savings: "월 추정 절감액 목표 (원)",
};

function download(filename: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Card({
  title,
  value,
  unit,
  sub,
  target,
}: {
  title: string;
  value: number;
  unit: string;
  sub?: string;
  target?: number;
}) {
  const percent =
    target && target > 0
      ? Math.min(100, Math.round((value / target) * 100))
      : null;
  return (
    <div className="kpi-card">
      <span>{title}</span>
      <strong>
        {value.toLocaleString("ko-KR")}
        <small>{unit}</small>
      </strong>
      {sub && <em>{sub}</em>}
      {percent !== null && (
        <>
          <div className="kpi-progress" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>
          <em>
            목표 {target?.toLocaleString("ko-KR")}
            {unit} · 달성 {percent}%
          </em>
        </>
      )}
    </div>
  );
}

export default function KpiPanel({
  places,
  summary,
  month,
  participation,
  targets,
  surveys,
  admin,
  busy,
  onSaveTargets,
  onOpenSurvey,
}: {
  places: Place[];
  summary: Summary;
  month: string;
  participation: number;
  targets: KpiTargets;
  surveys: SurveySummary[];
  admin: boolean;
  busy: boolean;
  onSaveTargets: (targets: KpiTargets) => void;
  onOpenSurvey: (phase: SurveyPhase) => void;
}) {
  const covered = summary.districtCounts.size;
  const uncovered = seoulDistricts.filter(
    (district) => !summary.districtCounts.has(district),
  );
  const baseline = surveys.find((item) => item.phase === "baseline");
  const followup = surveys.find((item) => item.phase === "followup");
  const change =
    baseline?.avg_fee && followup?.avg_fee
      ? Math.round(
          ((followup.avg_fee - baseline.avg_fee) / baseline.avg_fee) * 100,
        )
      : null;
  const surveyText = (item?: SurveySummary) =>
    !item
      ? "응답 없음"
      : item.avg_fee === null
        ? `응답 ${item.responses}명 (3명 이상부터 표시)`
        : `${item.avg_fee.toLocaleString("ko-KR")}원 (${item.responses}명)`;

  function saveTargets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: KpiTargets = {};
    for (const key of targetKeys) {
      const raw = String(form.get(key) ?? "").trim();
      if (raw === "") continue;
      const value = Number(raw);
      if (Number.isFinite(value) && value >= 0) next[key] = value;
    }
    onSaveTargets(next);
  }

  return (
    <section className="kpi-section" aria-label="프로젝트 성과 지표">
      <div className="section-heading">
        <div>
          <h2>프로젝트 성과 지표 (KPI)</h2>
          <p>주차비 절감과 정보 공유 목표 대비 현황 · {month} 기준</p>
        </div>
        <div className="kpi-actions">
          <button
            className="secondary"
            onClick={() =>
              download(`kpi-monthly-${month}.csv`, monthlyCsv(summary.months))
            }
          >
            <Download size={15} />
            월별 이용 CSV
          </button>
          <button
            className="secondary"
            onClick={() => download(`places-${month}.csv`, placesCsv(places))}
          >
            <Download size={15} />
            장소 목록 CSV
          </button>
        </div>
      </div>
      <div className="kpi-grid">
        <Card
          title="이번 달 이용 건수"
          value={summary.current.count}
          unit="건"
          sub={`이용 멤버 ${summary.current.users}명 · 누적 ${summary.totalCount.toLocaleString("ko-KR")}건`}
          target={targets.monthly_usage}
        />
        <Card
          title="이번 달 추정 절감액"
          value={summary.current.savings}
          unit="원"
          sub={`금액 입력 ${summary.current.savingCount}건 기준 · 누적 ${summary.totalSavings.toLocaleString("ko-KR")}원`}
          target={targets.monthly_savings}
        />
        <Card
          title="참여율 (장소 등록 멤버)"
          value={participation}
          unit="%"
          target={targets.participation_rate}
        />
        <Card
          title="주차장 등록 구 (서울)"
          value={covered}
          unit="개 구"
          sub={`전체 ${seoulDistricts.length}개 구 중`}
          target={targets.district_count}
        />
      </div>
      {uncovered.length > 0 && (
        <p className="kpi-note">
          아직 주차장이 없는 구: {uncovered.join(", ")}
        </p>
      )}
      <div className="kpi-survey">
        <h3>월평균 주차비 (설문)</h3>
        <dl>
          <div>
            <dt>도입 전</dt>
            <dd>{surveyText(baseline)}</dd>
          </div>
          <div>
            <dt>도입 후</dt>
            <dd>{surveyText(followup)}</dd>
          </div>
          <div>
            <dt>변화</dt>
            <dd>
              {change === null ? "-" : `${change > 0 ? "+" : ""}${change}%`}
            </dd>
          </div>
        </dl>
        <div className="kpi-actions">
          <button
            className="secondary"
            onClick={() => onOpenSurvey("baseline")}
          >
            도입 전 금액 입력·수정
          </button>
          <button
            className="secondary"
            onClick={() => onOpenSurvey("followup")}
          >
            도입 후 금액 입력·수정
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>월</th>
              <th>이용 건수</th>
              <th>이용 멤버</th>
              <th>추정 절감액</th>
              <th>금액 입력 건수</th>
            </tr>
          </thead>
          <tbody>
            {summary.months.length === 0 ? (
              <tr>
                <td colSpan={5}>아직 이용 기록이 없습니다.</td>
              </tr>
            ) : (
              summary.months.map((row) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>{row.count}</td>
                  <td>{row.users}</td>
                  <td>{row.savings.toLocaleString("ko-KR")}원</td>
                  <td>{row.savingCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {admin && (
        <form
          className="kpi-targets"
          key={JSON.stringify(targets)}
          onSubmit={saveTargets}
        >
          <h3>목표값 설정 (관리자)</h3>
          <div className="kpi-target-fields">
            {targetKeys.map((key) => (
              <label key={key}>
                {targetLabels[key]}
                <input
                  name={key}
                  type="number"
                  min={0}
                  defaultValue={targets[key] ?? ""}
                  placeholder="미설정"
                />
              </label>
            ))}
          </div>
          <button className="primary" disabled={busy}>
            목표 저장
          </button>
        </form>
      )}
    </section>
  );
}
