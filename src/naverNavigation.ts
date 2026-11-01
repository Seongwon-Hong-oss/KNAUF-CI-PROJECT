const NAVER_MAP_STORE_IOS = "https://apps.apple.com/app/id311867728";

type NaverPlace = {
  name: string;
  lat: number;
  lng: number;
  address?: string;
};

// 주소가 있으면 주소로, 없을 때만 장소 이름으로 검색한다.
function searchText(place: NaverPlace) {
  return place.address?.trim() || place.name;
}

export function naverSearchUrl(place: NaverPlace) {
  return `https://map.naver.com/p/search/${encodeURIComponent(searchText(place))}`;
}

// 네이버 지도 앱의 내비게이션 URL Scheme으로 길안내를 열어. 앱이 없으면 스토어로 이동한다.
export function openNaverNavigation(place: NaverPlace): "app" | "web" {
  const query = Object.entries({
    dlat: String(place.lat),
    dlng: String(place.lng),
    dname: searchText(place),
    appname: window.location.hostname || "team-map",
  })
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  const agent = navigator.userAgent;
  if (/Android/i.test(agent)) {
    window.location.href = `intent://navigation?${query}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`;
    return "app";
  }
  const iPadOS = /Macintosh/i.test(agent) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(agent) || iPadOS) {
    window.location.href = `nmap://navigation?${query}`;
    setTimeout(() => {
      if (!document.hidden) window.location.href = NAVER_MAP_STORE_IOS;
    }, 1500);
    return "app";
  }
  window.open(naverSearchUrl(place), "_blank", "noopener,noreferrer");
  return "web";
}
