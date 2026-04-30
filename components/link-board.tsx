"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where
} from "firebase/firestore";

type AlertType = "success" | "danger" | "info" | "warning";
type AlertState = { message: string; type: AlertType } | null;
type LinkDoc = {
  url: string;
  owner: string;
  status: "waiting" | "taken" | "used";
  createdAt: number;
  takenBy?: string | null;
  takenAt?: number | null;
};

export default function LinkBoard() {
  const [screen, setScreen] = useState<"nickname" | "main">("nickname");
  const [nickInput, setNickInput] = useState("");
  const [nickError, setNickError] = useState("");
  const [myNickname, setMyNickname] = useState("");
  const [poolCount, setPoolCount] = useState<number | string>("-");
  const [uploadAlert, setUploadAlert] = useState<AlertState>(null);
  const [receiveAlert, setReceiveAlert] = useState<AlertState>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showRequeue, setShowRequeue] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [currentLinkUrl, setCurrentLinkUrl] = useState("");
  const [countdown, setCountdown] = useState(5);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isLinkDisplay, setIsLinkDisplay] = useState(false);

  const myLastLinkRef = useRef("");
  const receivedOwnersRef = useRef<string[]>([]);
  const currentLinkIdRef = useRef<string | null>(null);
  const currentLinkOwnerRef = useRef<string | null>(null);
  const myCurrentLinkIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const receiveWrapHidden = useMemo(() => isLinkDisplay, [isLinkDisplay]);

  const isTossUrl = (candidate: string) => {
    try {
      const parsed = new URL(candidate);
      return parsed.hostname === "toss.me" || parsed.hostname.endsWith(".toss.me");
    } catch {
      return false;
    }
  };

  const extractTossURL = (text: string) => {
    const matches = text.match(/https?:\/\/[^\s]+/g);
    if (!matches) return null;
    for (const match of matches) {
      const url = match.replace(/[.,)>\]]+$/, "");
      if (isTossUrl(url)) return url;
    }
    return null;
  };

  const showAlert = (setState: (value: AlertState) => void, message: string, type: AlertType) => {
    if (!message) {
      setState(null);
      return;
    }
    setState({ message, type });
  };

  useEffect(() => {
    const savedNick = localStorage.getItem("toss_nickname") || "";
    const savedLastLink = localStorage.getItem("toss_last_link") || "";
    const savedOwners = JSON.parse(localStorage.getItem("toss_received_owners") || "[]") as string[];

    myLastLinkRef.current = savedLastLink;
    receivedOwnersRef.current = savedOwners;

    if (!savedNick) {
      setScreen("nickname");
      return;
    }

    const verifyNickname = async () => {
      const nickDoc = await getDoc(doc(db, "nicknames", savedNick));
      if (nickDoc.exists()) {
        setMyNickname(savedNick);
        setNickInput(savedNick);
        setScreen("main");
        if (!localStorage.getItem("toss_guide_done")) {
          window.setTimeout(() => setShowGuide(true), 400);
        }
      } else {
        localStorage.removeItem("toss_nickname");
        setScreen("nickname");
      }
    };

    void verifyNickname();
  }, []);

  useEffect(() => {
    if (screen !== "main" || !myNickname) return;
    const q = query(collection(db, "links"), where("status", "==", "waiting"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      let count = 0;
      let myWaitingLinkId: string | null = null;

      querySnapshot.forEach((snap) => {
        const data = snap.data() as LinkDoc;
        if (data.owner === myNickname && data.status === "waiting") {
          myWaitingLinkId = snap.id;
        }
        if (data.status === "waiting" && data.owner !== myNickname && !receivedOwnersRef.current.includes(data.owner)) {
          count += 1;
        }
      });

      myCurrentLinkIdRef.current = myWaitingLinkId;
      setShowRequeue(Boolean(myWaitingLinkId));
      setPoolCount(count);
    });
    return () => unsubscribe();
  }, [screen, myNickname]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const setNickname = async () => {
    const value = nickInput.trim();
    setNickError("");

    if (!value) {
      setNickError("닉네임을 입력해주세요.");
      return;
    }
    if (value.length > 10) {
      setNickError("닉네임은 최대 10자까지 입력할 수 있어요.");
      return;
    }
    if (/[\/\\.#$\[\]]/.test(value)) {
      setNickError("닉네임에 사용할 수 없는 문자가 있어요.");
      return;
    }

    try {
      await runTransaction(db, async (tx) => {
        const nickRef = doc(db, "nicknames", value);
        const snap = await tx.get(nickRef);
        if (snap.exists()) {
          throw new Error("DUPLICATE_NICKNAME");
        }
        tx.set(nickRef, { createdAt: Date.now() });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "DUPLICATE_NICKNAME") {
        setNickError("이미 사용 중인 닉네임이에요. 다른 걸 써주세요.");
        return;
      }
      setNickError("닉네임 설정 중 오류가 발생했어요.");
      return;
    }

    localStorage.setItem("toss_nickname", value);
    setMyNickname(value);
    setScreen("main");
    if (!localStorage.getItem("toss_guide_done")) {
      window.setTimeout(() => setShowGuide(true), 400);
    }
  };

  const refreshCount = async () => {
    const snap = await getDocs(query(collection(db, "links"), where("status", "==", "waiting")));
    let count = 0;
    snap.forEach((item) => {
      const data = item.data() as LinkDoc;
      if (data.owner !== myNickname && !receivedOwnersRef.current.includes(data.owner)) {
        count += 1;
      }
    });
    setPoolCount(count);
  };

  const checkMyLink = async () => {
    const snap = await getDocs(query(collection(db, "links"), where("owner", "==", myNickname), limit(30)));
    let waitingId: string | null = null;
    snap.forEach((item) => {
      const data = item.data() as LinkDoc;
      if (data.status === "waiting") waitingId = item.id;
    });
    myCurrentLinkIdRef.current = waitingId;
    setShowRequeue(Boolean(waitingId));
  };

  const dontShowAgain = () => {
    localStorage.setItem("toss_guide_done", "1");
    setShowGuide(false);
  };

  const pasteAndUpload = async () => {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      showAlert(
        setUploadAlert,
        "📋 붙여넣기 권한이 필요해요! 크롬: 상단 팝업에서 허용 / 사파리: 주소창 AA → 웹사이트 설정 → 붙여넣기 허용",
        "warning"
      );
      return;
    }

    const url = extractTossURL(text);
    if (!url) {
      showAlert(setUploadAlert, "토스 링크(toss.me)를 찾을 수 없어요. 토스 링크를 먼저 복사해주세요.", "danger");
      return;
    }

    if (url === myLastLinkRef.current) {
      showAlert(setUploadAlert, "이전에 올린 링크랑 같아요. 토스에서 새 링크를 만들어주세요!", "danger");
      return;
    }

    const dup = await getDocs(query(collection(db, "links"), where("url", "==", url), limit(1)));
    if (!dup.empty) {
      showAlert(setUploadAlert, "이미 올라온 링크예요.", "danger");
      return;
    }

    try {
      const created = await addDoc(collection(db, "links"), {
        url,
        owner: myNickname,
        status: "waiting",
        createdAt: Date.now(),
        takenBy: null,
        takenAt: null
      });

      myLastLinkRef.current = url;
      myCurrentLinkIdRef.current = created.id;
      localStorage.setItem("toss_last_link", url);
      setShowRequeue(true);
      showAlert(setUploadAlert, "링크가 올라갔어요! 🎉", "success");
      await refreshCount();
    } catch {
      showAlert(setUploadAlert, "업로드 중 오류가 발생했어요.", "danger");
    }
  };

  const requeueMyLink = async () => {
    if (!myCurrentLinkIdRef.current) {
      await checkMyLink();
      if (!myCurrentLinkIdRef.current) {
        showAlert(setUploadAlert, "대기 중인 내 링크가 없어요. 새 링크를 올려주세요.", "info");
        return;
      }
    }

    const waitingSnap = await getDocs(query(collection(db, "links"), where("status", "==", "waiting")));
    let oldestTime = Date.now();
    waitingSnap.forEach((item) => {
      const data = item.data() as LinkDoc;
      if (typeof data.createdAt === "number" && data.createdAt < oldestTime) oldestTime = data.createdAt;
    });

    await updateDoc(doc(db, "links", myCurrentLinkIdRef.current), { createdAt: oldestTime - 1 });
    showAlert(setUploadAlert, "내 링크가 대기열 맨 앞으로 이동됐어요! 🔄", "success");
  };

  const resetDisplay = async () => {
    setIsLinkDisplay(false);
    setIsReceiving(false);
    setReceiveAlert(null);
    setCountdown(5);
    setIsUrgent(false);
    currentLinkIdRef.current = null;
    currentLinkOwnerRef.current = null;
    await refreshCount();
  };

  const returnLink = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const currentId = currentLinkIdRef.current;
    const currentOwner = currentLinkOwnerRef.current;
    if (currentId) {
      if (currentOwner) {
        receivedOwnersRef.current = receivedOwnersRef.current.filter((owner) => owner !== currentOwner);
        localStorage.setItem("toss_received_owners", JSON.stringify(receivedOwnersRef.current));
      }
      await updateDoc(doc(db, "links", currentId), {
        status: "waiting",
        takenBy: null,
        takenAt: null
      });
    }
    await resetDisplay();
  };

  const showLinkDisplay = (url: string) => {
    setCurrentLinkUrl(url);
    setIsLinkDisplay(true);
    setCountdown(5);
    setIsUrgent(false);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        const next = prev - 1;
        if (next <= 2) setIsUrgent(true);
        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          void returnLink();
          return 0;
        }
        return next;
      });
    }, 1000);
  };

  const receiveLink = async () => {
    setIsReceiving(true);
    setReceiveAlert(null);

    const waitingSnap = await getDocs(query(collection(db, "links"), where("status", "==", "waiting"), limit(100)));
    const candidates = waitingSnap.docs
      .filter((item) => {
        const data = item.data() as LinkDoc;
        return data.owner !== myNickname && !receivedOwnersRef.current.includes(data.owner);
      })
      .sort((a, b) => {
        const aData = a.data() as LinkDoc;
        const bData = b.data() as LinkDoc;
        return (aData.createdAt ?? Number.MAX_SAFE_INTEGER) - (bData.createdAt ?? Number.MAX_SAFE_INTEGER);
      });

    let picked: { id: string; url: string; owner: string } | null = null;

    for (const candidate of candidates) {
      try {
        const claimed = await runTransaction(db, async (tx) => {
          const ref = doc(db, "links", candidate.id);
          const snap = await tx.get(ref);
          if (!snap.exists()) throw new Error("NOT_FOUND");
          const data = snap.data() as LinkDoc;
          if (data.status !== "waiting") throw new Error("NOT_WAITING");
          tx.update(ref, {
            status: "taken",
            takenBy: myNickname,
            takenAt: Date.now()
          });
          return { id: candidate.id, url: data.url, owner: data.owner };
        });
        picked = claimed;
        break;
      } catch {
        // 다른 사용자가 먼저 점유한 경우 다음 후보를 시도합니다.
      }
    }

    if (!picked) {
      showAlert(setReceiveAlert, "지금 받을 수 있는 링크가 없어요.", "info");
      setIsReceiving(false);
      await refreshCount();
      return;
    }

    currentLinkIdRef.current = picked.id;
    currentLinkOwnerRef.current = picked.owner;
    if (!receivedOwnersRef.current.includes(picked.owner)) {
      receivedOwnersRef.current.push(picked.owner);
      localStorage.setItem("toss_received_owners", JSON.stringify(receivedOwnersRef.current));
    }

    showLinkDisplay(picked.url);
  };

  const openReceivedLink = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const currentId = currentLinkIdRef.current;
    if (currentId) {
      await updateDoc(doc(db, "links", currentId), { status: "used" });
    }
    setTimeout(() => {
      void resetDisplay();
    }, 500);
  };

  return (
    <>
      <div id="app">
        <div id="nickname-screen" style={{ display: screen === "nickname" ? "flex" : "none" }}>
          <h2>토스 아이디 링크 보드</h2>
          <p>
            닉네임을 설정하고 시작해요
            <br />한 번 정하면 다른 사람이 못 써요
          </p>
          <input
            type="text"
            id="nick-input"
            placeholder="닉네임 입력 (최대 10자)"
            maxLength={10}
            value={nickInput}
            onChange={(e) => setNickInput(e.target.value)}
          />
          <div id="nick-error">{nickError}</div>
          <button className="start-btn" onClick={setNickname}>
            시작하기
          </button>
        </div>

        <div id="main-screen" style={{ display: screen === "main" ? "block" : "none" }}>
          <div className="topbar">
            <h1>토스 아이디 링크 보드</h1>
            <div className="topbar-right">
              <div className="user">
                나: <span id="my-nick-display">{myNickname}</span>
              </div>
              <button className="help-btn" onClick={() => setShowGuide(true)}>
                사용방법
              </button>
            </div>
          </div>

          <div className="section">
            <div style={{ height: "14px" }} />

            <div className="stat-single" onClick={() => void refreshCount()}>
              <div className="num" id="pool-count">
                {poolCount}
              </div>
              <div className="lbl">개의 링크 대기 중</div>
              <div className="refresh">↻</div>
            </div>

            <div className="card">
              <div className="card-title">내 링크 올리기</div>
              <div className="paste-box" onClick={() => void pasteAndUpload()}>
                <div className="icon">📋</div>
                <div className="hint">여기를 터치하면 바로 붙여넣고 올려집니다</div>
                <div className="sub">카카오톡 메시지 전체 복사도 OK</div>
              </div>
              <button
                className="requeue-btn"
                id="requeue-btn"
                style={{ display: showRequeue ? "block" : "none" }}
                onClick={() => void requeueMyLink()}
              >
                🔄 내 링크 대기열 맨 앞으로 다시 올리기
              </button>
              <div id="upload-status">
                {uploadAlert ? <div className={`alert alert-${uploadAlert.type}`}>{uploadAlert.message}</div> : null}
              </div>
            </div>
            <div id="receive-wrap" style={{ display: receiveWrapHidden ? "none" : "block" }}>
              <div id="receive-alert">
                {receiveAlert ? <div className={`alert alert-${receiveAlert.type}`}>{receiveAlert.message}</div> : null}
              </div>
              <button id="receive-btn" onClick={() => void receiveLink()} disabled={isReceiving}>
                다음 링크 받기
              </button>
            </div>

            <div id="link-display" style={{ display: isLinkDisplay ? "block" : "none" }}>
              <div className="link-card">
                <div className="label">받은 링크</div>
                <div className="link-url-box" id="received-url">
                  {currentLinkUrl}
                </div>
                <div className="timer-wrap">
                  <div className={`timer ${isUrgent ? "urgent" : ""}`} id="countdown">
                    {countdown}
                  </div>
                  <div className="timer-sub">초 안에 누르지 않으면 자동 반납돼요</div>
                </div>
                <a
                  id="open-link-btn"
                  href={currentLinkUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="open-btn"
                  onClick={() => void openReceivedLink()}
                >
                  토스에서 열기 →
                </a>
                <button className="return-btn" onClick={() => void returnLink()}>
                  반납하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showGuide ? (
        <div className="overlay" id="guide-overlay" onClick={(e) => e.target === e.currentTarget && setShowGuide(false)}>
          <div className="popup">
            <div className="popup-header">
              <h2>사용방법</h2>
              <button className="popup-close" onClick={() => setShowGuide(false)}>
                ✕
              </button>
            </div>
            <div className="guide-step">
              <div className="guide-num">1</div>
              <div className="guide-content">
                <div className="title">토스에서 내 링크 복사하기</div>
                <div className="desc">토스 앱에서 아이디 링크를 만들고 복사해요. 카카오톡으로 받은 메시지 전체를 복사해도 돼요!</div>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-num">2</div>
              <div className="guide-content">
                <div className="title">📋 박스 터치하면 바로 올라가요</div>
                <div className="desc">복사한 상태에서 박스를 터치해요. 권한 허용 팝업이 뜨면 반드시 허용을 눌러주세요!</div>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-num">3</div>
              <div className="guide-content">
                <div className="title">빨간 버튼으로 남의 링크 받기</div>
                <div className="desc">버튼을 누르면 다른 사람 링크 1개가 나한테만 와요. 받으면 5초 안에 눌러야 해요!</div>
              </div>
            </div>
            <div className="guide-step">
              <div className="guide-num">4</div>
              <div className="guide-content">
                <div className="title">반복하면 응모 티켓이 쌓여요</div>
                <div className="desc">토스에서 새 링크 만들고 → 올리고 → 받기. 이걸 반복하면 돼요!</div>
              </div>
            </div>
            <hr className="guide-divider" />
            <div className="notice-box">
              <div className="notice-item">⚡ 동시에 눌러도 딱 1명만 받을 수 있어요</div>
              <div className="notice-item">🚫 한 사람 링크는 딱 1번만 받을 수 있어요</div>
              <div className="notice-item">⏱️ 5초 안에 안 누르면 자동으로 반납돼요</div>
              <div className="notice-item">🔗 토스 링크(toss.me)만 올릴 수 있어요</div>
              <div className="notice-item">🔄 내 링크를 대기열 맨 앞으로 다시 올릴 수 있어요</div>
            </div>
            <button className="dont-show-btn" onClick={dontShowAgain}>
              다시 보지 않기
            </button>
            <button className="close-only-btn" onClick={() => setShowGuide(false)}>
              닫기
            </button>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f7; color: #1a1a1a; min-height: 100vh; }
        #app { max-width: 480px; margin: 0 auto; padding: 0 0 40px; }
        #nickname-screen, #main-screen { display: none; }
        .topbar { background: #fff; border-bottom: 1px solid #e8e8e8; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
        .topbar h1 { font-size: 16px; font-weight: 600; }
        .topbar-right { display: flex; align-items: center; gap: 10px; }
        .topbar .user { font-size: 12px; color: #888; }
        .topbar .user span { color: #0064ff; font-weight: 700; }
        .help-btn { background: none; border: 1px solid #e0e0e0; border-radius: 20px; padding: 4px 10px; font-size: 12px; color: #888; cursor: pointer; }
        .section { padding: 16px 16px 0; }
        .card { background: #fff; border-radius: 16px; padding: 16px; margin-bottom: 12px; border: 1px solid #ececec; }
        .card-title { font-size: 12px; color: #888; font-weight: 600; margin-bottom: 10px; letter-spacing: 0.03em; }
        .paste-box { width: 100%; min-height: 72px; border-radius: 12px; border: 1.5px dashed #9ec0ff; background: #f3f7ff; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; padding: 16px; user-select: none; }
        .paste-box:active { background: #e8f0ff; border-color: #0064ff; transform: scale(0.98); }
        .paste-box .icon { font-size: 22px; margin-bottom: 6px; }
        .paste-box .hint { font-size: 13px; color: #0064ff; font-weight: 600; text-align: center; line-height: 1.5; }
        .paste-box .sub { font-size: 11px; color: #bbb; margin-top: 3px; text-align: center; }
        .requeue-btn { width: 100%; height: 40px; border-radius: 10px; background: #fff; border: 1px solid #ddd; color: #555; font-size: 13px; cursor: pointer; margin-top: 8px; display: none; }
        .requeue-btn:active { background: #f5f5f5; transform: scale(0.98); }
        .stat-single { background: #fff; border-radius: 14px; padding: 14px 16px; text-align: center; border: 1px solid #ececec; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
        .stat-single .num { font-size: 22px; font-weight: 700; color: #0064ff; }
        .stat-single .lbl { font-size: 13px; color: #888; }
        .stat-single .refresh { font-size: 12px; color: #ccc; margin-left: 4px; }
        .alert { border-radius: 10px; padding: 11px 14px; font-size: 13px; margin-bottom: 12px; line-height: 1.6; margin-top: 8px; }
        .alert-success { background: #e8faf0; color: #1a7a45; }
        .alert-danger { background: #fff0f0; color: #c0392b; }
        .alert-info { background: #eef4ff; color: #2355b0; }
        .alert-warning { background: #fff8e8; color: #b07800; }
        #receive-btn { width: 100%; height: 64px; border-radius: 16px; font-size: 18px; font-weight: 700; background: #0064ff; color: #fff; border: none; cursor: pointer; transition: all 0.15s; box-shadow: 0 4px 16px rgba(0,100,255,0.28); margin-bottom: 12px; }
        #receive-btn:active { transform: scale(0.97); }
        #receive-btn:disabled { background: #ccc; box-shadow: none; cursor: not-allowed; }
        .link-card { background: #fff; border-radius: 16px; padding: 20px 16px; border: 2px solid #0064ff; margin-bottom: 12px; }
        .link-card .label { font-size: 13px; color: #888; margin-bottom: 8px; }
        .link-url-box { font-size: 13px; color: #555; word-break: break-all; background: #f7f7f7; padding: 10px 12px; border-radius: 8px; margin-bottom: 14px; }
        .timer-wrap { text-align: center; margin-bottom: 14px; }
        .timer { font-size: 48px; font-weight: 700; color: #1a1a1a; line-height: 1; }
        .timer.urgent { color: #0064ff; }
        .timer-sub { font-size: 12px; color: #999; margin-top: 4px; }
        .open-btn { display: block; width: 100%; height: 52px; line-height: 52px; text-align: center; background: #0064ff; color: #fff; border-radius: 12px; font-size: 16px; font-weight: 700; text-decoration: none; margin-bottom: 10px; }
        .return-btn { width: 100%; height: 42px; border-radius: 10px; background: #f5f5f5; color: #888; border: none; font-size: 14px; cursor: pointer; }
        #nickname-screen { min-height: 100vh; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; background: #f5f5f7; }
        #nickname-screen h2 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
        #nickname-screen p { font-size: 14px; color: #888; margin-bottom: 24px; text-align: center; line-height: 1.6; }
        #nickname-screen input { width: 100%; max-width: 320px; height: 48px; border-radius: 12px; border: 1.5px solid #e0e0e0; padding: 0 16px; font-size: 16px; outline: none; }
        #nickname-screen input:focus { border-color: #0064ff; }
        .start-btn { width: 100%; max-width: 320px; height: 48px; border-radius: 12px; background: #0064ff; color: #fff; border: none; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 12px; }
        #nick-error { color: #c0392b; font-size: 13px; margin-top: 8px; min-height: 18px; text-align: center; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: flex-end; justify-content: center; }
        .popup { background: #fff; border-radius: 24px 24px 0 0; padding: 24px 20px 36px; width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto; }
        .popup-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .popup-header h2 { font-size: 18px; font-weight: 700; }
        .popup-close { background: #f0f0f0; border: none; border-radius: 50%; width: 30px; height: 30px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .guide-step { display: flex; gap: 14px; margin-bottom: 18px; align-items: flex-start; }
        .guide-num { width: 28px; height: 28px; min-width: 28px; border-radius: 50%; background: #0064ff; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
        .guide-content .title { font-size: 15px; font-weight: 600; margin-bottom: 3px; }
        .guide-content .desc { font-size: 13px; color: #777; line-height: 1.6; }
        .guide-divider { border: none; border-top: 1px solid #f0f0f0; margin: 20px 0; }
        .notice-box { background: #f7f7f7; border-radius: 12px; padding: 14px; margin-bottom: 20px; }
        .notice-item { display: flex; gap: 8px; font-size: 13px; color: #555; margin-bottom: 8px; line-height: 1.5; }
        .notice-item:last-child { margin-bottom: 0; }
        .dont-show-btn { width: 100%; height: 48px; border-radius: 12px; background: #1a1a1a; color: #fff; border: none; font-size: 15px; font-weight: 600; cursor: pointer; margin-bottom: 8px; }
        .close-only-btn { width: 100%; height: 42px; border-radius: 12px; background: #f5f5f5; color: #888; border: none; font-size: 14px; cursor: pointer; }
      `}</style>
    </>
  );
}

