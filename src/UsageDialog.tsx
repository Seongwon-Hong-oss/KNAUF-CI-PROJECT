import { useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import type { Place } from "./data";

export default function UsageDialog({
  place,
  busy,
  onClose,
  onSubmit,
}: {
  place: Place;
  busy: boolean;
  onClose: () => void;
  onSubmit: (actual: number | null, usual: number | null) => void;
}) {
  const [actual, setActual] = useState("");
  const [usual, setUsual] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const toNumber = (value: string) =>
      value.trim() === "" ? null : Math.max(0, Math.round(Number(value)));
    const actualFee = toNumber(actual);
    const usualFee = toNumber(usual);
    onSubmit(
      actualFee !== null && Number.isFinite(actualFee) ? actualFee : null,
      usualFee !== null && Number.isFinite(usualFee) ? usualFee : null,
    );
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="modal modal-small"
        role="dialog"
        aria-modal="true"
        aria-labelledby="usage-title"
      >
        <div className="modal-heading">
          <h2 id="usage-title">이용했어요</h2>
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
          <strong>{place.name}</strong>을(를) 이용하셨다면 기록해 주세요. 금액은
          선택 입력이며, 둘 다 입력하면 절감액이 계산됩니다.
        </p>
        <form onSubmit={submit}>
          <label>
            실제 낸 주차비 (원)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={1000000}
              value={actual}
              onChange={(event) => setActual(event.target.value)}
              placeholder="예: 0 (무료였다면 0)"
              autoFocus
            />
          </label>
          <label>
            평소 이 근처에서 내던 주차비 (원)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={1000000}
              value={usual}
              onChange={(event) => setUsual(event.target.value)}
              placeholder="예: 6000"
            />
          </label>
          <div className="form-footer">
            <span>
              {actual !== "" && usual !== ""
                ? `절감액 ${Math.max(0, Number(usual) - Number(actual)).toLocaleString("ko-KR")}원`
                : "금액 없이도 기록할 수 있습니다"}
            </span>
            <button className="primary" disabled={busy}>
              {busy ? "저장 중..." : "기록하기"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
