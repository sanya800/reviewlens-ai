import { mlFakeRisk } from './nlp-model';
export type Review={text:string;rating?:number;verified?:boolean;source?:string};
export type AspectResult={aspect:string;sentiment:'Positive'|'Neutral'|'Negative';score:number;evidence:string[]};

const aspects:Record<string,string[]> = {
  'Design & Appearance':['design','look','looks','appearance','beautiful','pretty','attractive','aesthetic','colour','color','finish','pattern','shape','style','decor','decoration','ornament','cute','elegant'],
  'Material & Build':['material','metal','wood','plastic','brass','steel','ceramic','glass','stone','quality','build','solid','sturdy','durable','fragile','finish'],
  'Size & Dimensions':['size','small','large','big','tiny','height','width','length','dimension','dimensions','compact','heavy','lightweight','weight'],
  'Functionality':['works','working','function','functionality','feature','features','useful','practical','effective','purpose','use','usable'],
  'Value for Money':['price','cost','worth','value','money','affordable','expensive','overpriced','budget'],
  'Packaging':['packaging','package','packed','packing','box','wrapped','wrapping','protection'],
  'Delivery':['delivery','delivered','shipping','courier','arrived','arrival','late','delay','delayed'],
  'Durability':['durability','durable','lasts','lasting','long lasting','break','broken','crack','cracked','wear','damage','damaged'],
  'Comfort & Ease':['comfortable','comfort','easy','difficult','convenient','ergonomic','soft','hard'],
  'Effectiveness & Results':['effective','effectiveness','result','results','benefit','benefits','improvement','outcome'],
  'Authenticity':['original','genuine','authentic','duplicate','copy','fake','counterfeit'],
  'Customer Service':['seller','support','service','refund','return','replacement','response','customer care'],
  'Taste & Quality':['taste','flavour','flavor','fresh','smell','scent','ingredients','texture'],
  'Battery':['battery','backup','charging','charge','battery life'],
  'Camera':['camera','photos','pictures','selfie','video','portrait','night mode'],
  'Display':['display','screen','amoled','oled','brightness','colors','colour','refresh rate'],
  'Performance':['performance','processor','gaming','multitasking','speed','lag','slow','heating','overheating','crash'],
  'Sound':['sound','speaker','audio','bass','volume','mic','microphone'],
  'Fabric':['fabric','cloth','stitching','seam','cotton','linen','denim','material']
};

// Important: an aspect is displayed ONLY when one of its terms occurs in the
// supplied review text. There are no default phone/clothing aspects.
const pos=['good','great','excellent','amazing','awesome','love','best','smooth','fast','worth','perfect','happy','satisfied','recommend','nice','super','beautiful','effective','useful','genuine','original','fresh','comfortable','durable','sturdy'];
const neg=['bad','poor','worst','hate','slow','broken','fake','fraud','terrible','disappointed','waste','issue','problem','damaged','lag','overheating','not worth','ineffective','useless','ugly','fragile'];
function count(t:string, arr:string[]){const x=t.toLowerCase();return arr.reduce((n,w)=>n+(x.includes(w)?1:0),0)}
function sentiment(t:string){const p=count(t,pos),n=count(t,neg);return p>n?'Positive':n>p?'Negative':'Neutral' as const}
export function analyzeReview(text:string):AspectResult[]{
 const out:AspectResult[]=[];
 const sentences=text.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
 const lower=text.toLowerCase();
 const hasTerm=(source:string,term:string)=>{
   const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   return new RegExp('\\b'+escaped.replace(/\\s+/g,'\\\\s+')+'\\b','i').test(source);
 };
 for(const [name,keys] of Object.entries(aspects)){
   const matched=keys.filter(k=>hasTerm(lower,k));
   if(!matched.length) continue;
   const ev=sentences.filter(s=>matched.some(k=>hasTerm(s.toLowerCase(),k))).slice(0,2);
   const evidenceText=ev.join(' ')||text;
   const s=sentiment(evidenceText);
   const p=count(evidenceText,pos), n=count(evidenceText,neg);
   out.push({aspect:name,sentiment:s,score:Math.max(5,Math.min(95,50+(p-n)*18)),evidence:ev});
 }
 return out;
}
export function fakeRisk(review:Review,all:Review[]){
 const ml=mlFakeRisk(review.text); const duplicate=all.filter(r=>r.text.trim().toLowerCase()===review.text.trim().toLowerCase()).length>1;
 let p=ml.fakeProbability; const reasons=[...ml.signals]; if(duplicate){p=Math.min(99,p+25);reasons.push('Duplicate review text detected.')} if(review.verified===false){p=Math.min(99,p+5);reasons.push('Review is marked unverified.')}
 return {label:p>=70?'High risk':p>=40?'Needs review':'Low risk',probability:p,reasons};
}
export function overallAnalysis(reviews:Review[]){
 const valid=reviews.filter(r=>r.text.trim()); const text=valid.map(r=>r.text).join(' '); const a=analyzeReview(text); const sentiments=valid.map(r=>sentiment(r.text));
 const positive=sentiments.filter(x=>x==='Positive').length,negative=sentiments.filter(x=>x==='Negative').length,neutral=valid.length-positive-negative;
 const risks=valid.map(r=>fakeRisk(r,valid)); const avg=valid.length?risks.reduce((s,r)=>s+r.probability,0)/valid.length:100; const trust=Math.max(0,Math.round(100-avg));
 const verdict=valid.length<3?'Limited review evidence — add more reviews for a stronger decision':trust>=75&&positive>=negative?'Generally trustworthy and worth considering':trust>=55?'Consider carefully — mixed signals':'High caution — review signals look unreliable';
 return {totalReviews:valid.length,positive,neutral,negative,trustScore:trust,verdict,aspects:a,reviewRisks:risks,recommendation:recommendation(a,trust,positive,negative),highRisk:risks.filter(r=>r.label==='High risk').length};
}
function recommendation(a:AspectResult[],trust:number,p:number,n:number){const bad=a.filter(x=>x.sentiment==='Negative').map(x=>x.aspect),good=a.filter(x=>x.sentiment==='Positive').map(x=>x.aspect);const notes:string[]=[];if(bad.length)notes.push(`Main concern: ${bad.slice(0,3).join(', ')}.`);if(good.length)notes.push(`Strong areas: ${good.slice(0,3).join(', ')}.`);if(trust<55)notes.push('Verify the product using additional sources before buying.');else if(n>p)notes.push('Negative feedback outweighs positive feedback in the supplied reviews.');else notes.push('Evidence is mostly positive; still check price, warranty and return policy.');return notes.join(' ')}
