import { useEffect, useRef, useState } from "react";
import { Search, MapPin, LoaderCircle } from "lucide-react";

export type SearchPlace = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: "parking" | "restaurant";
};
type Feature = {
  geometry?: { coordinates?: number[] };
  properties?: Record<string, string | number>;
};

export default function PlaceSearch({
  onSelect,
}: {
  onSelect: (place: SearchPlace) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const request = useRef<AbortController | null>(null);
  const lastSearch = useRef(0);
  useEffect(() => {
    const abort = () => {
      request.current?.abort();
      request.current = null;
    };
    return abort;
  }, []);

  async function searchPlaces() {
    const text = query.trim();
    if (text.length < 2) {
      setStatus("상호명이나 지역을 2글자 이상 입력해 주세요.");
      return;
    }
    if (loading) return;
    if (Date.now() - lastSearch.current < 1500) {
      setStatus("잠시 후 다시 검색해 주세요.");
      return;
    }
    lastSearch.current = Date.now();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    setResults([]);
    setStatus("");
    try {
      const url = new URL(
        import.meta.env.VITE_GEOCODER_URL || "https://photon.komoot.io/api/",
      );
      url.searchParams.set("q", text);
      url.searchParams.set("limit", "6");
      url.searchParams.set("lat", "37.5665");
      url.searchParams.set("lon", "126.978");
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok)
        throw new Error(
          "검색 서버에 연결하지 못했습니다. 잠시 후 다시 검색해 주세요.",
        );
      const data = (await response.json()) as { features?: Feature[] };
      if (!Array.isArray(data.features))
        throw new Error("검색 결과를 읽지 못했습니다.");
      const places = data.features.flatMap((feature) => {
        const coordinates = feature.geometry?.coordinates;
        const props = feature.properties ?? {};
        if (
          !coordinates ||
          !Number.isFinite(coordinates[0]) ||
          !Number.isFinite(coordinates[1]) ||
          Math.abs(coordinates[0]) > 180 ||
          Math.abs(coordinates[1]) > 90
        )
          return [];
        const name = String(props.name ?? props.street ?? "이름 없는 장소");
        const address =
          [
            props.country,
            props.state,
            props.city,
            props.district,
            props.street,
            props.housenumber,
          ]
            .filter(Boolean)
            .map(String)
            .filter((part, index, all) => all.indexOf(part) === index)
            .join(" ") || name;
        return [
          {
            name,
            address,
            lat: coordinates[1],
            lng: coordinates[0],
            ...(props.osm_value === "parking"
              ? { category: "parking" as const }
              : {}),
          },
        ];
      });
      if (controller.signal.aborted) return;
      setResults(places);
      if (!places.length)
        setStatus(
          "검색 결과가 없습니다. 지역명을 함께 입력하거나 지도에서 위치를 선택해 주세요.",
        );
    } catch (error) {
      if (request.current === controller)
        setStatus(
          controller.signal.aborted
            ? "검색이 취소되었거나 응답 시간이 초과됐습니다."
            : error instanceof Error
              ? error.message
              : "검색하지 못했습니다.",
        );
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) setLoading(false);
    }
  }

  return (
    <div className="place-search">
      <label htmlFor="business-search">상호명 검색</label>
      <div className="business-search-box">
        <Search size={17} />
        <input
          id="business-search"
          value={query}
          maxLength={120}
          autoFocus
          placeholder="예: 서울 을지로 냉면"
          onChange={(event) => {
            request.current?.abort();
            request.current = null;
            setLoading(false);
            setQuery(event.target.value);
            setResults([]);
            setStatus("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void searchPlaces();
            }
          }}
        />
        <button
          type="button"
          className="primary"
          disabled={loading}
          onClick={() => void searchPlaces()}
        >
          {loading ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Search size={16} />
          )}
          검색
        </button>
      </div>
      {status && (
        <p className="search-status" role="status">
          {status}
        </p>
      )}
      {results.length > 0 && (
        <ul className="business-results" aria-label="상호 검색 결과">
          {results.map((place, index) => (
            <li key={`${place.lat}-${place.lng}-${index}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(place);
                  setResults([]);
                  setStatus("장소를 선택했습니다.");
                }}
              >
                <MapPin size={17} />
                <span>
                  <strong>{place.name}</strong>
                  <small>{place.address}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <a
        className="search-attribution"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
      >
        검색 데이터 © OpenStreetMap · Photon
      </a>
    </div>
  );
}
