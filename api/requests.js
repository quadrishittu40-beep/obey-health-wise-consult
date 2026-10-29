function json(res,status,body){res.setHeader("Content-Type","application/json");res.status(status).send(JSON.stringify(body));}
function clean(v,max=500){return typeof v==="string"?v.trim().slice(0,max):"";}
module.exports=async function handler(req,res){
 if(req.method!=="POST"){res.setHeader("Allow","POST");return json(res,405,{error:"Method not allowed"});}
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=process.env;
 if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)return json(res,503,{error:"The request system has not been configured yet. Please contact the service administrator."});
 let body=req.body;if(typeof body==="string"){try{body=JSON.parse(body)}catch{return json(res,400,{error:"Invalid request data."});}}
 const name=clean(body?.name,100),phone=clean(body?.phone,25),email=clean(body?.email,150),service=clean(body?.service,100),date=clean(body?.date,10),time=clean(body?.time,40),location=clean(body?.location,180),notes=clean(body?.notes,500);
 if(!name||!phone||!service||!date||!location||body?.consent!==true)return json(res,400,{error:"Please complete all required fields and accept the contact consent."});
 if(!/^\+?[0-9\s()\-]{7,25}$/.test(phone))return json(res,400,{error:"Please enter a valid phone number."});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<new Date().toISOString().slice(0,10))return json(res,400,{error:"Please choose a valid date that is not in the past."});
 const reference="OHW-"+Date.now().toString(36).toUpperCase();
 const payload={reference,name,phone,email:email||null,service,preferred_date:date,preferred_time:time||"Any available time",location,notes:notes||null,status:"new"};
 try{const r=await fetch(`${SUPABASE_URL.replace(/\/$/,"")}/rest/v1/service_requests`,{method:"POST",headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(payload)});if(!r.ok){const err=await r.text();console.error("Database insert failed",r.status,err.slice(0,300));return json(res,502,{error:"We could not save your request. Please try again shortly."});}return json(res,201,{ok:true,reference});}catch(e){console.error("Request API error",e.message);return json(res,500,{error:"A server error occurred. Please try again."});}
};