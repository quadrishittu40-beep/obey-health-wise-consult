const crypto=require("crypto");
const COOKIE="ohw_admin_session",TTL=8*60*60,STATUSES=["new","contacted","scheduled","completed","cancelled"];
function out(res,status,data){res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");return res.status(status).send(JSON.stringify(data));}
function eq(a,b){const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function sig(exp,secret){return crypto.createHmac("sha256",secret).update(exp).digest("hex");}
function body(req){if(typeof req.body!=="string")return req.body||{};try{return JSON.parse(req.body)}catch(_){return {};}}
function cookie(req){const x=(req.headers.cookie||"").split(";").map(v=>v.trim()).find(v=>v.startsWith(COOKIE+"="));return x?decodeURIComponent(x.slice(COOKIE.length+1)):"";}
function auth(req,secret){const p=cookie(req).split(".");return p.length===2&&/^\\d+$/.test(p[0])&&Number(p[0])>=Date.now()/1000&&eq(sig(p[0],secret),p[1]);}
module.exports=async(req,res)=>{
 const secret=process.env.ADMIN_ACCESS_KEY;if(!secret)return out(res,503,{error:"Admin access is not configured."});
 if(req.method==="POST"){const password=typeof body(req).password==="string"?body(req).password:"";if(!eq(secret,password))return out(res,401,{error:"Incorrect admin password."});const exp=String(Math.floor(Date.now()/1000)+TTL);res.setHeader("Set-Cookie",COOKIE+"="+encodeURIComponent(exp+"."+sig(exp,secret))+"; HttpOnly; Secure; SameSite=Strict; Path=/api/admin-requests; Max-Age="+TTL);return out(res,200,{ok:true});}
 if(req.method==="DELETE"){res.setHeader("Set-Cookie",COOKIE+"=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin-requests; Max-Age=0");return out(res,200,{ok:true});}
 if(!["GET","PATCH"].includes(req.method)){res.setHeader("Allow","GET, POST, PATCH, DELETE");return out(res,405,{error:"Method not allowed."});}
 if(!auth(req,secret))return out(res,401,{error:"Your admin session has expired. Please sign in again."});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return out(res,503,{error:"Database is not configured."});
 const base=url.replace(/\\/$/,""),headers={apikey:key,Authorization:"Bearer "+key};
 try{
  if(req.method==="GET"){const r=await fetch(base+"/rest/v1/service_requests?select=reference,name,phone,email,service,preferred_date,preferred_time,location,notes,status,created_at&order=created_at.desc&limit=200",{headers});if(!r.ok){console.error("Admin list failed",r.status,(await r.text()).slice(0,300));return out(res,502,{error:"Could not load service requests."});}return out(res,200,{requests:await r.json()});}
  const b=body(req),ref=typeof b.reference==="string"?b.reference.trim().slice(0,60):"";if(!ref||!STATUSES.includes(b.status))return out(res,400,{error:"A valid request reference and status are required."});
  const r=await fetch(base+"/rest/v1/service_requests?reference=eq."+encodeURIComponent(ref),{method:"PATCH",headers:{...headers,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({status:b.status})});if(!r.ok){console.error("Admin update failed",r.status,(await r.text()).slice(0,300));return out(res,502,{error:"Could not update the request."});}const rows=await r.json();if(!rows.length)return out(res,404,{error:"Request not found."});return out(res,200,{ok:true,request:rows[0]});
 }catch(e){console.error("Admin API error",e.message);return out(res,500,{error:"A server error occurred."});}
};
