"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type SettingsDoc = {
  isMaintenance: boolean;
  updatedAt: number;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [error, setError] = useState("");

  const settingsRef = useMemo(() => doc(db, "settings", "global"), []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const snap = await getDoc(settingsRef);
        if (!alive) return;
        if (!snap.exists()) {
          const initial: SettingsDoc = { isMaintenance: false, updatedAt: Date.now() };
          await setDoc(settingsRef, initial);
          if (!alive) return;
          setIsMaintenance(false);
        } else {
          const data = snap.data() as Partial<SettingsDoc>;
          setIsMaintenance(Boolean(data.isMaintenance));
        }
      } catch {
        if (!alive) return;
        setError("설정 값을 불러오지 못했습니다. Firestore Rules를 확인해주세요.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [settingsRef]);

  async function toggleMaintenance(next: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await updateDoc(settingsRef, { isMaintenance: next, updatedAt: Date.now() });
      setIsMaintenance(next);
    } catch {
      setError("업데이트 실패. Firestore 권한/할당량을 확인해주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto w-full max-w-[560px] rounded-2xl border border-[#e7e9ee] bg-white p-6">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-[#1f2430]">관리자</h1>
        <p className="mt-2 text-sm text-[#7c8394]">여기서 서버 점검 모드를 켜고 끌 수 있어요.</p>

        <div className="mt-6 rounded-xl border border-[#e7e9ee] bg-[#fbfbfd] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1f2430]">현재 상태</p>
              <p className="mt-1 text-xs text-[#7c8394]">
                {loading ? "불러오는 중..." : isMaintenance ? "점검 중 (전체 차단)" : "정상 운영"}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                isMaintenance ? "bg-[#ffe8ea] text-[#ff5a67]" : "bg-[#e9fbf0] text-[#14a44d]"
              }`}
            >
              {isMaintenance ? "MAINTENANCE" : "LIVE"}
            </span>
          </div>

          {error ? <p className="mt-3 text-sm text-[#ff4f5a]">{error}</p> : null}

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              disabled={loading || busy || isMaintenance}
              onClick={() => toggleMaintenance(true)}
              className="h-12 w-full rounded-xl bg-[#111] text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              서버 전체 중단
            </button>
            <button
              disabled={loading || busy || !isMaintenance}
              onClick={() => toggleMaintenance(false)}
              className="h-12 w-full rounded-xl border border-[#e7e9ee] bg-white text-base font-bold text-[#1f2430] disabled:cursor-not-allowed disabled:opacity-50"
            >
              점검 해제
            </button>
          </div>
        </div>

        <p className="mt-6 text-xs text-[#7c8394]">
          동작 원리: Firestore `settings/global` 문서의 `isMaintenance` 값을 true/false로 바꿉니다.
        </p>
      </div>
    </main>
  );
}

