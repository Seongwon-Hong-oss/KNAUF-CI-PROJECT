type LatLng = { getLat(): number; getLng(): number };
type MapEvent = { latLng: LatLng };

export type KakaoMapObject = {
  setCenter(center: LatLng): void;
  getLevel(): number;
  setLevel(level: number, options?: { animate?: boolean }): void;
  relayout(): void;
  panBy(dx: number, dy: number): void;
  addControl(control: unknown, position: unknown): void;
};
export type KakaoOverlay = { setMap(map: KakaoMapObject | null): void };

type ServiceStatus = string;
type AddressResult = {
  x: string;
  y: string;
};
type CoordResult = {
  address?: { address_name: string };
  road_address?: { address_name: string } | null;
};
type PlaceResult = {
  x: string;
  y: string;
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  category_name?: string;
  category_group_code?: string;
};

export type KakaoNamespace = {
  maps: {
    load(callback: () => void): void;
    LatLng: new (lat: number, lng: number) => LatLng;
    Map: new (
      container: HTMLElement,
      options: { center: LatLng; level: number },
    ) => KakaoMapObject;
    CustomOverlay: new (options: {
      position: LatLng;
      content: HTMLElement;
      xAnchor?: number;
      yAnchor?: number;
      zIndex?: number;
      clickable?: boolean;
      map?: KakaoMapObject;
    }) => KakaoOverlay;
    ZoomControl: new () => unknown;
    ControlPosition: { BOTTOMRIGHT: unknown };
    event: {
      addListener(
        target: unknown,
        type: string,
        handler: (event: MapEvent) => void,
      ): void;
      removeListener(
        target: unknown,
        type: string,
        handler: (event: MapEvent) => void,
      ): void;
    };
    services: {
      Status: { OK: ServiceStatus };
      Geocoder: new () => {
        addressSearch(
          query: string,
          callback: (result: AddressResult[], status: ServiceStatus) => void,
        ): void;
        coord2Address(
          lng: number,
          lat: number,
          callback: (result: CoordResult[], status: ServiceStatus) => void,
        ): void;
      };
      Places: new () => {
        keywordSearch(
          keyword: string,
          callback: (result: PlaceResult[], status: ServiceStatus) => void,
          options?: { size?: number },
        ): void;
      };
    };
  };
};

declare global {
  interface Window {
    kakao?: KakaoNamespace;
  }
}

let loading: Promise<KakaoNamespace> | null = null;

export function loadKakao(): Promise<KakaoNamespace> {
  if (loading) return loading;
  const key = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
  loading = new Promise<KakaoNamespace>((resolve, reject) => {
    if (!key) {
      reject(new Error("missing-key"));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      const kakao = window.kakao;
      if (!kakao) reject(new Error("load-failed"));
      else kakao.maps.load(() => resolve(kakao));
    };
    script.onerror = () => reject(new Error("load-failed"));
    document.head.appendChild(script);
  });
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

// 좌표 → 도로명 주소(없으면 지번 주소). 실패하면 빈 문자열.
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const kakao = await loadKakao();
    if (signal?.aborted) return "";
    return await new Promise<string>((resolve) => {
      new kakao.maps.services.Geocoder().coord2Address(
        lng,
        lat,
        (result, status) => {
          const first = result[0];
          if (status !== kakao.maps.services.Status.OK || !first) resolve("");
          else
            resolve(
              first.road_address?.address_name ??
                first.address?.address_name ??
                "",
            );
        },
      );
    });
  } catch {
    return "";
  }
}

// 주소(또는 건물명) → 좌표. 찾지 못하면 null.
export async function forwardGeocode(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const kakao = await loadKakao();
    const { Geocoder, Places, Status } = kakao.maps.services;
    const byAddress = await new Promise<AddressResult | null>((resolve) => {
      new Geocoder().addressSearch(query, (result, status) =>
        resolve(status === Status.OK && result[0] ? result[0] : null),
      );
    });
    const found =
      byAddress ??
      (await new Promise<PlaceResult | null>((resolve) => {
        new Places().keywordSearch(query, (result, status) =>
          resolve(status === Status.OK && result[0] ? result[0] : null),
        );
      }));
    if (!found) return null;
    const lat = Number(found.y);
    const lng = Number(found.x);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

export type PlaceSuggestion = {
  name: string;
  address: string;
  detail: string;
  lat: number;
  lng: number;
  category?: "restaurant" | "parking";
};

// 상호명·건물명 검색(예: 스타벅스 강남점). PK6=주차장, FD6=음식점, CE7=카페.
export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  try {
    const kakao = await loadKakao();
    const { Places, Status } = kakao.maps.services;
    const results = await new Promise<PlaceResult[]>((resolve) => {
      new Places().keywordSearch(
        query,
        (result, status) => resolve(status === Status.OK ? result : []),
        { size: 8 },
      );
    });
    return results.flatMap((item) => {
      const lat = Number(item.y);
      const lng = Number(item.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !item.place_name)
        return [];
      const code = item.category_group_code;
      return [
        {
          name: item.place_name,
          address: item.road_address_name || item.address_name || "",
          detail: item.category_name?.split(" > ").pop() ?? "",
          lat,
          lng,
          ...(code === "PK6"
            ? { category: "parking" as const }
            : code === "FD6" || code === "CE7"
              ? { category: "restaurant" as const }
              : {}),
        },
      ];
    });
  } catch {
    return [];
  }
}
