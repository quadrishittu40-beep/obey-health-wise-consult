const crypto=require("crypto");
function json(res,status,body){res.setHeader("Content-Type","application/json");res.status(status).send(JSON.stringify(body));}
function authorised(req){const expected=process.env.ADMIN_ACCESS_KEY;const supplied=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");if(!expected||!supplied)return false;const a=Buffer.from(expected),b=Buffer.from(supplied);return a.length===b.length&&crypto.timingSafeEqual(a,b);}
module.exports=async function handler(req,res){
 if(!["GET","PATCH"].includes(req.method)){res.setHeader("Allow","GET, PATCH");return json(res,405,{error:"Method not allowed"});}
 if(!process.env.ADMIN_ACCESS_KEY)return json(res,503,{error:"Admin access is not configured."});
 if(!authorised(req))return json(res,401,{error:"Unauthorised"});
 const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!secret)return json(res,503,{error:"Database is not configured."});
 const base=url.replace(/\/$/,"");
 try{
  if(req.method==="GET"){const r=await fetch(`${base}/rest/v1/service_requests?select=reference,name,phone,email,service,preferred_date,preferred_time,location,notes,status,created_at&order=created_at.desc&limit=100`,{headers:{apikey:secret,Authorization:`Bearer ${secret}`}});if(!r.ok)return json(res,502,{error:"Could not load requests."});return json(res,200,{requests:await r.json()});}
  let body=req.body;if(typeof body==="string"){try{body=JSON.parse(body)}catch{return json(res,400,{error:"Invalid request data."});}}
  const reference=typeof body?.reference==="string"?body.reference.trim().slice(0,60):"",status=body?.status;
  if(!reference||!["new","contacted","scheduled","completed","cancelled"].includes(status))return json(res,400,{error:"A valid request reference and status are required."});
  const r=await fetch(`${base}/rest/v1/service_requests?reference=eq.${encodeURIComponent(reference)}`,{method:"PATCH",headers:{apikey:secret,Authorization:`Bearer ${secret}`,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({status})});
  if(!r.ok)return json(res,502,{error:"Could not update the request."});const rows=await r.json();if(!rows.length)return json(res,404,{error:"Request not found."});return json(res,200,{ok:true,request:rows[0]});
 }catch(e){console.error("Admin API error",e.message);return json(res,500,{error:"Server error."});}
};