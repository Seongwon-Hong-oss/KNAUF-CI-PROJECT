import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { divIcon } from "leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
  MapPin,
  Utensils,
  ParkingSquare,
  Search,
  Plus,
  X,
  ArrowUpRight,
  Bookmark,
  LocateFixed,
  Users,
  Map,
  LogOut,
  SlidersHorizontal,
  Trash2,
  Pencil,
  Send,
  RefreshCw,
  ChevronRight,
  Heart,
  Navigation,
} from "lucide-react";
import {
  supabase,
  seedPlaces,
  seedProfiles,
  readLocal,
  statistics,
  createLocalComment,
  rankings,
  demoSignIn,
  demoRegister,
  accountToEmail,
  validateAccount,
  offices,
} from "./data";
import type { Office } from "./data";
import type { Place, Profile, Comment, Like } from "./data";
import { naverSearchUrl, openNaverNavigation } from "./naverNavigation";
import knaufLogo from "./assets/knauf-logo.png";
import { reverseGeocode } from "./reverseGeocode";
import Login from "./Login";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./App.css";

setWorkerUrl(workerUrl);

function SimpleBasemap({ onError }: { onError: () => void }) {
  const map = useMap();
  const reportError = useEffectEvent(onError);
  useEffect(() => {
    const layer = maplibreGL({
      style: "https://tiles.openfreemap.org/styles/positron",
    });
    try {
      layer.addTo(map);
      layer.getMaplibreMap().on("error", reportError);
    } catch {
      if (map.hasLayer(layer)) map.removeLayer(layer);
      reportError();
    }
    return () => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    };
  }, [map]);
  return null;
}

const restaurantIcon = divIcon({
  className: "pin-wrap",
  html: '<div class="map-pin restaurant-pin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></div>',
  iconSize: [38, 46],
  iconAnchor: [19, 44],
});
const parkingIcon = divIcon({
  className: "pin-wrap",
  html: '<div class="map-pin parking-pin">P</div>',
  iconSize: [38, 46],
  iconAnchor: [19, 44],
});
const draftIcon = divIcon({
  className: "pin-wrap",
  html: '<div class="map-pin draft-pin">+</div>',
  iconSize: [38, 46],
  iconAnchor: [19, 44],
});
const pendingIcon = divIcon({
  className: "pin-wrap",
  html: '<div class="map-pin draft-pin pin-drop">+</div>',
  iconSize: [38, 46],
  iconAnchor: [19, 44],
});
const center: [number, number] = [37.5665, 126.978];

function MapActions({
  target,
  picking,
  onPick,
}: {
  target: [number, number] | null;
  picking: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    const zoom = 16;
    // 모바일은 하단 시트에 가려지지 않도록 핀을 화면 위쪽에 둔다.
    const shift = window.matchMedia("(max-width: 700px)").matches
      ? map.getSize().y * 0.2
      : 0;
    const center = map.unproject(
      map.project(target, zoom).add([0, shift]),
      zoom,
    );
    map.flyTo(center, zoom, { duration: 0.7 });
  }, [target, map]);
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(timer);
  }, [map]);
  useMapEvents({
    click: (event) => {
      if (picking) onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function App() {
  const demo = !supabase;
  const requestVersion = useRef(0);
  const [places, setPlaces] = useState<Place[]>(() =>
    demo ? readLocal("places", seedPlaces) : [],
  );
  const [profiles, setProfiles] = useState<Profile[]>(() =>
    demo ? readLocal("profiles", seedProfiles) : [],
  );
  const [profile, setProfile] = useState<Profile | null>(() =>
    demo
      ? (readLocal("profiles", seedProfiles).find(
          (person) => person.id === localStorage.getItem("team-map-profile-id"),
        ) ?? null)
      : null,
  );
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "admin">("map");
  const [filter, setFilter] = useState<
    "all" | "restaurant" | "parking" | "saved"
  >("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<[number, number] | null>(null);
  const [picking, setPicking] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState<"simple" | "standard">("simple");
  const [mapError, setMapError] = useState(false);
  function handleMapError() {
    setMapError(true);
  }
  const [draft, setDraft] = useState<Partial<Place> | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const reverseRequest = useRef<AbortController | null>(null);
  const [pendingPin, setPendingPin] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [pendingAddress, setPendingAddress] = useState("");
  const [pendingLoading, setPendingLoading] = useState(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRequest = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!demo);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState<string[]>(() => readLocal("saved", []));
  const [comments, setComments] = useState<Comment[]>(() =>
    demo ? readLocal("comments", []) : [],
  );
  const [commentText, setCommentText] = useState("");
  const [likes, setLikes] = useState<Like[]>(() =>
    demo ? readLocal("likes", []) : [],
  );
  const currentLikes = likes.filter((like) => like.place_id === selected);
  const liked = currentLikes.some((like) => like.author_id === profile?.id);
  const current = places.find((place) => place.id === selected);
  const allowed = !!profile?.approved;
  const admin = profile?.role === "admin";
  const signedOut = demo ? !profile : !authUser;
  const adminIds = new Set(
    profiles.filter((item) => item.role === "admin").map((item) => item.id),
  );
  const members = profiles.filter((item) => item.role !== "admin");
  const memberPlaces = places.filter((item) => !adminIds.has(item.author_id));
  const stats = statistics(memberPlaces, members);
  const ranks = rankings(memberPlaces, members, likes);
  const visible = places.filter(
    (place) =>
      (filter === "all" ||
        (filter === "saved"
          ? saved.includes(place.id)
          : place.category === filter)) &&
      `${place.name} ${place.address} ${place.note}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  async function refresh(userId = authUser) {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const own = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (version !== requestVersion.current) return;
      if (own.error) throw own.error;
      setProfile(own.data as Profile);
      if (!own.data.approved) {
        setPlaces([]);
        setProfiles([]);
        setComments([]);
        setLikes([]);
        return;
      }
      const results = await Promise.all([
        supabase
          .from("places")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("comments").select("*").order("created_at"),
        supabase.from("likes").select("*"),
      ]);
      if (version !== requestVersion.current) return;
      for (const result of results) if (result.error) throw result.error;
      setPlaces(results[0].data as Place[]);
      setProfiles(results[1].data as Profile[]);
      setComments(results[2].data as Comment[]);
      setLikes(results[3].data as Like[]);
    } catch (error) {
      if (version === requestVersion.current) setNotice(message(error));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    const invalidateRequests = () => {
      requestVersion.current++;
    };
    const apply = (id: string | null) => {
      if (!active) return;
      invalidateRequests();
      setAuthUser(id);
      setView("map");
      setSelected(null);
      setProfile(null);
      setPlaces([]);
      setProfiles([]);
      setComments([]);
      setLikes([]);
      if (id) void refresh(id);
      else setLoading(false);
    };
    void client.auth.getSession().then(({ data, error }) => {
      if (error) setNotice(message(error));
      apply(data.session?.user.id ?? null);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => apply(session?.user.id ?? null), 0);
    });
    return () => {
      active = false;
      invalidateRequests();
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (demo) {
      localStorage.setItem("team-map-places", JSON.stringify(places));
      localStorage.setItem("team-map-profiles", JSON.stringify(profiles));
      localStorage.setItem("team-map-comments", JSON.stringify(comments));
    }
  }, [places, profiles, comments, demo]);
  useEffect(() => {
    localStorage.setItem("team-map-saved", JSON.stringify(saved));
  }, [saved]);
  useEffect(() => {
    if (demo) {
      localStorage.setItem("team-map-likes", JSON.stringify(likes));
      if (profile) localStorage.setItem("team-map-profile-id", profile.id);
      else localStorage.removeItem("team-map-profile-id");
    }
  }, [likes, profile, demo]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!draft && !current) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDraft(null);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [draft, current]);

  function choose(place: Place) {
    setSelected(place.id);
    setTarget([place.lat, place.lng]);
    setCommentText("");
    setListOpen(false);
  }
  function stopPreviewRequest() {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingRequest.current?.abort();
  }
  // 지도에 임시 핀만 꽂고, 확인 버튼을 눌러야 등록 화면으로 넘어간다.
  function previewPin(lat: number, lng: number) {
    const pin = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    stopPreviewRequest();
    setPendingPin(pin);
    setPendingAddress("");
    setPendingLoading(true);
    const controller = new AbortController();
    pendingRequest.current = controller;
    pendingTimer.current = setTimeout(() => {
      void reverseGeocode(pin.lat, pin.lng, controller.signal).then(
        (address) => {
          if (controller.signal.aborted) return;
          setPendingAddress(address);
          setPendingLoading(false);
        },
      );
    }, 600);
  }
  function clearPreview() {
    stopPreviewRequest();
    setPendingPin(null);
    setPendingAddress("");
    setPendingLoading(false);
  }
  function cancelPicking() {
    clearPreview();
    setPicking(false);
  }
  function startPicking() {
    clearPreview();
    setPicking(true);
  }
  function pinMyLocation() {
    if (!navigator.geolocation) {
      setNotice("이 브라우저에서는 위치를 사용할 수 없습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        previewPin(latitude, longitude);
        setTarget([latitude, longitude]);
      },
      () =>
        setNotice(
          "위치를 확인하지 못했습니다. 브라우저 위치 권한을 확인해 주세요.",
        ),
      { timeout: 10000, enableHighAccuracy: true },
    );
  }
  function confirmPin() {
    if (!pendingPin) return;
    pickLocation(
      pendingPin.lat,
      pendingPin.lng,
      pendingLoading ? undefined : pendingAddress,
    );
    clearPreview();
  }
  function pickLocation(lat: number, lng: number, knownAddress?: string) {
    const pickedLat = Number(lat.toFixed(6));
    const pickedLng = Number(lng.toFixed(6));
    setDraft((previous) => ({
      category: "restaurant",
      ...previous,
      lat: pickedLat,
      lng: pickedLng,
      ...(knownAddress !== undefined ? { address: knownAddress } : {}),
    }));
    setPicking(false);
    reverseRequest.current?.abort();
    if (knownAddress !== undefined) {
      setAddressLoading(false);
      return;
    }
    const controller = new AbortController();
    reverseRequest.current = controller;
    setAddressLoading(true);
    void reverseGeocode(pickedLat, pickedLng, controller.signal).then(
      (address) => {
        if (controller.signal.aborted) return;
        setAddressLoading(false);
        if (!address) return;
        setDraft((previous) =>
          previous && previous.lat === pickedLat && previous.lng === pickedLng
            ? { ...previous, address }
            : previous,
        );
      },
    );
  }
  function startAdd() {
    setSelected(null);
    setListOpen(false);
    cancelPicking();
    setDraft({ category: "restaurant" });
    setView("map");
  }
  function toggleSaved(id: string) {
    setSaved((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  }

  async function savePlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !draft || busy) return;
    const form = new FormData(event.currentTarget);
    const data = {
      name: String(form.get("name")).trim(),
      category: String(form.get("category")) as Place["category"],
      address: String(form.get("address") ?? "").trim(),
      note: String(form.get("note")).trim(),
      price: String(form.get("price")).trim(),
      lat: draft.lat ?? Number.NaN,
      lng: draft.lng ?? Number.NaN,
    };
    if (
      !Number.isFinite(data.lat) ||
      !Number.isFinite(data.lng) ||
      Math.abs(data.lat) > 90 ||
      Math.abs(data.lng) > 180
    ) {
      setNotice("지도에서 위치를 선택해 주세요.");
      return;
    }
    if (!data.name || !data.address || !data.note) {
      setNotice("장소 이름, 주소, 추천 메모를 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      let place: Place;
      if (supabase) {
        const result = draft.id
          ? await supabase
              .from("places")
              .update(data)
              .eq("id", draft.id)
              .select()
              .single()
          : await supabase
              .from("places")
              .insert({ ...data, author_id: profile.id })
              .select()
              .single();
        if (result.error) throw result.error;
        place = result.data as Place;
      } else
        place = {
          ...data,
          id: draft.id ?? crypto.randomUUID(),
          author_id: draft.author_id ?? profile.id,
          created_at: draft.created_at ?? new Date().toISOString(),
        };
      setPlaces((previous) => [
        place,
        ...previous.filter((item) => item.id !== place.id),
      ]);
      setDraft(null);
      setFilter("all");
      setSearch("");
      choose(place);
      setNotice(draft.id ? "장소를 수정했습니다." : "새 장소를 공유했습니다.");
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function deletePlace(place: Place) {
    if (!window.confirm(`'${place.name}' 장소와 댓글을 삭제할까요?`)) return;
    setBusy(true);
    try {
      if (supabase) {
        const { error } = await supabase
          .from("places")
          .delete()
          .eq("id", place.id);
        if (error) throw error;
      }
      setPlaces((previous) => previous.filter((item) => item.id !== place.id));
      setComments((previous) =>
        previous.filter((item) => item.place_id !== place.id),
      );
      setLikes((previous) =>
        previous.filter((item) => item.place_id !== place.id),
      );
      setSelected(null);
      setNotice("장소를 삭제했습니다.");
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function authenticate(
    mode: "login" | "signup",
    form: FormData,
  ): Promise<string | null> {
    const account = String(form.get("account") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    const department = String(form.get("department") ?? "").trim();
    try {
      const invalidAccount = validateAccount(account);
      if (invalidAccount) throw new Error(invalidAccount);
      if (mode === "signup" && !name) throw new Error("이름을 입력해 주세요.");
      if (mode === "signup" && !offices.includes(department as Office))
        throw new Error("사무소를 선택해 주세요.");
      if (mode === "signup" && password.length < 6)
        throw new Error("비밀번호는 6자 이상이어야 합니다.");
      if (supabase) {
        const email = accountToEmail(account);
        if (mode === "signup") {
          const created = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name, department, account } },
          });
          if (created.error) throw created.error;
          if (created.data.session) return null;
        }
        const result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (result.error) throw result.error;
        return null;
      }
      let person: Profile | undefined;
      if (mode === "signup") {
        person = await demoRegister(account, password, name, department);
        setProfiles((previous) => [...previous, person as Profile]);
      } else {
        const id = await demoSignIn(account, password);
        person = profiles.find((item) => item.id === id);
      }
      if (!person) throw new Error("계정 정보를 찾을 수 없습니다.");
      if (!person.approved) throw new Error("이용이 중지된 계정입니다.");
      setProfile(person);
      return null;
    } catch (error) {
      return message(error);
    }
  }

  function logout() {
    setSelected(null);
    setDraft(null);
    cancelPicking();
    setListOpen(false);
    setView("map");
    if (supabase) {
      void supabase.auth.signOut().then(({ error }) => {
        if (error) setNotice(message(error));
      });
    } else setProfile(null);
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();
    if (!profile || !current || !commentText.trim() || busy) return;
    setBusy(true);
    try {
      const data = {
        place_id: current.id,
        author_id: profile.id,
        body: commentText.trim(),
      };
      let comment: Comment;
      if (supabase) {
        const result = await supabase
          .from("comments")
          .insert(data)
          .select()
          .single();
        if (result.error) throw result.error;
        comment = result.data as Comment;
      } else comment = createLocalComment(data);
      setComments((previous) => [...previous, comment]);
      setCommentText("");
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(comment: Comment) {
    if (!profile || comment.author_id !== profile.id || busy) return;
    if (!window.confirm("내 댓글을 삭제할까요?")) return;
    setBusy(true);
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("comments")
          .delete()
          .eq("id", comment.id)
          .eq("author_id", profile.id)
          .select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("댓글을 삭제할 수 없습니다.");
      }
      setComments((previous) =>
        previous.filter((item) => item.id !== comment.id),
      );
      setNotice("댓글을 삭제했습니다.");
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike(place: Place) {
    if (!profile || !allowed || busy) return;
    const mine = likes.some(
      (item) => item.place_id === place.id && item.author_id === profile.id,
    );
    setBusy(true);
    try {
      if (supabase) {
        const result = mine
          ? await supabase
              .from("likes")
              .delete()
              .eq("place_id", place.id)
              .eq("author_id", profile.id)
          : await supabase
              .from("likes")
              .insert({ place_id: place.id, author_id: profile.id });
        if (result.error) throw result.error;
      }
      setLikes((previous) =>
        mine
          ? previous.filter(
              (item) =>
                !(item.place_id === place.id && item.author_id === profile.id),
            )
          : [...previous, { place_id: place.id, author_id: profile.id }],
      );
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function setAccess(person: Profile, approved: boolean) {
    setBusy(true);
    try {
      if (supabase) {
        const { error } = await supabase.rpc("set_employee_approval", {
          employee_id: person.id,
          approval: approved,
        });
        if (error) throw error;
      }
      setProfiles((previous) =>
        previous.map((item) =>
          item.id === person.id ? { ...item, approved } : item,
        ),
      );
      setNotice(
        approved
          ? "멤버의 접근을 재개했습니다."
          : "멤버의 접근을 중지했습니다.",
      );
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`app-shell ${view === "map" && allowed ? "map-mode" : ""}`}>
      {signedOut ? (
        <Login checking={!demo && loading} onSubmit={authenticate} />
      ) : (
        <>
          <header className="header">
            <a className="brand" href="#" onClick={() => setView("map")}>
              <img src={knaufLogo} alt="KNAUF" width="118" height="60" />
              <small>C.I. project</small>
            </a>
            <nav aria-label="주 메뉴">
              <button
                className={view === "map" ? "nav-active" : ""}
                onClick={() => setView("map")}
              >
                <Map size={17} />
                장소 지도
              </button>
              <button
                className={view === "admin" ? "nav-active" : ""}
                onClick={() => setView("admin")}
              >
                <Users size={17} />
                대시보드
              </button>
            </nav>
            <div className="header-right">
              <div className="account">
                <span className="avatar">
                  {profile?.name.slice(0, 1) ?? "?"}
                </span>
                <span>{profile?.name}</span>
              </div>
              <button
                className="icon-button"
                title="로그아웃"
                aria-label="로그아웃"
                onClick={logout}
              >
                <LogOut size={17} />
              </button>
            </div>
          </header>
          {!allowed ? (
            <main className="auth-gate">
              <h1>
                {loading
                  ? "계정을 확인하고 있습니다"
                  : profile
                    ? "이용이 중지된 계정입니다"
                    : "계정 정보를 불러오지 못했습니다"}
              </h1>
              {!loading && (
                <>
                  <p>
                    {profile
                      ? "관리자에게 문의해 주세요."
                      : "네트워크 상태를 확인한 뒤 다시 시도해 주세요."}
                  </p>
                  <button className="primary" onClick={() => void refresh()}>
                    <RefreshCw size={16} />
                    다시 확인
                  </button>
                </>
              )}
            </main>
          ) : view === "admin" ? (
            <main className="admin-page">
              <div className="section-heading">
                <div>
                  <h1>대시보드</h1>
                  <p>장소 등록·좋아요 현황</p>
                </div>
                <button
                  className="secondary"
                  disabled={loading}
                  onClick={() => {
                    if (demo) setNotice("최신 상태입니다.");
                    else void refresh();
                  }}
                >
                  <RefreshCw size={16} />
                  새로고침
                </button>
              </div>
              <div className="stat-grid">
                <div>
                  <span>등록 멤버</span>
                  <strong>
                    {members.length}
                    <small>명</small>
                  </strong>
                </div>
                <div>
                  <span>공유한 장소</span>
                  <strong>
                    {memberPlaces.length}
                    <small>곳</small>
                  </strong>
                </div>
                <div>
                  <span>참여율</span>
                  <strong>
                    {stats.participation}
                    <small>%</small>
                  </strong>
                </div>
                <div>
                  <span>이용 중 멤버</span>
                  <strong>
                    {members.filter((item) => item.approved).length}
                    <small>명</small>
                  </strong>
                </div>
              </div>
              <div className="rank-grid">
                {(
                  [
                    [
                      "가장 많은 좋아요를 받은 장소",
                      ranks.likedPlaces.map((item) => ({
                        key: item.place.id,
                        name: item.place.name,
                        sub:
                          item.place.category === "restaurant"
                            ? "맛집"
                            : "주차장",
                        value: `${item.value}개`,
                      })),
                    ],
                    [
                      "가장 많은 좋아요를 받은 멤버",
                      ranks.likedPeople.map((item) => ({
                        key: item.name,
                        name: item.name,
                        sub: item.sub,
                        value: `${item.value}개`,
                      })),
                    ],
                    [
                      "가장 많이 등록한 멤버",
                      ranks.registrants.map((item) => ({
                        key: item.name,
                        name: item.name,
                        sub: item.sub,
                        value: `${item.value}곳`,
                      })),
                    ],
                  ] as const
                ).map(([title, rows]) => (
                  <section key={title} className="rank-card">
                    <h3>{title}</h3>
                    {rows.length === 0 ? (
                      <p className="rank-empty">아직 데이터가 없습니다.</p>
                    ) : (
                      <ol>
                        {rows.map((row, index) => (
                          <li key={row.key}>
                            <span className="rank-no">{index + 1}</span>
                            <span className="rank-name">
                              {row.name}
                              {row.sub && <small>{row.sub}</small>}
                            </span>
                            <strong>{row.value}</strong>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                ))}
              </div>
              <h2>멤버별 기여 현황</h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>멤버</th>
                      <th>사무소</th>
                      <th>맛집</th>
                      <th>주차장</th>
                      <th>등록 수</th>
                      <th>기여율</th>
                      <th>계정 상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.employees.map((person) => (
                      <tr key={person.id}>
                        <td>
                          <span className="table-person">
                            <span className="avatar">
                              {person.name.slice(0, 1)}
                            </span>
                            {person.name}
                            {person.role === "admin" && <small>관리자</small>}
                          </span>
                        </td>
                        <td>{person.department || "-"}</td>
                        <td>{person.restaurants}</td>
                        <td>{person.parking}</td>
                        <td>
                          <strong>{person.total}</strong>
                        </td>
                        <td>
                          <span className="contribution">
                            <span style={{ width: `${person.share}%` }} />
                          </span>
                          {person.share}%
                        </td>
                        <td>
                          {person.role === "admin" || !admin ? (
                            person.approved ? (
                              "이용 중"
                            ) : (
                              "중지됨"
                            )
                          ) : (
                            <button
                              disabled={busy}
                              className={
                                person.approved
                                  ? "status-approved"
                                  : "status-pending"
                              }
                              onClick={() =>
                                void setAccess(person, !person.approved)
                              }
                            >
                              {person.approved
                                ? "이용 중 · 중지"
                                : "중지됨 · 재개"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </main>
          ) : (
            <>
              <main className="workspace">
                <aside className={`sidebar ${listOpen ? "open" : ""}`}>
                  <div className="sheet-head">
                    <b>장소 목록</b>
                    <button
                      className="icon-button"
                      title="목록 닫기"
                      aria-label="목록 닫기"
                      onClick={() => setListOpen(false)}
                    >
                      <X size={19} />
                    </button>
                  </div>
                  <div className="side-head">
                    <div>
                      <h1>장소</h1>
                      <p>
                        맛집{" "}
                        {
                          places.filter(
                            (item) => item.category === "restaurant",
                          ).length
                        }
                        <i /> 주차장{" "}
                        {
                          places.filter((item) => item.category === "parking")
                            .length
                        }
                      </p>
                    </div>
                    <button className="primary" onClick={startAdd}>
                      <Plus size={16} />
                      장소 등록
                    </button>
                  </div>
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      aria-label="장소 검색"
                      placeholder="장소 이름, 주소, 메모 검색"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    {search && (
                      <button
                        className="icon-button"
                        title="검색 지우기"
                        aria-label="검색 지우기"
                        onClick={() => setSearch("")}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <div className="filters" role="group" aria-label="장소 종류">
                    {(
                      [
                        ["all", "전체"],
                        ["restaurant", "맛집"],
                        ["parking", "주차장"],
                        ["saved", "저장"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        className={filter === value ? "active" : ""}
                        onClick={() => setFilter(value)}
                      >
                        {value === "restaurant" ? (
                          <Utensils size={14} />
                        ) : value === "parking" ? (
                          <ParkingSquare size={15} />
                        ) : value === "saved" ? (
                          <Bookmark size={14} />
                        ) : null}
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="list-heading">
                    <span>{visible.length}개</span>
                    <span>최근 등록순</span>
                  </div>
                  <div className="place-list">
                    {loading ? (
                      <p className="empty">장소를 불러오는 중입니다.</p>
                    ) : visible.length === 0 ? (
                      <div className="empty">
                        <MapPin size={28} />
                        <h3>등록된 장소가 없습니다</h3>
                        <p>검색 조건을 변경하거나 장소를 등록해 주세요.</p>
                      </div>
                    ) : (
                      [...visible]
                        .sort((first, second) =>
                          second.created_at.localeCompare(first.created_at),
                        )
                        .map((place) => (
                          <article
                            key={place.id}
                            className={`place-card ${selected === place.id ? "selected" : ""}`}
                          >
                            <button
                              className="place-open"
                              onClick={() => choose(place)}
                            >
                              <span
                                className={`category-icon ${place.category}`}
                              >
                                {place.category === "restaurant" ? (
                                  <Utensils size={20} />
                                ) : (
                                  <ParkingSquare size={22} />
                                )}
                              </span>
                              <div>
                                <span
                                  className={`category-label ${place.category}`}
                                >
                                  {place.category === "restaurant"
                                    ? "맛집"
                                    : "주차장"}
                                </span>
                                <h3>{place.name}</h3>
                                {place.address && (
                                  <p className="address">{place.address}</p>
                                )}
                              </div>
                              <ChevronRight size={15} />
                            </button>
                            <p className="place-note">{place.note}</p>
                            {place.price && (
                              <p className="price-chip">{place.price}</p>
                            )}
                            <div className="place-footer">
                              <span>
                                {!adminIds.has(place.author_id) && (
                                  <>
                                    <span className="tiny-avatar">
                                      {profiles
                                        .find(
                                          (person) =>
                                            person.id === place.author_id,
                                        )
                                        ?.name.slice(0, 1) ?? "?"}
                                    </span>
                                    {profiles.find(
                                      (person) => person.id === place.author_id,
                                    )?.name ?? "멤버"}
                                  </>
                                )}
                                <span className="date">
                                  {new Date(
                                    place.created_at,
                                  ).toLocaleDateString("ko-KR", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                                {likes.some(
                                  (like) => like.place_id === place.id,
                                ) && (
                                  <span className="like-count">
                                    <Heart size={12} fill="currentColor" />
                                    {
                                      likes.filter(
                                        (like) => like.place_id === place.id,
                                      ).length
                                    }
                                  </span>
                                )}
                              </span>
                              <button
                                className={`icon-button ${saved.includes(place.id) ? "bookmarked" : ""}`}
                                aria-label={`${place.name} ${saved.includes(place.id) ? "저장 해제" : "저장"}`}
                                title="즐겨찾기"
                                onClick={() => toggleSaved(place.id)}
                              >
                                <Bookmark
                                  size={17}
                                  fill={
                                    saved.includes(place.id)
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              </button>
                            </div>
                          </article>
                        ))
                    )}
                  </div>
                  <div className="sidebar-bottom">
                    <span className="live-dot" />
                    사내 공유 지도
                    <button
                      className="icon-button"
                      title="새로고침"
                      aria-label="새로고침"
                      disabled={loading}
                      onClick={() =>
                        demo ? setNotice("최신 상태입니다.") : void refresh()
                      }
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </aside>
                <section
                  className={`map-section ${picking ? "picking" : ""}`}
                  aria-label="장소 지도"
                >
                  <MapContainer
                    center={center}
                    zoom={15}
                    scrollWheelZoom
                    className="leaflet-map"
                  >
                    {mapStyle === "standard" ? (
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        maxZoom={19}
                      />
                    ) : (
                      <SimpleBasemap onError={handleMapError} />
                    )}
                    <MapActions
                      target={target}
                      picking={picking}
                      onPick={previewPin}
                    />
                    {visible.map((place) => (
                      <Marker
                        key={place.id}
                        title={place.name}
                        position={[place.lat, place.lng]}
                        icon={
                          place.category === "restaurant"
                            ? restaurantIcon
                            : parkingIcon
                        }
                        eventHandlers={{
                          click: () => {
                            if (picking) previewPin(place.lat, place.lng);
                            else choose(place);
                          },
                        }}
                      />
                    ))}
                    {draft?.lat !== undefined &&
                      draft.lng !== undefined &&
                      !picking && (
                        <Marker
                          position={[draft.lat, draft.lng]}
                          icon={draftIcon}
                        />
                      )}
                    {picking && pendingPin && (
                      <Marker
                        key={`${pendingPin.lat},${pendingPin.lng}`}
                        position={[pendingPin.lat, pendingPin.lng]}
                        icon={pendingIcon}
                      />
                    )}
                  </MapContainer>
                  <div className="map-style-picker">
                    <label htmlFor="map-style">지도 스타일</label>
                    <select
                      id="map-style"
                      value={mapStyle}
                      onChange={(event) => {
                        setMapStyle(
                          event.target.value as "simple" | "standard",
                        );
                        setMapError(false);
                      }}
                    >
                      <option value="simple">심플 · Positron</option>
                      <option value="standard">기본 · OpenStreetMap</option>
                    </select>
                  </div>
                  {mapError && mapStyle === "simple" && (
                    <div className="map-error" role="status">
                      심플 지도를 불러오지 못했습니다.
                      <button
                        onClick={() => {
                          setMapStyle("standard");
                          setMapError(false);
                        }}
                      >
                        기본 지도로 전환
                      </button>
                    </div>
                  )}
                  <div className="map-top">
                    <button
                      className="list-toggle"
                      onClick={() => {
                        setSelected(null);
                        setListOpen(true);
                      }}
                    >
                      <SlidersHorizontal size={16} />
                      목록 {visible.length}
                    </button>
                    <span className="map-caption">
                      <MapPin size={15} />
                      {current?.name ?? "장소 지도"}
                    </span>
                    <button
                      className="map-control"
                      aria-label="내 위치"
                      title="내 위치로 이동"
                      onClick={() => {
                        if (!navigator.geolocation) {
                          setNotice(
                            "이 브라우저에서는 위치를 사용할 수 없습니다.",
                          );
                          return;
                        }
                        navigator.geolocation.getCurrentPosition(
                          (position) =>
                            setTarget([
                              position.coords.latitude,
                              position.coords.longitude,
                            ]),
                          () =>
                            setNotice(
                              "위치를 확인하지 못했습니다. 브라우저 위치 권한을 확인해 주세요.",
                            ),
                          { timeout: 10000 },
                        );
                      }}
                    >
                      <LocateFixed size={19} />
                    </button>
                  </div>
                  {picking && (
                    <div className="pick-banner" role="status">
                      <div className="pick-head">
                        <MapPin size={17} />
                        <span>
                          {pendingPin
                            ? "핀 위치를 확인해 주세요."
                            : "등록할 위치를 지도에서 선택해 주세요."}
                        </span>
                        <button
                          className="icon-button"
                          title="위치 선택 취소"
                          aria-label="위치 선택 취소"
                          onClick={cancelPicking}
                        >
                          <X size={17} />
                        </button>
                      </div>
                      {pendingPin && (
                        <p className="pick-address">
                          {pendingLoading
                            ? "주소를 확인하는 중..."
                            : pendingAddress ||
                              "주소를 확인하지 못했습니다. 다음 화면에서 직접 입력해 주세요."}
                        </p>
                      )}
                      <div className="pick-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={pinMyLocation}
                        >
                          <LocateFixed size={16} />내 위치에 핀 꽂기
                        </button>
                        {pendingPin && (
                          <button
                            type="button"
                            className="primary"
                            onClick={confirmPin}
                          >
                            이 위치로 선택
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="map-legend">
                    <span>
                      <i className="legend-restaurant" />
                      맛집
                    </span>
                    <span>
                      <i className="legend-parking" />
                      주차장
                    </span>
                  </div>
                  {!current && !picking && (
                    <button className="fab" onClick={startAdd}>
                      <Plus size={20} />
                      장소 공유
                    </button>
                  )}
                  {current && (
                    <div
                      className="detail"
                      role="dialog"
                      aria-label="장소 상세"
                    >
                      <div className="detail-top">
                        <span className={`category-label ${current.category}`}>
                          {current.category === "restaurant"
                            ? "맛집"
                            : "주차장"}
                        </span>
                        <button
                          className="icon-button"
                          title="상세 닫기"
                          aria-label="상세 닫기"
                          onClick={() => setSelected(null)}
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <h2>{current.name}</h2>
                      {current.address && (
                        <p className="address">{current.address}</p>
                      )}
                      <button
                        className={`like-button ${liked ? "is-liked" : ""}`}
                        aria-pressed={liked}
                        disabled={busy}
                        onClick={() => void toggleLike(current)}
                      >
                        <Heart
                          size={16}
                          fill={liked ? "currentColor" : "none"}
                        />
                        좋아요 {currentLikes.length}
                      </button>
                      {current.price && (
                        <span className="price">{current.price}</span>
                      )}
                      <p className="detail-note">{current.note}</p>
                      <button
                        className="primary navi-button"
                        onClick={() => {
                          const result = openNaverNavigation(current);
                          if (result === "web")
                            setNotice(
                              "네이버 지도 앱 내비 안내는 모바일에서 사용할 수 있습니다. 웹 지도를 열었습니다.",
                            );
                        }}
                      >
                        <Navigation size={17} />
                        네이버 지도 앱으로 길 안내
                      </button>
                      <div className="external-links">
                        <a
                          href={naverSearchUrl(current)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          네이버 지도
                          <ArrowUpRight size={15} />
                        </a>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${current.lat},${current.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          구글 지도
                          <ArrowUpRight size={15} />
                        </a>
                      </div>
                      <div className="detail-author">
                        <span>
                          {!adminIds.has(current.author_id) && (
                            <>
                              공유한 멤버 ·{" "}
                              {profiles.find(
                                (person) => person.id === current.author_id,
                              )?.name ?? "멤버"}
                            </>
                          )}
                        </span>
                        {(admin || current.author_id === profile?.id) && (
                          <span>
                            <button
                              className="icon-button"
                              title="장소 수정"
                              aria-label="장소 수정"
                              onClick={() => setDraft(current)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button danger"
                              disabled={busy}
                              title="장소 삭제"
                              aria-label="장소 삭제"
                              onClick={() => void deletePlace(current)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </span>
                        )}
                      </div>
                      <div className="comment-list">
                        {comments
                          .filter((item) => item.place_id === current.id)
                          .map((comment) => (
                            <div className="comment" key={comment.id}>
                              <div className="comment-head">
                                <b>
                                  {profiles.find(
                                    (person) => person.id === comment.author_id,
                                  )?.name ?? "멤버"}
                                </b>
                                {comment.author_id === profile?.id && (
                                  <button
                                    className="icon-button danger"
                                    disabled={busy}
                                    title="내 댓글 삭제"
                                    aria-label="내 댓글 삭제"
                                    onClick={() => void deleteComment(comment)}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                              <p>{comment.body}</p>
                            </div>
                          ))}
                      </div>
                      <form className="comment-form" onSubmit={addComment}>
                        <input
                          aria-label="댓글"
                          placeholder="댓글 입력"
                          maxLength={500}
                          value={commentText}
                          onChange={(event) =>
                            setCommentText(event.target.value)
                          }
                        />
                        <button
                          className="icon-button"
                          title="댓글 등록"
                          aria-label="댓글 등록"
                          disabled={busy || !commentText.trim()}
                        >
                          <Send size={18} />
                        </button>
                      </form>
                    </div>
                  )}
                </section>
              </main>
            </>
          )}
          {draft && (
            <div
              className={`modal-backdrop ${picking ? "is-hidden" : ""}`}
              onClick={(event) => {
                if (event.target === event.currentTarget && !busy)
                  setDraft(null);
              }}
            >
              <section
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="place-form-title"
              >
                <div className="modal-heading">
                  <h2 id="place-form-title">
                    {draft.id ? "장소 수정" : "장소 등록"}
                  </h2>
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label="등록 창 닫기"
                    title="닫기"
                    onClick={() => setDraft(null)}
                  >
                    <X size={21} />
                  </button>
                </div>
                <form onSubmit={savePlace}>
                  <fieldset className="category-choice">
                    <legend>장소 종류</legend>
                    <label>
                      <input
                        type="radio"
                        name="category"
                        value="restaurant"
                        checked={draft.category !== "parking"}
                        onChange={() =>
                          setDraft((previous) => ({
                            ...previous,
                            category: "restaurant",
                          }))
                        }
                      />
                      <Utensils size={18} />
                      맛집
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="category"
                        value="parking"
                        checked={draft.category === "parking"}
                        onChange={() =>
                          setDraft((previous) => ({
                            ...previous,
                            category: "parking",
                          }))
                        }
                      />
                      <ParkingSquare size={19} />
                      주차장
                    </label>
                  </fieldset>
                  <div
                    className={`location-field ${draft.lat !== undefined && draft.lng !== undefined ? "is-set" : ""}`}
                  >
                    <MapPin size={18} />
                    <span>
                      {draft.lat !== undefined && draft.lng !== undefined
                        ? "위치가 선택되었습니다"
                        : "위치를 선택해 주세요"}
                    </span>
                    <button
                      type="button"
                      className="secondary"
                      onClick={startPicking}
                    >
                      {draft.lat !== undefined && draft.lng !== undefined
                        ? "지도에서 변경"
                        : "지도에서 선택"}
                    </button>
                  </div>
                  <label>
                    장소 이름
                    <input
                      name="name"
                      required
                      maxLength={80}
                      value={draft.name ?? ""}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                      placeholder="상호 또는 시설명"
                      autoFocus={!!draft.id}
                    />
                  </label>
                  <label>
                    주소
                    <input
                      name="address"
                      required
                      maxLength={200}
                      value={draft.address ?? ""}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          address: event.target.value,
                        }))
                      }
                      placeholder={
                        addressLoading
                          ? "주소를 불러오는 중..."
                          : "주소 입력 또는 지도에서 선택"
                      }
                    />
                  </label>
                  <label>
                    추천 메모
                    <textarea
                      name="note"
                      required
                      maxLength={1000}
                      defaultValue={draft.note}
                      rows={3}
                      placeholder="메뉴, 이용 시간, 요금 등 공유할 내용"
                    />
                  </label>
                  <label>
                    {draft.category === "parking"
                      ? "추가 요금 안내 (선택)"
                      : "가격 (선택)"}
                    <input
                      name="price"
                      maxLength={100}
                      defaultValue={draft.price}
                      placeholder={
                        draft.category === "parking"
                          ? "예: 시간당 3,000원 / 최초 30분 무료"
                          : "예: 점심 12,000원"
                      }
                    />
                  </label>
                  <div className="form-footer">
                    <span>{!admin && <>작성자 {profile?.name}</>}</span>
                    <button className="primary" disabled={busy}>
                      {busy
                        ? "저장 중..."
                        : draft.id
                          ? "수정 저장"
                          : "장소 등록"}
                      <Plus size={17} />
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </>
      )}
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            title="알림 닫기"
            aria-label="알림 닫기"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function message(error: unknown) {
  const text =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  if (/invalid login credentials/i.test(text))
    return "계정 또는 비밀번호가 올바르지 않습니다.";
  if (/already (been )?registered/i.test(text))
    return "이미 사용 중인 계정입니다.";
  if (/password should be at least/i.test(text))
    return "비밀번호는 6자 이상이어야 합니다.";
  if (/email not confirmed/i.test(text))
    return "이메일 인증이 켜져 있습니다. 관리자에게 인증 설정 해제를 요청해 주세요.";
  if (/profiles_account_key|database error saving new user/i.test(text))
    return "이미 사용 중이거나 등록할 수 없는 계정입니다.";
  if (/email address .* is invalid|email_address_invalid/i.test(text))
    return "계정 설정 오류입니다. 관리자에게 문의해 주세요.";
  return text || "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
}
export default App;
