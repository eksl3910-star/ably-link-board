"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
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
const usersCollection = collection(db, "users");

function normalizeNickname(name: string) {
  return name.trim().toLowerCase();
}

function JoinScreen({
  onJoin
}: {
  onJoin: (nickname: string) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = nickname.trim().length > 0 && nickname.trim().length <= 10;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError("");

    const raw = nickname.trim();
    const key = normalizeNickname(raw);
    const targetRef = doc(usersCollection, key);

    try {
      const snap = await getDoc(targetRef);
      if (snap.exists()) {
        setError("이미 사용 중인 닉네임입니다.");
        return;
      }

      await setDoc(targetRef, {
        nickname: raw,
        nicknameLower: key,
        createdAt: Date.now()
      });

      localStorage.setItem("lb_nickname", raw);
      onJoin(raw);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[420px] rounded-2xl bg-transparent text-center"
      >
        <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-[#2b2c31]">에이블리 링크 보드</h1>
        <p className="mt-3 text-sm text-[#8d8f9a]">닉네임을 설정하고 시작하세요.</p>
        <p className="text-sm text-[#8d8f9a]">한 번 설정하면 다른 사람이 써요</p>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={10}
          placeholder="닉네임 입력 (최대 10자)"
          className="mt-7 h-12 w-full rounded-xl border border-[#e3e4ea] bg-[#f6f6f8] px-4 text-sm outline-none focus:border-[#d6d8e1]"
        />
        {error ? <p className="mt-2 text-left text-xs text-[#ff4f5a]">{error}</p> : null}
        <button
          disabled={!canSubmit || busy}
          className="mt-6 h-12 w-full rounded-xl bg-[#ff5a67] text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "확인 중..." : "시작하기"}
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
  const [queueCount, setQueueCount] = useState(0);
  const [urlInput, setUrlInput] = useState("");
  const [sending, setSending] = useState(false);
  const [fetchingRandom, setFetchingRandom] = useState(false);
  const [message, setMessage] = useState("");
  const [currentLink, setCurrentLink] = useState<ViewLink | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    const q = query(linksCollection, where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => setQueueCount(snap.size));
    return () => unsub();
  }, []);

  useEffect(() => {
    const hidden = localStorage.getItem("lb_hide_howto");
    if (!hidden) setShowHowTo(true);
  }, []);

  const queueLabel = useMemo(() => `${queueCount}개 링크 대기 중`, [queueCount]);

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
        createdAt: Date.now()
      } as LinkDoc);

      setUrlInput("");
      setMessage("링크를 성공적으로 등록했어요.");
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
      const q = query(linksCollection, where("status", "==", "pending"));
      const snap = await getDocs(q);
      const docs = snap.docs;

      if (!docs.length) {
        setCurrentLink(null);
        setMessage("대기 중인 링크가 없습니다.");
        return;
      }

      const chosen = docs[Math.floor(Math.random() * docs.length)];
      const data = chosen.data() as LinkDoc;

      await updateDoc(chosen.ref, { status: "consumed" });

      setCurrentLink({ id: chosen.id, ...data });
      setMessage("랜덤 링크를 가져왔어요.");
    } catch {
      setMessage("다음 링크를 가져오지 못했습니다.");
    } finally {
      setFetchingRandom(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7]">
      <div className="mx-auto w-full max-w-[980px] px-4 py-6">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-[#282a31]">에이블리 링크 보드</h1>
          <div className="flex items-center gap-3 text-xs text-[#777b8c]">
            <span>{nickname}님</span>
            <button onClick={onResetNickname} className="rounded-md border px-2 py-1">
              닉네임 변경
            </button>
          </div>
        </header>

        <section className="mt-4 rounded-xl border border-[#ececf1] bg-white p-3 text-center text-sm font-semibold text-[#f4606a]">
          {queueLabel}
        </section>

        <form onSubmit={handleSubmitLink} className="mt-4 rounded-xl border border-[#ececf1] bg-white p-3">
          <label className="text-xs font-semibold text-[#8f93a2]">링크 올리기</label>
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="여기에 링크를 붙여넣어 주세요"
            className="mt-2 h-14 w-full rounded-xl border border-[#ededf3] bg-[#f8f8fb] px-4 text-sm outline-none"
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
            <div className="rounded-xl border border-[#f0d9de] bg-[#fff6f8] py-10 text-center">
              <p className="text-base font-semibold text-[#f05f6f]">여기에 랜덤 링크가 뜹니다</p>
              <p className="mt-1 text-xs text-[#b1a2a7]">버튼을 눌러 랜덤 링크를 받아보세요.</p>
            </div>
          )}
        </div>

        {message ? <p className="mt-3 text-sm text-[#787d8e]">{message}</p> : null}
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
