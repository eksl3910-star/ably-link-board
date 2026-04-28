"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAt,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LinkDoc } from "@/lib/types";

type MetadataResult = {
  title: string;
  image: string | null;
  domain: string;
  url: string;
};

type ViewLink = LinkDoc & { id: string };

const linksCollection = collection(db, "links");

function JoinScreen({
  onJoin
}: {
  onJoin: (nickname: string) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");

  const canSubmit = nickname.trim().length > 0 && nickname.trim().length <= 10;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");

    const raw = nickname.trim();
    // 무료 플랜 절약 모드: 닉네임 중복 체크를 위해 DB를 읽지 않습니다.
    // 닉네임은 로컬 저장소에만 보관합니다.
    localStorage.setItem("lb_nickname", raw);
    onJoin(raw);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[420px] rounded-2xl bg-white text-center"
      >
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em] text-[#1f2430]">에이블리 링크 보드</h1>
        <p className="mt-3 text-sm text-[#7c8394]">닉네임을 설정하고 시작하세요.</p>
        <p className="text-sm text-[#7c8394]">무료 플랜 절약 모드가 적용되어요</p>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={10}
          placeholder="닉네임 입력 (최대 10자)"
          className="mt-7 h-12 w-full rounded-xl border border-[#e7e9ee] bg-[#fbfbfd] px-4 text-sm outline-none focus:border-[#cfd6e6]"
        />
        {error ? <p className="mt-2 text-left text-xs text-[#ff4f5a]">{error}</p> : null}
        <button
          disabled={!canSubmit}
          className="mt-6 h-12 w-full rounded-xl bg-[#ff5a67] text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          시작하기
        </button>
      </form>
    </main>
  );
}

function HowToModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-5">
      <div className="w-full max-w-[420px] rounded-2xl bg-white px-5 py-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <h2 className="text-2xl font-bold text-[#222]">사용방법</h2>
          <button onClick={onClose} className="text-lg text-[#666]">
            ×
          </button>
        </div>
        <ol className="mt-5 space-y-4 text-sm text-[#2a2a2a]">
          <li>
            <strong>1. 에이블리에서 내 링크 복사하기</strong>
            <p className="mt-1 text-xs text-[#8d8f9a]">공유하기로 링크를 복사해 입력창에 붙여넣으세요.</p>
          </li>
          <li>
            <strong>2. 내 닉네임을 넣고 올리기</strong>
            <p className="mt-1 text-xs text-[#8d8f9a]">대기 개수가 실시간으로 올라갑니다.</p>
          </li>
          <li>
            <strong>3. 빨간 버튼으로 다음 링크 받기</strong>
            <p className="mt-1 text-xs text-[#8d8f9a]">대기 중인 링크 중 하나가 랜덤으로 표시됩니다.</p>
          </li>
          <li>
            <strong>4. 반복하면 완료!</strong>
            <p className="mt-1 text-xs text-[#8d8f9a]">링크를 많이 모아 모두 함께 사용할 수 있어요.</p>
          </li>
        </ol>
        <button
          onClick={onClose}
          className="mt-5 h-11 w-full rounded-xl bg-[#111] text-base font-semibold text-white"
        >
          다시 보지 않기
        </button>
        <button onClick={onClose} className="mt-2 h-11 w-full rounded-xl bg-[#f1f1f4] text-sm text-[#666]">
          닫기
        </button>
      </div>
    </div>
  );
}

function LinkCard({ link }: { link: ViewLink }) {
  return (
    <div className="w-full rounded-2xl border border-[#ececf2] bg-white p-4">
      <a href={link.url} target="_blank" rel="noreferrer" className="block">
        <div className="flex gap-3">
          <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-[#f1f2f6]">
            {link.image ? (
              <Image src={link.image} alt={link.title} fill sizes="72px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] text-[#8f92a1]">NO IMG</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="max-h-10 overflow-hidden text-sm font-semibold text-[#23252d]">{link.title}</p>
            <p className="mt-1 text-xs text-[#7f8395]">{link.domain}</p>
            <p className="mt-2 text-xs text-[#a0a3af]">{link.createdBy}</p>
          </div>
        </div>
      </a>
    </div>
  );
}

function MainScreen({
  nickname,
  onResetNickname
}: {
  nickname: string;
  onResetNickname: () => void;
}) {
  const [hasPending, setHasPending] = useState<boolean | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [sending, setSending] = useState(false);
  const [fetchingRandom, setFetchingRandom] = useState(false);
  const [message, setMessage] = useState("");
  const [currentLink, setCurrentLink] = useState<ViewLink | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const didInitialRead = useRef(false);

  useEffect(() => {
    // 무료 플랜 절약 모드:
    // - Firestore 읽기는 "최초 로드 1회"만 허용
    // - limit(1)로 1개만 읽어 "대기 링크가 있는지"만 확인
    if (didInitialRead.current) return;
    didInitialRead.current = true;

    (async () => {
      try {
        const pivot = Math.random();
        const base = query(
          linksCollection,
          where("status", "==", "pending"),
          orderBy("rand"),
          startAt(pivot),
          limit(1)
        );
        let snap = await getDocs(base);
        if (snap.empty) {
          const fallback = query(
            linksCollection,
            where("status", "==", "pending"),
            orderBy("rand"),
            limit(1)
          );
          snap = await getDocs(fallback);
        }

        setHasPending(!snap.empty);
      } catch {
        setHasPending(null);
      }
    })();
  }, []);

  useEffect(() => {
    const hidden = localStorage.getItem("lb_hide_howto");
    if (!hidden) setShowHowTo(true);
  }, []);

  const queueLabel = useMemo(() => {
    if (hasPending === null) return "대기 링크 상태 확인 불가";
    if (hasPending === false) return "대기 중인 링크가 없어요";
    return "대기 중인 링크가 있어요";
  }, [hasPending]);

  async function handleSubmitLink(e: FormEvent) {
    e.preventDefault();
    if (!urlInput.trim() || sending) return;

    setSending(true);
    setMessage("");

    try {
      const res = await fetch(`/api/metadata?url=${encodeURIComponent(urlInput)}`);
      const data = (await res.json()) as MetadataResult | { error: string };

      if (!res.ok || "error" in data) {
        setMessage("링크를 읽지 못했습니다. URL을 확인해주세요.");
        return;
      }

      await addDoc(linksCollection, {
        url: data.url,
        title: data.title,
        image: data.image,
        domain: data.domain,
        status: "pending",
        createdBy: nickname,
        createdAt: Date.now(),
        rand: Math.random()
      } as LinkDoc);

      setUrlInput("");
      setMessage("링크를 성공적으로 등록했어요.");
      // 비용 절약: 업로드 후 대기 상태 재조회(읽기)는 하지 않습니다.
      setHasPending(true);
    } catch {
      setMessage("등록 중 오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  }

  async function handleNextRandom() {
    if (fetchingRandom) return;
    setFetchingRandom(true);
    setMessage("");

    try {
      // 무료 플랜 절약 모드:
      // - Firestore 읽기는 "버튼 클릭 1회"에만 발생
      // - limit(1)로 1개만 읽어 랜덤 링크 1개만 가져옴
      const pivot = Math.random();
      const base = query(
        linksCollection,
        where("status", "==", "pending"),
        orderBy("rand"),
        startAt(pivot),
        limit(1)
      );
      let snap = await getDocs(base);

      if (snap.empty) {
        const fallback = query(
          linksCollection,
          where("status", "==", "pending"),
          orderBy("rand"),
          limit(1)
        );
        snap = await getDocs(fallback);
      }

      const docs = snap.docs;
      if (!docs.length) {
        setCurrentLink(null);
        setMessage("대기 중인 링크가 없습니다.");
        setHasPending(false);
        return;
      }

      const chosen = docs[0];
      const data = chosen.data() as LinkDoc;

      await updateDoc(chosen.ref, { status: "consumed" });

      setCurrentLink({ id: chosen.id, ...data });
      setMessage("랜덤 링크를 가져왔어요.");
      // 비용 절약: 다음 대기 상태는 즉시 재조회하지 않음
      setHasPending(null);
    } catch {
      setMessage("다음 링크를 가져오지 못했습니다.");
    } finally {
      setFetchingRandom(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-[980px] px-4 py-6">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-[#1f2430]">에이블리 링크 보드</h1>
          <div className="flex items-center gap-3 text-xs text-[#777b8c]">
            <span>{nickname}님</span>
            <button onClick={onResetNickname} className="rounded-md border px-2 py-1">
              닉네임 변경
            </button>
          </div>
        </header>

        <section className="mt-4 rounded-xl border border-[#e7e9ee] bg-[#fbfbfd] p-3 text-center text-sm font-semibold text-[#ff5a67]">
          {queueLabel}
        </section>

        <form onSubmit={handleSubmitLink} className="mt-4 rounded-xl border border-[#e7e9ee] bg-white p-3">
          <label className="text-xs font-semibold text-[#7c8394]">링크 올리기</label>
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="여기에 링크를 붙여넣어 주세요"
            className="mt-2 h-14 w-full rounded-xl border border-[#e7e9ee] bg-[#fbfbfd] px-4 text-sm outline-none focus:border-[#cfd6e6]"
          />
        </form>

        <button
          onClick={handleNextRandom}
          disabled={fetchingRandom}
          className="mt-4 h-12 w-full rounded-xl bg-[#ff5a67] text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {fetchingRandom ? "불러오는 중..." : "다음 링크 받기"}
        </button>

        <div className="mt-4">
          {currentLink ? (
            <LinkCard link={currentLink} />
          ) : (
            <div className="rounded-xl border border-[#e7e9ee] bg-[#fbfbfd] py-10 text-center">
              <p className="text-base font-semibold text-[#1f2430]">여기에 랜덤 링크가 뜹니다</p>
              <p className="mt-1 text-xs text-[#7c8394]">버튼을 눌러 랜덤 링크를 받아보세요.</p>
            </div>
          )}
        </div>

        {message ? <p className="mt-3 text-sm text-[#787d8e]">{message}</p> : null}

        <div className="mt-10">
          <a
            href="https://open.kakao.com/o/s6VGm9Ig"
            target="_blank"
            rel="noreferrer"
            className="block h-12 w-full rounded-xl border border-[#e7e9ee] bg-white text-center text-sm font-semibold leading-[48px] text-[#1f2430] hover:bg-[#fbfbfd]"
          >
            제작자에게 문의하기
          </a>
        </div>
      </div>

      {showHowTo ? (
        <HowToModal
          onClose={() => {
            localStorage.setItem("lb_hide_howto", "1");
            setShowHowTo(false);
          }}
        />
      ) : null}
    </main>
  );
}

export default function HomePage() {
  const [nickname, setNickname] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("lb_nickname");
    if (saved) setNickname(saved);
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!nickname) {
    return <JoinScreen onJoin={setNickname} />;
  }

  return (
    <MainScreen
      nickname={nickname}
      onResetNickname={() => {
        localStorage.removeItem("lb_nickname");
        setNickname("");
      }}
    />
  );
}
