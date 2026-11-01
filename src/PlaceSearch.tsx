import { useEffect, useRef, useState } from "react";
import { Search, MapPin, LoaderCircle } from "lucide-react";
import { searchPlaces } from "./kakao";
import type { PlaceSuggestion } from "./kakao";

export default function PlaceSearch({
  onSelect,
}: {
  onSelect: (place: PlaceSuggestion) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version = useRef(0);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      version.current += 1;
    };
  }, []);

  function run(text: string) {
    const current = ++version.current;
    setLoading(true);
    setStatus("");
    void searchPlaces(text).then((found) => {
      if (current !== version.current) return;
      setLoading(false);
      setResults(found);
      if (!found.length)
        setStatus(
          "검색 결과가 없습니다. 지역명을 함께 입력하거나 주소로 입력해 주세요.",
        );
    });
  }

  function change(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    const text = value.trim();
    version.current += 1;
    if (text.length < 2) {
      setResults([]);
      setStatus("");
      setLoading(false);
      return;
    }
    timer.current = setTimeout(() => run(text), 500);
  }

  function submit() {
    const text = query.trim();
    if (text.length < 2) {
      setStatus("상호명이나 지역을 2글자 이상 입력해 주세요.");
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    run(text);
  }

  return (
    <div className="place-search">
      <label htmlFor="business-search">장소 검색</label>
      <div className="business-search-box">
        <Search size={17} />
        <input
          id="business-search"
          value={query}
          maxLength={120}
          autoFocus
          autoComplete="off"
          placeholder="예: 스타벅스 강남점"
          onChange={(event) => change(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" className="primary" onClick={submit}>
          {loading ? <LoaderCircle size={15} className="spin" /> : "검색"}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="business-results">
          {results.map((place, index) => (
            <li key={`${place.lat},${place.lng},${index}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(place);
                  setResults([]);
                  setQuery(place.name);
                  setStatus("");
                }}
              >
                <MapPin size={16} />
                <span>
                  <strong>{place.name}</strong>
                  <small>
                    {place.detail ? `${place.detail} · ` : ""}
                    {place.address}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {status && <p className="search-status">{status}</p>}
    </div>
  );
}
