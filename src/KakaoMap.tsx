import { useEffect, useRef, useState } from "react";
import { loadKakao } from "./kakao";
import type { KakaoMapObject, KakaoNamespace } from "./kakao";
import knaufLogo from "./assets/knauf-logo.png";

export type MapPinData = {
  id: string;
  kind: "restaurant" | "parking" | "landmark" | "draft" | "pending";
  lat: number;
  lng: number;
  label?: string;
  onClick?: () => void;
};

type Props = {
  pins: MapPinData[];
  center: [number, number];
  target: [number, number] | null;
  picking: boolean;
  onPick: (lat: number, lng: number) => void;
};

const restaurantSvg =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>';

function pinElement(pin: MapPinData): HTMLElement {
  const wrap = document.createElement("div");
  if (pin.kind === "landmark") {
    wrap.className = "landmark-wrap";
    const card = document.createElement("div");
    card.className = "landmark-pin";
    const logo = document.createElement("img");
    logo.src = knaufLogo;
    logo.alt = "";
    const label = document.createElement("span");
    label.textContent = pin.label ?? "";
    card.append(logo, label);
    wrap.append(card);
    return wrap;
  }
  wrap.className = `k-pin ${pin.kind}`;
  const dot = document.createElement("div");
  if (pin.kind === "restaurant") {
    dot.className = "map-pin restaurant-pin";
    dot.innerHTML = restaurantSvg;
  } else if (pin.kind === "parking") {
    dot.className = "map-pin parking-pin";
    dot.textContent = "P";
  } else {
    dot.className = `map-pin draft-pin${pin.kind === "pending" ? " pin-drop" : ""}`;
    dot.textContent = "+";
  }
  wrap.append(dot);
  if (pin.onClick) {
    wrap.title = pin.label ?? "";
    wrap.setAttribute("role", "button");
  }
  return wrap;
}

const zIndexByKind: Record<MapPinData["kind"], number> = {
  landmark: 1,
  restaurant: 2,
  parking: 2,
  draft: 3,
  pending: 4,
};

export default function KakaoMap({
  pins,
  center,
  target,
  picking,
  onPick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const kakaoRef = useRef<KakaoNamespace | null>(null);
  const [map, setMap] = useState<KakaoMapObject | null>(null);
  const [error, setError] = useState("");
  const latest = useRef({ pins, picking, onPick });
  useEffect(() => {
    latest.current = { pins, picking, onPick };
  });

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    loadKakao()
      .then((kakao) => {
        if (cancelled) return;
        kakaoRef.current = kakao;
        const created = new kakao.maps.Map(container, {
          center: new kakao.maps.LatLng(center[0], center[1]),
          level: 4,
        });
        if (!window.matchMedia("(max-width: 700px)").matches)
          created.addControl(
            new kakao.maps.ZoomControl(),
            kakao.maps.ControlPosition.BOTTOMRIGHT,
          );
        kakao.maps.event.addListener(created, "click", (event) => {
          if (latest.current.picking)
            latest.current.onPick(event.latLng.getLat(), event.latLng.getLng());
        });
        setMap(created);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error && reason.message === "missing-key"
            ? "카카오 지도 키가 설정되지 않았습니다. (VITE_KAKAO_JS_KEY)"
            : "카카오 지도를 불러오지 못했습니다. 네트워크와 등록된 도메인을 확인해 주세요.",
        );
      });
    return () => {
      cancelled = true;
    };
    // 지도는 한 번만 만든다. 이후 중심 이동은 아래 effect가 처리한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const kakao = kakaoRef.current;
    const container = containerRef.current;
    if (!map || !kakao || !container) return;
    // 레이아웃이 잡히는 동안 크기가 바뀔 때마다 기본 위치를 중앙에 다시 맞춘다.
    let active = true;
    const recenter = () => {
      if (!active) return;
      map.relayout();
      map.setCenter(new kakao.maps.LatLng(center[0], center[1]));
    };
    const observer = new ResizeObserver(recenter);
    observer.observe(container);
    const stop = () => {
      active = false;
      observer.disconnect();
    };
    const timer = setTimeout(stop, 1500);
    container.addEventListener("pointerdown", stop, { once: true });
    recenter();
    return () => {
      clearTimeout(timer);
      stop();
      container.removeEventListener("pointerdown", stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const pinsKey = pins
    .map(
      (pin) => `${pin.id}|${pin.kind}|${pin.lat}|${pin.lng}|${pin.label ?? ""}`,
    )
    .join(";");
  useEffect(() => {
    const kakao = kakaoRef.current;
    if (!map || !kakao) return;
    const overlays = latest.current.pins.map((pin) => {
      const content = pinElement(pin);
      const interactive = pin.kind !== "landmark" && !!pin.onClick;
      if (interactive)
        content.addEventListener("click", () => {
          latest.current.pins.find((item) => item.id === pin.id)?.onClick?.();
        });
      return new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(pin.lat, pin.lng),
        content,
        xAnchor: 0.5,
        yAnchor: 1,
        zIndex: zIndexByKind[pin.kind],
        clickable: interactive,
        map,
      });
    });
    return () => {
      for (const overlay of overlays) overlay.setMap(null);
    };
    // pinsKey가 바뀔 때만 다시 그린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pinsKey]);

  useEffect(() => {
    const kakao = kakaoRef.current;
    if (!map || !kakao || !target) return;
    map.setLevel(3);
    map.setCenter(new kakao.maps.LatLng(target[0], target[1]));
    // 모바일은 하단 시트에 가려지지 않도록 핀을 화면 위쪽에 둔다.
    if (window.matchMedia("(max-width: 700px)").matches) {
      const height = containerRef.current?.clientHeight ?? 0;
      map.panBy(0, height * 0.2);
    }
  }, [map, target]);

  return (
    <>
      <div ref={containerRef} className="kmap" />
      {error && (
        <div className="map-error" role="status">
          {error}
        </div>
      )}
    </>
  );
}
