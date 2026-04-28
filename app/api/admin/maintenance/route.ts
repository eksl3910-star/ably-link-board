import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

type SettingsDoc = {
  isMaintenance: boolean;
  updatedAt: number;
};

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyAdminPassword(input: string) {
  const expected = process.env.ADMIN_TOGGLE_PASS || process.env.ADMIN_BASIC_PASS || "";
  if (!expected) return false;
  return safeEqual(input, expected);
}

function unauthorized() {
  return NextResponse.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
}

export async function POST(req: NextRequest) {
  let body: { password?: string; isMaintenance?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!verifyAdminPassword(password)) return unauthorized();

  if (typeof body.isMaintenance !== "boolean") {
    return NextResponse.json({ error: "isMaintenance 값이 필요합니다." }, { status: 400 });
  }

  const nextValue = body.isMaintenance;
  const payload: SettingsDoc = {
    isMaintenance: nextValue,
    updatedAt: Date.now()
  };

  try {
    await adminDb().doc("settings/global").set(payload, { merge: true });
    return NextResponse.json({ ok: true, isMaintenance: nextValue });
  } catch {
    return NextResponse.json({ error: "점검 모드 업데이트 중 오류가 발생했습니다." }, { status: 500 });
  }
}
