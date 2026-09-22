import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(s: string) {
  return s.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}

function addCandidate(out: string[], value: unknown) {
  if (typeof value !== "string") return;
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length >= 25 && text.length <= 1000) out.push(text);
}

function extractReviewLikeText(html: string): string[] {
  const out: string[] = [];
  const jsonLdMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of jsonLdMatches) {
    const raw = block.replace(/<script[^>]*>|<\/script>/gi, "");
    try {
      const data = JSON.parse(raw);
      const walk = (v: any) => {
        if (!v || typeof v !== "object") return;
        if (Array.isArray(v)) return v.forEach(walk);
        if (v.reviewBody) addCandidate(out, v.reviewBody);
        if (v.description && (v.author || v.ratingValue || v.reviewRating)) addCandidate(out, v.description);
        Object.values(v).forEach(walk);
      };
      walk(data);
    } catch { /* ignore malformed JSON-LD */ }
  }

  const text = cleanText(html);
  const chunks = text.split(/(?<=[.!?])\s+/).map(s => s.trim());
  chunks.filter(s => s.length >= 30 && s.length <= 700)
    .filter(s => !/^(sign in|login|add to cart|buy now|home|menu|privacy policy|terms|share|wishlist)/i.test(s))
    .slice(0, 100).forEach(s => addCandidate(out, s));

  return out.filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 50);
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || !/^https?:\/\//i.test(url)) return NextResponse.json({ reviews: [], error: "Enter a valid http(s) product URL." }, { status: 400 });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 ReviewLensAI/1.0" },
        redirect: "follow",
        signal: controller.signal,
        cache: "no-store"
      });
      if (!res.ok) return NextResponse.json({ reviews: [], source: "URL fetch blocked or unavailable", note: "This marketplace did not allow public review access. Upload a review screenshot instead." });
      const html = await res.text();
      const reviews = extractReviewLikeText(html);
      return NextResponse.json({
        reviews,
        source: reviews.length ? "Public page extraction" : "No review text extracted",
        note: "Marketplace pages may block automated access. If no reviews are exposed publicly, use Screenshot or Reviews mode."
      });
    } finally { clearTimeout(timer); }
  } catch (error: any) {
    return NextResponse.json({ reviews: [], source: "URL fetch unavailable", note: error?.name === "AbortError" ? "The product page took too long to respond. Upload a review screenshot instead." : "The product page could not be read automatically." });
  }
}
