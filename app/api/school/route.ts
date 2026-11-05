export const runtime="nodejs";
export const revalidate=3600;
type Meal={date:string;items:string[]};type Event={date:string;name:string};
function koreanDate(s:string){return s.length===8?`${s.slice(4,6)}/${s.slice(6,8)}`:s;}
async function query(endpoint:string,params:Record<string,string>){const url=new URL(`https://open.neis.go.kr/hub/${endpoint}`);for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);const response=await fetch(url,{next:{revalidate:3600}});if(!response.ok)throw Error("NEIS unavailable");return response.json();}
export async function GET(){const key=process.env.NEIS_API_KEY,atpt=process.env.NEIS_ATPT_CODE,school=process.env.NEIS_SCHOOL_CODE;
 if(!key||!atpt||!school)return Response.json({meals:[],events:[],message:"학교 급식·일정 API가 아직 설정되지 않았습니다."});
 const date=new Date();const y=date.getFullYear();const m=String(date.getMonth()+1).padStart(2,"0");const d=String(date.getDate()).padStart(2,"0");const from=`${y}${m}${d}`;const next=new Date(date);next.setDate(next.getDate()+14);const until=`${next.getFullYear()}${String(next.getMonth()+1).padStart(2,"0")}${String(next.getDate()).padStart(2,"0")}`;
 const base={KEY:key,Type:"json",ATPT_OFCDC_SC_CODE:atpt,SD_SCHUL_CODE:school,AA_FROM_YMD:from,AA_TO_YMD:until,pSize:"100"};
 try{const [a,b]=await Promise.all([query("mealServiceDietInfo",base),query("SchoolSchedule",base)]);const meals:Meal[]=(a.mealServiceDietInfo?.[1]?.row||[]).filter((r:Record<string,string>)=>r.MMEAL_SC_CODE==="2").slice(0,7).map((r:Record<string,string>)=>({date:koreanDate(r.MLSV_YMD),items:(r.DDISH_NM||"").split(/<br\s*\/?\s*>/gi).map(v=>v.replace(/\([^)]*\)/g,"").trim()).filter(Boolean)}));const events:Event[]=(b.SchoolSchedule?.[1]?.row||[]).slice(0,10).map((r:Record<string,string>)=>({date:koreanDate(r.AA_YMD),name:r.EVENT_NM||"학사일정"}));return Response.json({meals,events,message:""},{headers:{"Cache-Control":"public, s-maxage=3600"}});}catch{return Response.json({meals:[],events:[],message:"나이스 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요."});}
}
