const DEFAULT_BLOCKED_TERMS = [
  "porn","pornography","xxx","rape","kill yourself","terrorist",
  "child porn","csam","incest","nazi","genocide"
] as const;

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\u0000-\u001f]/g," ").replace(/[\p{P}\p{S}]+/gu," ").replace(/\s+/g," ").trim();
}

function containsBlockedTerm(text: string) {
  const normalized=normalize(text);
  return DEFAULT_BLOCKED_TERMS.some(term => normalized.includes(normalize(term)));
}

export type ModerationResult = {
  allowed: boolean;
  blocked: boolean;
  reason: "blocked_term" | "toxicity" | "provider_error" | "ok";
  toxicityScore: number | null;
};

async function perspectiveScore(text: string): Promise<number | null> {
  const key=process.env.PERSPECTIVE_API_KEY?.trim();
  if(!key) return null;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try {
    const response=await fetch(`https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${encodeURIComponent(key)}`,{
      method:"POST",
      headers:{"content-type":"application/json"},
      signal:controller.signal,
      body:JSON.stringify({
        comment:{text},
        languages:["en"],
        requestedAttributes:{TOXICITY:{}}
      })
    });
    if(!response.ok) throw new Error(`Perspective API returned ${response.status}`);
    const data=await response.json() as {attributeScores?:{TOXICITY?:{summaryScore?:{value?:number}}}};
    const score=data.attributeScores?.TOXICITY?.summaryScore?.value;
    return typeof score==="number" && Number.isFinite(score) ? score : null;
  } finally { clearTimeout(timeout); }
}

export async function moderateText(parts: string[]): Promise<ModerationResult> {
  const text=parts.map(v=>v.trim()).filter(Boolean).join("\n").slice(0,12000);
  if(!text) return {allowed:true,blocked:false,reason:"ok",toxicityScore:null};
  if(containsBlockedTerm(text)) return {allowed:false,blocked:true,reason:"blocked_term",toxicityScore:null};

  try {
    const score=await perspectiveScore(text);
    if(score !== null && score > 0.8) return {allowed:false,blocked:true,reason:"toxicity",toxicityScore:score};
    if(process.env.PERSPECTIVE_API_KEY && score === null) {
      return {allowed:false,blocked:true,reason:"provider_error",toxicityScore:null};
    }
    return {allowed:true,blocked:false,reason:"ok",toxicityScore:score};
  } catch {
    if(process.env.PERSPECTIVE_API_KEY) return {allowed:false,blocked:true,reason:"provider_error",toxicityScore:null};
    return {allowed:true,blocked:false,reason:"ok",toxicityScore:null};
  }
}
