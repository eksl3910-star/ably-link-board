"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type SettingsDoc = {
  isMaintenance?: boolean;
};

function MaintenanceScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-[420px] rounded-2xl border border-[#e7e9ee] bg-white p-6 text-center">
        <h1 className="text-xl font-extrabold tracking-[-0.02em] text-[#1f2430]">현재 점검 중입니다</h1>
        <p className="mt-2 text-sm text-[#7c8394]">나중에 다시 오세요!</p>
      </div>
    </main>
  );
}

export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdminPath = useMemo(() => pathname?.startsWith("/admin") ?? false, [pathname]);

  const [ready, setReady] = useState(false);
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    if (isAdminPath) {
      setReady(true);
      setMaintenance(false);
      return;
    }

    let alive = true;

    (async () => {
      try {
        // 세션 캐시(TTL)로 불필요한 읽기 최소화
        const cachedRaw = sessionStorage.getItem("lb_maintenance_cache");
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as { value: boolean; fetchedAt: number };
          if (typeof cached?.value === "boolean" && typeof cached?.fetchedAt === "number") {
            if (Date.now() - cached.fetchedAt < 5000) {
              if (!alive) return;
              setMaintenance(cached.value);
              return;
            }
          }
        }

        // 전역 점검 모드 플래그(읽기 1회)
        const snap = await getDoc(doc(db, "settings", "global"));
        const data = (snap.exists() ? (snap.data() as SettingsDoc) : {}) ?? {};
        if (!alive) return;
        const value = Boolean(data.isMaintenance);
        setMaintenance(value);
        sessionStorage.setItem("lb_maintenance_cache", JSON.stringify({ value, fetchedAt: Date.now() }));
      } catch {
        if (!alive) return;
        // 읽기 실패 시에는 기본적으로 정상 진입(무한 차단 방지)
        setMaintenance(false);
      } finally {
        if (!alive) return;
        setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAdminPath]);

  // 점검 여부 확인이 끝나기 전에는 children을 렌더링하지 않아서
  // (점검모드일 때) 페이지 내부의 모든 DB 로직이 실행되지 않게 막습니다.
  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="text-sm text-[#7c8394]">불러오는 중...</div>
      </main>
    );
  }

  if (maintenance) return <MaintenanceScreen />;

  return <>{children}</>;
}

