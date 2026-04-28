import { load } from "cheerio";
import { NextRequest, NextResponse } from "next/server";
import { isMaintenanceMode } from "@/lib/maintenance";

function normalizeUrl(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

function pickMeta($: ReturnType<typeof load>, selectors: string[]) {
  for (const selector of selectors) {
    const value = $(selector).attr("content")?.trim();
    if (value) return value;
  }
  return null;
}

export async function GET(req: NextRequest) {
  // 점검모드면 서버에서 즉시 차단(클라이언트 우회 방지)
  const maintenance = await isMaintenanceMode({ ttlMs: 5000 });
  if (maintenance) {
    return NextResponse.json(
      { error: "현재 점검 중입니다. 나중에 다시 오세요!" },
      { status: 503, headers: { "Retry-After": "300" } }
    );
  }

  const urlParam = req.nextUrl.searchParams.get("url");
  const targetUrl = urlParam ? normalizeUrl(urlParam) : null;

  if (!targetUrl) {
    return NextResponse.json({ error: "올바른 URL이 아닙니다." }, { status: 400 });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
      }
    });

    if (!res.ok) {
      return NextResponse.json({ error: "링크 정보를 가져오지 못했습니다." }, { status: 400 });
    }

    const html = await res.text();
    const $ = load(html);
    const title =
      $("meta[property='og:title']").attr("content")?.trim() ||
      $("title").text().trim() ||
      targetUrl;
    const image = pickMeta($, [
      "meta[property='og:image']",
      "meta[name='twitter:image']",
      "meta[property='twitter:image']"
    ]);
    const domain = new URL(targetUrl).hostname.replace("www.", "");

    return NextResponse.json({
      title,
      image: image || null,
      domain,
      url: targetUrl
    });
  } catch {
    return NextResponse.json({ error: "링크 메타데이터를 읽는 중 오류가 발생했습니다." }, { status: 500 });
  }
}
