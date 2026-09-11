 "use client";

import { useMemo, useState } from "react";
import { overallAnalysis, Review } from "../lib/analyzer";
import Tesseract from "tesseract.js";

export default function ReviewLens() {
  const [url, setUrl] = useState("");
  const [reviewsText, setReviewsText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ocr, setOcr] = useState("");
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [source, setSource] = useState("Manual reviews");
  const [result, setResult] = useState<ReturnType<typeof overallAnalysis> | null>(null);
  const [nlpStatus, setNlpStatus] = useState('Ready — TF-IDF ML + Transformer NLP');
  const [sentimentConfidence, setSentimentConfidence] = useState<number | null>(null);

  const parsedReviews = useMemo<Review[]>(() => {
    const lines = reviewsText.split(/\n+/).map(x => x.trim()).filter(Boolean);
    return lines.map(text => ({ text, source }));
  }, [reviewsText, source]);

  async function handleImage(file?: File) {
    if (!file) return;
    setImageUrl(URL.createObjectURL(file));
    setOcrLoading(true);
    try {
      const out = await Tesseract.recognize(file, "eng");
      setOcr(out.data.text);
      const useful = out.data.text.split(/\n+/).map(s => s.trim()).filter(s => s.length > 20);
      if (useful.length) setReviewsText(useful.slice(0, 20).join("\n"));
      setSource("OCR from product/review screenshot");
    } catch {
      setOcr("OCR could not read this image.");
    } finally {
      setOcrLoading(false);
    }
  }

  async function analyze() {
    if (!parsedReviews.length) { alert('Add reviews or upload a review screenshot first.'); return; }
    setLoading(true);
    setNlpStatus('Running Transformer NLP sentiment model…');
    try {
      const reviews = parsedReviews;
      const base = overallAnalysis(reviews);
      const predictions = await Promise.all(reviews.map(r => transformerSentiment(r.text).catch(() => null)));
      const usable = predictions.filter(Boolean) as {label:'Positive'|'Negative';score:number}[];
      if (usable.length) {
        base.positive = usable.filter(x => x.label === 'Positive').length;
        base.negative = usable.filter(x => x.label === 'Negative').length;
        base.neutral = Math.max(0, reviews.length - base.positive - base.negative);
        setSentimentConfidence(Math.round(usable.reduce((a,x)=>a+x.score,0)/usable.length*100));
        base.recommendation = base.recommendation + ` Transformer sentiment confidence: ${Math.round(usable.reduce((a,x)=>a+x.score,0)/usable.length*100)}%.`;
      }
      setResult(base);
      setNlpStatus('NLP complete — Transformer sentiment + supervised TF-IDF fake-risk model');
    } catch {
      setResult(overallAnalysis(parsedReviews));
      setNlpStatus('Fallback NLP analysis used');
    } finally { setLoading(false); }
  }

  async function analyzeUrl() {
    setLoading(true);
    try {
      const res = await fetch("/api/analyze-url", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.reviews?.length) {
        setReviewsText(data.reviews.join("\n"));
        setSource(data.source || "URL extraction");
        setResult(overallAnalysis(data.reviews.map((text: string) => ({text, source: data.source}))));
      } else {
        setReviewsText("");
        setResult(null);
        alert(data.note || "No reviews could be read from this product page. Upload a screenshot or paste the reviews to analyze them.");
      }
    } catch {
      setReviewsText("");
      setResult(null);
      alert("This product page could not be read automatically. Upload a screenshot or paste the reviews instead.");
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
          <p className="sub">Paste a product link, drop a screenshot, or add reviews. ReviewLens analyzes sentiment by aspect and flags review patterns that may need verification.</p>
        </div>
        <div className="hero-card"><div className="nlp-badge">● {nlpStatus}</div>
          <div className="mini-score">87</div>
          <div><strong>Example trust score</strong><small>Based on review signals</small></div>
        </div>
      </section>

      <section className="input-card">
        <div className="tabs"><button className="active">Product</button><button>Reviews</button><button>Screenshot</button></div>
        <label>Product link</label>
        <div className="urlrow">
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste Amazon / Flipkart / Meesho product link..." />
          <button className="primary" onClick={analyzeUrl} disabled={loading || !url}>Analyze link</button>
        </div>
        <div className="drop" onDragOver={e => e.preventDefault()}>
          <div className="dropicon">↥</div>
          <strong>Drag & drop a product/review screenshot</strong>
          <span>or choose an image from your device</span>
          <input type="file" accept="image/*" onChange={e => handleImage(e.target.files?.[0])} />
          {imageUrl && <img src={imageUrl} className="preview" alt="Uploaded product screenshot" />}
          {ocrLoading && <small>Reading screenshot with OCR…</small>}
        </div>
        <label>Or paste reviews — one review per line</label>
        <textarea value={reviewsText} onChange={e => setReviewsText(e.target.value)} placeholder="The material feels strong...\nThe design looks beautiful...\nThe size is perfect..." />
        <div className="actions"><button className="primary" onClick={analyze} disabled={loading}>{loading ? "Analyzing…" : "Run full analysis →"}</button></div>
      </section>

      {ocr && <details className="ocr"><summary>OCR text detected</summary><pre>{ocr}</pre></details>}

      {r && <section className="results">
        <div className="result-head"><div><p className="eyebrow">ANALYSIS COMPLETE</p><h2>Product decision report</h2><p>{r.verdict}</p></div><div className="trust"><strong>{r.trustScore}</strong><span>/100<br/>trust score</span></div></div>
        <div className="stats">
          <Stat title="Reviews" value={r.totalReviews} />
          <Stat title="Positive" value={r.positive} />
          <Stat title="Neutral" value={r.neutral} />
          <Stat title="Negative" value={r.negative} />
        </div>

        <div className="grid">
          <div className="panel"><h3>Aspect-based sentiment</h3><div className="model-note">NLP: aspect extraction + Transformer sentiment classification{sentimentConfidence ? ` • avg confidence ${sentimentConfidence}%` : ""}</div><p className="muted">Only product areas actually mentioned in the supplied reviews are shown.</p>
            {r.aspects.length ? r.aspects.map(a => <div className="aspect" key={a.aspect}><div className="aspecttop"><strong>{a.aspect}</strong><span className={a.sentiment.toLowerCase()}>{a.sentiment}</span></div><div className="bar"><i style={{width:`${a.score}%`}} /></div>{a.evidence[0] && <small>“{a.evidence[0]}”</small>}</div>) : <p>No product-specific aspects were detected yet. Add more reviews, or upload a clearer product/review screenshot.</p>}
          </div>
          <div className="panel"><h3>Review authenticity signals</h3><div className="model-note">ML: TF-IDF features + supervised Logistic Regression</div><p className="muted">This is a risk heuristic, not proof that a review is fake.</p>
            {r.reviewRisks.slice(0, 6).map((x, i) => <div className="risk" key={i}><div><strong>Review {i+1}</strong><span>{x.label}</span></div><div className="riskbar"><i style={{width:`${x.probability}%`}} /></div><small>{x.reasons.join(" ")}</small></div>)}
          </div>
        </div>

        <div className="decision"><div className="decision-icon">✓</div><div><p className="eyebrow">BUYING GUIDANCE</p><h3>{r.trustScore >= 75 ? "Looks reasonable to consider" : r.trustScore >= 55 ? "Consider with caution" : "High caution recommended"}</h3><p>{r.recommendation}</p></div></div>
      </section>}

      <footer>ReviewLens AI • NLP research project • Authenticity signals are probabilistic, not a guarantee.</footer>
    </main>
  );
}

function Stat({title, value}:{title:string;value:number}) {
  return <div className="stat"><span>{title}</span><strong>{value}</strong></div>
}