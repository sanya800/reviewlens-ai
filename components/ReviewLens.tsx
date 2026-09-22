"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { overallAnalysis, Review } from "../lib/analyzer";
import { transformerSentiment } from "../lib/nlp-transformer";
import Tesseract from "tesseract.js";

type Mode = "product" | "reviews" | "screenshot";

export default function ReviewLens() {
  const [mode, setMode] = useState<Mode>("product");
  const [url, setUrl] = useState("");
  const [reviewsText, setReviewsText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ocr, setOcr] = useState("");
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [source, setSource] = useState("Manual reviews");
  const [result, setResult] = useState<ReturnType<typeof overallAnalysis> | null>(null);
  const [nlpStatus, setNlpStatus] = useState("Ready — TF-IDF ML + Transformer NLP");
  const [sentimentConfidence, setSentimentConfidence] = useState<number | null>(null);
  const [linkStatus, setLinkStatus] = useState("");
  const [imageName, setImageName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parsedReviews = useMemo<Review[]>(() => {
    return reviewsText
      .split(/\n+/)
      .map(x => x.trim())
      .filter(Boolean)
      .map(text => ({ text, source }));
  }, [reviewsText, source]);

  function switchMode(next: Mode) {
    setMode(next);
    setLinkStatus("");
    setResult(null);
  }

  async function handleImage(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setImageName(file.name);
    setOcrLoading(true);
    setOcr("");
    setResult(null);
    setLinkStatus("");
    try {
      const out = await Tesseract.recognize(file, "eng");
      const cleaned = cleanOcrText(out.data.text);
      setOcr(cleaned.displayText);
      if (cleaned.reviews.length) {
        setReviewsText(cleaned.reviews.slice(0, 20).join("\n"));
        setSource("OCR from product/review screenshot");
        setMode("screenshot");
      } else {
        setReviewsText("");
        setSource("OCR from screenshot");
      }
    } catch {
      setOcr("OCR could not read this image. Try a clearer screenshot with the review text zoomed in.");
    } finally {
      setOcrLoading(false);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    void handleImage(e.target.files?.[0]);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    void handleImage(e.dataTransfer.files?.[0]);
  }

  async function analyzeReviews(reviews: Review[]) {
    if (!reviews.length) {
      alert("Add reviews or upload a review screenshot first.");
      return;
    }
    setLoading(true);
    setNlpStatus("Running Transformer NLP sentiment model…");
    try {
      const base = overallAnalysis(reviews);
      const predictions = await Promise.all(reviews.map(r => transformerSentiment(r.text).catch(() => null)));
      const usable = predictions.filter(Boolean) as { label: "Positive" | "Negative"; score: number }[];
      if (usable.length) {
        base.positive = usable.filter(x => x.label === "Positive").length;
        base.negative = usable.filter(x => x.label === "Negative").length;
        base.neutral = Math.max(0, reviews.length - base.positive - base.negative);
        const confidence = Math.round((usable.reduce((a, x) => a + x.score, 0) / usable.length) * 100);
        setSentimentConfidence(confidence);
        base.recommendation += ` Transformer sentiment confidence: ${confidence}%.`;
      }
      setResult(base);
      setNlpStatus("NLP complete — Transformer sentiment + supervised TF-IDF fake-risk model");
    } catch {
      setResult(overallAnalysis(reviews));
      setNlpStatus("Fallback NLP analysis used");
    } finally {
      setLoading(false);
    }
  }

  async function analyze() {
    await analyzeReviews(parsedReviews);
  }

  async function analyzeUrl() {
    const value = url.trim();
    if (!value) return;
    let normalized = value;
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    try { new URL(normalized); } catch { setLinkStatus("Please enter a valid product URL."); return; }

    setLoading(true);
    setResult(null);
    setLinkStatus("Reading the public product page…");
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      const res = await fetch("/api/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
        signal: controller.signal
      });
      window.clearTimeout(timeout);
      const data = await res.json();
      if (data.reviews?.length) {
        const reviews: Review[] = data.reviews.map((text: string) => ({ text, source: data.source || "URL extraction" }));
        setReviewsText(data.reviews.join("\n"));
        setSource(data.source || "URL extraction");
        setLinkStatus(`${reviews.length} review${reviews.length === 1 ? "" : "s"} found. Running analysis…`);
        await analyzeReviews(reviews);
        setLinkStatus("");
      } else {
        setLinkStatus(data.note || "Reviews could not be read from this page. Try a review screenshot instead.");
      }
    } catch (error: any) {
      setLinkStatus(error?.name === "AbortError"
        ? "The product page took too long to respond. Upload a screenshot of its reviews instead."
        : "This product page could not be read automatically. Upload a review screenshot or paste the reviews.");
    } finally {
      setLoading(false);
    }
  }

  const r = result;

  return (
    <main className="page">
      <nav className="nav">
        <div className="brand"><span className="logo">R</span> ReviewLens <b>AI</b></div>
        <span className="tag">Buy smarter. Read beyond the stars.</span>
      </nav>

      <section className="hero">
        <div>
          <p className="eyebrow">AI PRODUCT DECISION ASSISTANT</p>
          <h1>Know whether a product is <span>actually worth it.</span></h1>
          <p className="sub">Paste a product link, upload a review screenshot, or add reviews. ReviewLens analyzes sentiment by aspect and flags review patterns that may need verification.</p>
        </div>
        <div className="hero-card"><div><div className="nlp-badge">● {nlpStatus}</div><div className="mini-score">87</div></div><div><strong>Example trust score</strong><small>Based on review signals</small></div></div>
      </section>

      <section className="input-card">
        <div className="tabs" role="tablist" aria-label="Review input method">
          {([['product','Product link'],['reviews','Reviews'],['screenshot','Screenshot']] as [Mode,string][]).map(([key,label]) => (
            <button key={key} className={mode === key ? "active" : ""} onClick={() => switchMode(key)}>{label}</button>
          ))}
        </div>

        {mode === "product" && <>
          <label>Product link</label>
          <div className="urlrow">
            <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void analyzeUrl(); }} placeholder="Paste Amazon / Flipkart / Meesho product link..." inputMode="url" />
            <button className="primary" onClick={analyzeUrl} disabled={loading || !url.trim()}>{loading ? "Reading…" : "Analyze link"}</button>
          </div>
          <p className="hint">Tip: On Flipkart, open the product page and use <b>Ctrl + L</b>, then <b>Ctrl + C</b> to copy the page link. Some marketplaces block automated review access; if that happens, use Screenshot.</p>
          {linkStatus && <div className="status">{linkStatus}</div>}
        </>}

        {mode === "reviews" && <>
          <label>Paste reviews — one review per line</label>
          <textarea value={reviewsText} onChange={e => setReviewsText(e.target.value)} placeholder="The material feels strong...\nThe design looks beautiful...\nThe size is perfect..." />
          <div className="actions"><span className="hint">{parsedReviews.length} review{parsedReviews.length === 1 ? "" : "s"} ready</span><button className="primary" onClick={analyze} disabled={loading || !parsedReviews.length}>{loading ? "Analyzing…" : "Run full analysis →"}</button></div>
        </>}

        {mode === "screenshot" && <>
          <label>Upload product/review screenshot</label>
          <div className="drop" onDragOver={e => e.preventDefault()} onDrop={onDrop} onClick={() => fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}>
            <div className="dropicon">↥</div>
            <strong>Drag & drop a screenshot here</strong>
            <span>or click to choose an image from your device</span>
            <small>Best results: crop the screenshot so review text is large and readable.</small>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} onClick={e => e.stopPropagation()} />
            {imageName && <div className="filename">{imageName}</div>}
            {imageUrl && <img src={imageUrl} className="preview" alt="Uploaded product review screenshot" />}
            {ocrLoading && <small className="loading-note">Reading screenshot with OCR…</small>}
          </div>
          <div className="actions"><span className="hint">{parsedReviews.length ? `${parsedReviews.length} review${parsedReviews.length === 1 ? "" : "s"} extracted` : "No review text extracted yet"}</span><button className="primary" onClick={analyze} disabled={loading || ocrLoading || !parsedReviews.length}>{loading ? "Analyzing…" : "Run full analysis →"}</button></div>
        </>}
      </section>

      {ocr && <details className="ocr" open><summary>OCR text detected</summary><pre>{ocr}</pre></details>}

      {r && <section className="results">
        <div className="result-head"><div><p className="eyebrow">ANALYSIS COMPLETE</p><h2>Product decision report</h2><p>{r.verdict}</p></div><div className="trust"><strong>{r.trustScore}</strong><span>/100<br/>trust score</span></div></div>
        <div className="stats"><Stat title="Reviews" value={r.totalReviews} /><Stat title="Positive" value={r.positive} /><Stat title="Neutral" value={r.neutral} /><Stat title="Negative" value={r.negative} /></div>
        <div className="grid">
          <div className="panel"><h3>Aspect-based sentiment</h3><div className="model-note">NLP: aspect extraction + Transformer sentiment classification{sentimentConfidence ? ` • avg confidence ${sentimentConfidence}%` : ""}</div><p className="muted">Only product areas actually mentioned in the supplied reviews are shown.</p>
            {r.aspects.length ? r.aspects.map(a => <div className="aspect" key={a.aspect}><div className="aspecttop"><strong>{a.aspect}</strong><span className={a.sentiment.toLowerCase()}>{a.sentiment}</span></div><div className="bar"><i style={{width:`${a.score}%`}} /></div>{a.evidence[0] && <small>“{a.evidence[0]}”</small>}</div>) : <p>No product-specific aspects were detected yet. Add more reviews, or upload a clearer product/review screenshot.</p>}
          </div>
          <div className="panel"><h3>Review authenticity signals</h3><div className="model-note">ML: TF-IDF features + supervised Logistic Regression</div><p className="muted">This is a risk heuristic, not proof that a review is fake.</p>
            {r.reviewRisks.slice(0, 6).map((x, i) => <div className="risk" key={i}><div><strong>Review {i+1}</strong><span className={x.label === "High risk" ? "risk-high" : x.label === "Needs review" ? "risk-medium" : "risk-low"}>{x.label}</span></div><div className="riskbar"><i style={{width:`${x.probability}%`}} /></div><small>{x.reasons.join(" ")}</small></div>)}
          </div>
        </div>
        <div className="decision"><div className="decision-icon">✓</div><div><p className="eyebrow">BUYING GUIDANCE</p><h3>{r.trustScore >= 75 ? "Looks reasonable to consider" : r.trustScore >= 55 ? "Consider with caution" : "High caution recommended"}</h3><p>{r.recommendation}</p></div></div>
      </section>}

      <footer>ReviewLens AI • NLP research project • Authenticity signals are probabilistic, not a guarantee.</footer>
    </main>
  );
}

function Stat({title, value}:{title:string;value:number}) { return <div className="stat"><span>{title}</span><strong>{value}</strong></div>; }

function cleanOcrText(raw: string) {
  const normalized = raw.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const metadataPatterns = [
    /^review\s*(for|by)?\s*:?/i, /^(finish|colour|color|number of shelves|shelves|size|style|variant|seller)\s*:/i,
    /^see more$/i, /^read more$/i, /^helpful$/i, /^report$/i, /^verified purchase$/i, /^certified buyer$/i,
    /^flipkart customer$/i, /^amazon customer$/i, /^customer review$/i, /^\d(?:\.\d)?\s*(out of 5|\/5)?$/i,
    /^\d+\s*ratings?$/i, /^\d+\s*reviews?$/i
  ];
  const lines = normalized.split(/\n+/).map(x => x.trim()).filter(Boolean);
  const content: string[] = [];
  let buffer = '';
  for (const line of lines) {
    if (metadataPatterns.some(re => re.test(line))) continue;
    const cleanedLine = line.replace(/^review\s*for\s*:\s*/i, '').replace(/^(finish|colour|color|number of shelves|shelves|size|style|variant)\s*[^|]{0,100}\|\s*/i, '').replace(/^\|\s*/, '').trim();
    if (!cleanedLine || cleanedLine.length < 8) continue;
    const startsNew = /^(review|very good|good|great|excellent|bad|worst|poor|nice|amazing|awesome|not worth|waste|disappointed)\b/i.test(cleanedLine) && buffer.length > 40;
    if (startsNew) { content.push(buffer.trim()); buffer = cleanedLine; } else buffer = buffer ? `${buffer} ${cleanedLine}` : cleanedLine;
    if (/[.!?]$/.test(cleanedLine) && buffer.length > 35) { content.push(buffer.trim()); buffer = ''; }
  }
  if (buffer.trim().length >= 20) content.push(buffer.trim());
  const reviews = content.map(x => x.replace(/\s+/g, ' ').trim()).filter(x => x.length >= 20).filter((x, i, arr) => arr.indexOf(x) === i);
  return { displayText: reviews.length ? reviews.join('\n\n') : normalized, reviews };
}
