import { NextRequest, NextResponse } from "next/server";

function cleanText(s: string) {
  return s.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractReviewLikeText(html: string): string[] {
  const text = cleanText(html);
  const chunks = text.split(/(?<=[.!?])\s+/).map(s => s.trim());
  // Do not assume the product is a phone. Keep sentence candidates broad and
  // let the NLP layer discover which aspects are actually present.
  return chunks
    .filter(s => s.length >= 30 && s.length <= 700)
    .filter(s => !/^(sign in|login|add to cart|buy now|home|menu|privacy policy|terms)/i.test(s))
    .slice(0, 50);
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ reviews: [], error: "Enter a valid http(s) product URL." }, { status: 400 });
    }

    // Important: this route only attempts a normal public fetch. It does not bypass
    // anti-bot systems or restricted platform endpoints. If a marketplace blocks the
    // request, the UI falls back to manual review text / screenshot OCR.
    const res = await fetch(url, {
      headers: { "User-Agent": "ReviewLensAI/1.0 (research prototype)" },
      redirect: "follow",
      next: { revalidate: 0 }
    });
    if (!res.ok) return NextResponse.json({ reviews: [], source: "URL fetch blocked or unavailable" });
    const html = await res.text();
    const reviews = extractReviewLikeText(html);
    return NextResponse.json({
      reviews,
      source: reviews.length ? "Public page extraction" : "No review text extracted",
      note: "Marketplace pages may block automated access. Use a screenshot or paste reviews when this happens."
    });
  } catch {
    return NextResponse.json({ reviews: [], source: "URL fetch unavailable" });
  }
}