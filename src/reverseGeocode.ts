type NominatimResult = {
  display_name?: string;
  address?: Record<string, string>;
};

// 좌표로 한국어 도로명 주소를 조회한다. 실패하면 빈 문자열을 반환한다.
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string> {
  const url = new URL(
    import.meta.env.VITE_REVERSE_GEOCODER_URL ||
      "https://nominatim.openstreetmap.org/reverse",
  );
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "ko");
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return "";
    const data = (await response.json()) as NominatimResult;
    const a = data.address ?? {};
    const parts = [
      a.state ?? a.province,
      a.city !== a.state ? a.city : undefined,
      a.county,
      a.borough ?? a.city_district,
      a.road ?? a.suburb ?? a.neighbourhood,
      a.house_number,
    ]
      .filter(Boolean)
      .filter((part, index, all) => all.indexOf(part) === index);
    if (a.road && parts.length >= 2) return parts.join(" ");
    return (data.display_name ?? parts.join(" "))
      .split(", ")
      .reverse()
      .join(" ")
      .slice(0, 200);
  } catch {
    return "";
  }
}
