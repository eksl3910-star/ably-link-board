type MaintenanceCache = {
  value: boolean;
  fetchedAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __lbMaintenanceCache: MaintenanceCache | undefined;
}

function getCached(ttlMs: number): boolean | null {
  const cache = globalThis.__lbMaintenanceCache;
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt > ttlMs) return null;
  return cache.value;
}

function setCached(value: boolean) {
  globalThis.__lbMaintenanceCache = { value, fetchedAt: Date.now() };
}

function parseFirestoreBool(docJson: any): boolean {
  const fields = docJson?.fields;
  const v = fields?.isMaintenance;
  if (v?.booleanValue === true) return true;
  if (v?.booleanValue === false) return false;
  // 기본값: false
  return false;
}

export async function isMaintenanceMode(opts?: { ttlMs?: number }): Promise<boolean> {
  const ttlMs = opts?.ttlMs ?? 5000;
  const cached = getCached(ttlMs);
  if (cached !== null) return cached;

  // NOTE: apiKey는 클라이언트에 노출되는 값이라 서버에서도 사용 가능
  const apiKey =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    "AIzaSyCs4sk1cUAoMqYWBOV_37k6vnXDCjFBg3s";
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "link-clone-c2dc5";

  if (!apiKey) {
    // 키가 없으면 서버에서 Firestore REST 체크 불가 → 차단하지 않음
    setCached(false);
    return false;
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/global?key=${apiKey}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      setCached(false);
      return false;
    }
    const json = await res.json();
    const value = parseFirestoreBool(json);
    setCached(value);
    return value;
  } catch {
    setCached(false);
    return false;
  }
}

