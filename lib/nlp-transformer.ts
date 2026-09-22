'use client';

import { pipeline } from '@huggingface/transformers';

let classifier: any = null;

export async function transformerSentiment(text: string) {
  try {
    if (!classifier) {
      classifier = await pipeline(
        'text-classification',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
      );
    }

    const output = await classifier(text, { top_k: null });
    const rows = Array.isArray(output) ? output : [];
    const best = rows
      .slice()
      .sort((a: any, b: any) => Number(b.score) - Number(a.score))[0];

    if (!best) return null;

    return {
      label: String(best.label).toUpperCase().includes('POS') ? 'Positive' : 'Negative',
      score: Number(best.score)
    } as { label: 'Positive' | 'Negative'; score: number };
  } catch (error) {
    console.error('Transformer sentiment error:', error);
    return null;
  }
}
