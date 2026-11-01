import { useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import type { SurveyPhase } from "./kpi";

export default function SurveyDialog({
  phase,
  busy,
  initial,
  onSubmit,
  onClose,
}: {
  phase: SurveyPhase;
  busy: boolean;
  initial?: number;
  onSubmit: (fee: number) => void;
  onClose: () => void;
}) {
  const [fee, setFee] = useState(initial === undefined ? "" : String(initial));
  const baseline = phase === "baseline";

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = Math.round(Number(fee));
    if (fee.trim() === "" || !Number.isFinite(value) || value < 0) return;
    onSubmit(value);
  }

  return (
    <div className="modal-backdrop">
      <section
        className="modal modal-small"
        role="dialog"
        aria-modal="true"
        aria-labelledby="survey-title"
      >
        <div className="modal-heading">
          <h2 id="survey-title">
            {baseline ? "주차비 현황 설문" : "도입 후 주차비 설문"}
          </h2>
          <button
            className="icon-button"
            aria-label="닫기"
            disabled={busy}
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <p className="dialog-lead">
          {baseline
            ? "주차비 절감 효과를 측정하기 위한 1회 질문입니다. 개인 응답은 다른 멤버에게 보이지 않고, 3명 이상 응답했을 때 평균만 대시보드에 표시됩니다."
            : "앱을 사용한 이후의 월평균 주차비를 입력해 주세요. 도입 전 응답과 비교해 평균만 표시됩니다."}
        </p>
        <form onSubmit={submit}>
          <label>
            {baseline
              ? "업무 중 한 달 평균 주차비 (원)"
              : "최근 한 달 평균 주차비 (원)"}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={10000000}
              required
              value={fee}
              onChange={(event) => setFee(event.target.value)}
              placeholder="예: 120000"
              autoFocus
            />
          </label>
          <div className="form-footer">
            <span>대략적인 금액이어도 괜찮습니다</span>
            <button className="primary" disabled={busy}>
              {busy ? "저장 중..." : "제출"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
