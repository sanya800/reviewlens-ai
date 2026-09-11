'use client';
import { pipeline, type TextClassificationPipeline } from '@huggingface/transformers';
let classifier: Promise<TextClassificationPipeline>|null=null;
export async function transformerSentiment(text:string){
  if(!classifier) classifier=pipeline('sentiment','Xenova/distilbert-base-uncased-finetuned-sst-2-english') as Promise<TextClassificationPipeline>;
  const pipe=await classifier; const out=await pipe(text,{top_k:null});
  const rows=Array.isArray(out)?out:[]; const best=rows.sort((a:any,b:any)=>b.score-a.score)[0] as any;
  if(!best)return null; return {label:String(best.label).toUpperCase().includes('POS')?'Positive':'Negative' as 'Positive'|'Negative',score:Number(best.score)};
}
