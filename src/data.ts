import { createClient } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  name: string;
  department: string;
  account?: string | null;
  approved: boolean;
  role: "admin" | "member";
  avatar_path?: string | null;
  created_at: string;
};
export type Place = {
  id: string;
  name: string;
  category: "restaurant" | "parking";
  address: string;
  note: string;
  price: string;
  hourly_rate?: number | null;
  parking_free?: boolean | null;
  fee_per_30min?: number | null;
  free_minutes?: number | null;
  photo_path?: string | null;
  lat: number;
  lng: number;
  author_id: string;
  created_at: string;
};
export type Comment = {
  id: string;
  place_id: string;
  author_id: string;
  body: string;
  created_at: string;
};
export type Like = { place_id: string; author_id: string };

export function rankings(places: Place[], profiles: Profile[], likes: Like[]) {
  const likeCount = new Map<string, number>();
  for (const like of likes)
    likeCount.set(like.place_id, (likeCount.get(like.place_id) ?? 0) + 1);
  const placeOwner = new Map(
    places.map((place) => [place.id, place.author_id]),
  );
  const receivedByAuthor = new Map<string, number>();
  for (const like of likes) {
    const owner = placeOwner.get(like.place_id);
    if (owner)
      receivedByAuthor.set(owner, (receivedByAuthor.get(owner) ?? 0) + 1);
  }
  const newest = (first: Place, second: Place) =>
    second.created_at.localeCompare(first.created_at);
  const likedPlaces = places
    .map((place) => ({ place, value: likeCount.get(place.id) ?? 0 }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || newest(a.place, b.place))
    .slice(0, 3);
  const likedPeople = profiles
    .map((person) => ({
      name: person.name,
      sub: person.department,
      value: receivedByAuthor.get(person.id) ?? 0,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  const registrants = profiles
    .map((person) => ({
      name: person.name,
      sub: person.department,
      value: places.filter((place) => place.author_id === person.id).length,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  return { likedPlaces, likedPeople, registrants };
}
export function createLocalComment(
  data: Omit<Comment, "id" | "created_at">,
): Comment {
  return {
    ...data,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
}
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export const seedProfiles: Profile[] = [
  {
    id: "demo-1",
    name: "Admin",
    department: "Seoul office",
    account: "Admin",
    role: "admin",
    approved: true,
    created_at: "2026-10-01T09:00:00Z",
  },
  {
    id: "demo-2",
    name: "박준호",
    department: "Ulsan Plant",
    role: "member",
    approved: true,
    created_at: "2026-10-02T09:00:00Z",
  },
  {
    id: "demo-3",
    name: "이서연",
    department: "Dangjin Plant",
    role: "member",
    approved: true,
    created_at: "2026-10-03T09:00:00Z",
  },
  {
    id: "demo-4",
    name: "최지우",
    department: "Yosu Plant",
    role: "member",
    approved: true,
    created_at: "2026-10-04T09:00:00Z",
  },
];
export const seedPlaces: Place[] = [
  {
    id: "sample-1",
    name: "정동 골목식당",
    category: "restaurant",
    address: "서울 중구 정동길 · 예시 장소",
    note: "점심 정식 제공. 평일 11:30~14:00 이용 가능.",
    price: "점심 정식 12,000원 · 예시",
    lat: 37.5668,
    lng: 126.9725,
    author_id: "demo-1",
    created_at: "2026-11-01T05:00:00Z",
  },
  {
    id: "sample-2",
    name: "시청 근처 공영주차장",
    category: "parking",
    address: "서울 중구 세종대로 · 예시 장소",
    note: "외근 시 이용. 평일 점심시간에는 만차 가능성이 있음.",
    price: "30분 2,000원 · 예시",
    lat: 37.5681,
    lng: 126.9789,
    author_id: "demo-2",
    created_at: "2026-10-31T06:00:00Z",
  },
  {
    id: "sample-3",
    name: "소공동 면옥",
    category: "restaurant",
    address: "서울 중구 소공로 · 예시 장소",
    note: "냉면과 만두 제공. 점심 시간 대기 가능성 있음.",
    price: "냉면 11,000원 · 예시",
    lat: 37.5628,
    lng: 126.9805,
    author_id: "demo-3",
    created_at: "2026-10-30T06:00:00Z",
  },
  {
    id: "sample-4",
    name: "광화문 지하주차장",
    category: "parking",
    address: "서울 종로구 새문안로 · 예시 장소",
    note: "지하 주차 공간. 차량 높이 제한 확인 필요.",
    price: "시간당 4,000원 · 예시",
    lat: 37.5705,
    lng: 126.9748,
    author_id: "demo-2",
    created_at: "2026-10-29T06:00:00Z",
  },
  {
    id: "sample-5",
    name: "을지로 작은 밥집",
    category: "restaurant",
    address: "서울 중구 을지로 · 예시 장소",
    note: "백반 제공. 메뉴는 요일별로 변경.",
    price: "백반 10,000원 · 예시",
    lat: 37.5661,
    lng: 126.9857,
    author_id: "demo-1",
    created_at: "2026-10-28T06:00:00Z",
  },
];
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem(`team-map-${key}`) ?? "null");
    return Array.isArray(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}
export function statistics(places: Place[], profiles: Profile[]) {
  const employees = profiles
    .map((person) => {
      const own = places.filter((place) => place.author_id === person.id);
      return {
        ...person,
        total: own.length,
        restaurants: own.filter((place) => place.category === "restaurant")
          .length,
        parking: own.filter((place) => place.category === "parking").length,
        share: places.length
          ? Math.round((own.length / places.length) * 100)
          : 0,
      };
    })
    .sort((first, second) => second.total - first.total);
  const approved = employees.filter((person) => person.approved);
  return {
    employees,
    participation: approved.length
      ? Math.round(
          (approved.filter((person) => person.total > 0).length /
            approved.length) *
            100,
        )
      : 0,
  };
}

export const offices = [
  "Seoul office",
  "Busan office",
  "Gwangju office",
  "Daejeon office",
  "Daegu office",
  "Ulsan Plant",
  "Dangjin Plant",
  "Yosu Plant",
] as const;
export type Office = (typeof offices)[number];

// Supabase는 이메일 형식 로그인만 지원하므로 계정 ID를 내부용 주소로 변환한다.
export function normalizeAccount(account: string) {
  return account.trim().normalize("NFC").toLowerCase();
}
export function validateAccount(account: string) {
  const value = account.trim();
  if (value.length < 2 || value.length > 20 || /\s/.test(value))
    return "계정은 공백 없이 2~20자로 입력해 주세요.";
  return null;
}
const accountDomain = import.meta.env.VITE_ACCOUNT_DOMAIN || "ci-project.app";
export function accountToEmail(account: string) {
  return `u${sha256Hex(normalizeAccount(account)).slice(0, 32)}@${accountDomain}`;
}

function sha256Hex(text: string) {
  const bytes = [...new TextEncoder().encode(text)];
  const words: number[] = [];
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8)
    bytes.push(Math.floor(bitLength / 2 ** shift) & 0xff);
  for (let index = 0; index < bytes.length; index += 4)
    words.push(
      (bytes[index] << 24) |
        (bytes[index + 1] << 16) |
        (bytes[index + 2] << 8) |
        bytes[index + 3],
    );
  const constants = Array.from({ length: 64 }, (_, index) => {
    let candidate = 2;
    for (let found = 0; ; candidate++) {
      let prime = true;
      for (let divisor = 2; divisor * divisor <= candidate; divisor++)
        if (candidate % divisor === 0) prime = false;
      if (prime && found++ === index)
        return Math.floor((candidate ** (1 / 3) % 1) * 2 ** 32) >>> 0;
    }
  });
  const state = [2, 3, 5, 7, 11, 13, 17, 19].map(
    (prime) => Math.floor((Math.sqrt(prime) % 1) * 2 ** 32) >>> 0,
  );
  const rotate = (value: number, count: number) =>
    (value >>> count) | (value << (32 - count));
  for (let offset = 0; offset < words.length; offset += 16) {
    const schedule = words.slice(offset, offset + 16);
    for (let index = 16; index < 64; index++) {
      const s0 =
        rotate(schedule[index - 15], 7) ^
        rotate(schedule[index - 15], 18) ^
        (schedule[index - 15] >>> 3);
      const s1 =
        rotate(schedule[index - 2], 17) ^
        rotate(schedule[index - 2], 19) ^
        (schedule[index - 2] >>> 10);
      schedule[index] =
        (schedule[index - 16] + s0 + schedule[index - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index++) {
      const sum1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 =
        (h + sum1 + choice + constants[index] + schedule[index]) | 0;
      const sum0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) | 0;
      [h, g, f, e, d, c, b, a] = [
        g,
        f,
        e,
        (d + temp1) | 0,
        c,
        b,
        a,
        (temp1 + temp2) | 0,
      ];
    }
    [a, b, c, d, e, f, g, h].forEach((value, index) => {
      state[index] = (state[index] + value) | 0;
    });
  }
  return state
    .map((value) => (value >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

// 로컬 미리보기 전용 계정. 운영에서는 Supabase 인증을 사용한다.
const demoAdmin = { account: "Admin", password: "1234567890" };
type DemoAccount = { profile_id: string; account: string; hash: string };

async function loadDemoAccounts() {
  const accounts = readLocal<DemoAccount[]>("demo-accounts", []);
  if (
    !accounts.some(
      (item) => item.account === normalizeAccount(demoAdmin.account),
    )
  ) {
    accounts.unshift({
      profile_id: "demo-1",
      account: normalizeAccount(demoAdmin.account),
      hash: sha256Hex(
        `${demoAdmin.account.toLowerCase()}:${demoAdmin.password}`,
      ),
    });
    localStorage.setItem("team-map-demo-accounts", JSON.stringify(accounts));
  }
  return accounts;
}

export async function demoSignIn(account: string, password: string) {
  const accounts = await loadDemoAccounts();
  const normalized = normalizeAccount(account);
  const hash = sha256Hex(`${normalized}:${password}`);
  const found = accounts.find(
    (item) => item.account === normalized && item.hash === hash,
  );
  if (!found) throw new Error("계정 또는 비밀번호가 올바르지 않습니다.");
  return found.profile_id;
}

export async function demoRegister(
  account: string,
  password: string,
  name: string,
  department: string,
): Promise<Profile> {
  const accounts = await loadDemoAccounts();
  const normalized = normalizeAccount(account);
  if (accounts.some((item) => item.account === normalized))
    throw new Error("이미 사용 중인 계정입니다.");
  const profile: Profile = {
    id: crypto.randomUUID(),
    name,
    department,
    account: account.trim(),
    approved: true,
    role: "member",
    created_at: new Date().toISOString(),
  };
  accounts.push({
    profile_id: profile.id,
    account: normalized,
    hash: sha256Hex(`${normalized}:${password}`),
  });
  localStorage.setItem("team-map-demo-accounts", JSON.stringify(accounts));
  return profile;
}
