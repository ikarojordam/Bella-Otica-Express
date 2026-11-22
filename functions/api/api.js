'use strict';
const {createClient}=require('@supabase/supabase-js');
const reply=(status,data)=>({statusCode:status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(data)});
const fail=(status,error)=>reply(status,{error});
const txt=(v,n=150)=>String(v??'').trim().slice(0,n);
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T12:00:00').getTime());
const validTime=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const mins=t=>Number(String(t).slice(0,2))*60+Number(String(t).slice(3,5));
const fmtTime=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
const cleanUser=u=>u?({id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role,createdAt:u.created_at}):null;
const sameDate=(tz)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const localClock=tz=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return mins(p.hour+':'+p.minute)};
const check=r=>{if(r.error)throw r.error;return r.data};
exports.handler=async(event)=>{
 try{
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.SUPABASE_ANON_KEY)return fail(503,'Configure as variáveis do Supabase na Netlify.');
  const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const guest=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const method=event.httpMethod;const base='/api/';const pathname=event.path.replace(/^\/\.netlify\/functions\/api\/?/,'').replace(/^\/api\/?/,'');const route=base+pathname.replace(/^\/+/, '');
  const query=event.queryStringParameters||{};
  let body={};if(event.body&&method!=='GET'){try{body=JSON.parse(event.body)}catch{return fail(400,'JSON inválido.')}}
  let auth=null,profile=null;const bearer=event.headers.authorization||event.headers.Authorization||'';
  if(bearer.startsWith('Bearer ')){let r=await admin.auth.getUser(bearer.slice(7));if(!r.error&&r.data.user){auth=r.data.user;const p=await admin.from('profiles').select('*').eq('id',auth.id).maybeSingle();profile=p.data?{...p.data,email:auth.email}:null}}
  const adminOnly=()=>profile?.role==='admin';
  const loadSettings=async()=>{let x=check(await admin.from('shop_settings').select('*').eq('id',1).single());return {name:x.name,address:x.address,phone:x.phone,instagram:x.instagram,notice:x.notice,open:x.open_time,close:x.close_time,days:x.days,interval:x.slot_interval,timezone:x.timezone}};
  const loadServices=async(active=false)=>check(await admin.from('services').select('*').order('created_at',{ascending:true}).then(r=>r)).filter(s=>!active||s.active);
  const log=async(action,who,detail='')=>{const x=await admin.from('audit_logs').insert({action,who:who||null,detail:txt(detail,500)});if(x.error)console.error('audit log:',x.error.message)};
  const getSlots=async(date,serviceId)=>{
   if(!validDate(date))return [];
   const [settings,services]=await Promise.all([loadSettings(),loadServices()]);
   const svc=services.find(s=>s.id===serviceId&&s.active);if(!svc)return [];
   const dow=new Date(date+'T12:00:00Z').getUTCDay();if(!settings.days.includes(dow))return [];
   const tz=settings.timezone||'America/Maceio';const today=sameDate(tz);
   if(date<today||date>new Date(Date.now()+60*86400000).toISOString().slice(0,10))return [];
   const open=mins(settings.open),close=mins(settings.close),step=Math.max(10,Number(settings.interval)||30);
   const busy=check(await admin.from('bookings').select('booking_time,duration').eq('booking_date',date).eq('status','confirmed'));
   const result=[];for(let t=open;t+svc.duration<=close;t+=step){if(date===today&&t<=localClock(tz)+15)continue;
    if(!busy.some(b=>t<mins(b.booking_time)+b.duration&&t+svc.duration>mins(b.booking_time)))result.push(fmtTime(t));
   }return result;
  };
  if(method==='GET'&&route==='/api/public'){let [services,settings]=await Promise.all([loadServices(true),loadSettings()]);return reply(200,{services,settings})}
  if(method==='GET'&&route==='/api/slots')return reply(200,{slots:await getSlots(txt(query.date),txt(query.serviceId))});
  if(method==='POST'&&route==='/api/register'){
   const name=txt(body.name,70),email=txt(body.email,254).toLowerCase(),phone=txt(body.phone).replace(/\D/g,''),password=String(body.password||'');
   if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||phone.length<10||phone.length>13||password.length<8)return fail(400,'Informe nome, e-mail, telefone e senha de 8+ caracteres.');
   const x=await guest.auth.signUp({email,password,options:{data:{name,phone}}});if(x.error)return fail(400,x.error.message);
   if(x.data.user){await log('cadastro',x.data.user.id,email)}
   return reply(201,{message:'Cadastro recebido. Confira seu e-mail caso a confirmação esteja habilitada.'});
  }
  if(method==='POST'&&route==='/api/login'){
   const x=await guest.auth.signInWithPassword({email:txt(body.email).toLowerCase(),password:String(body.password||'')});if(x.error)return fail(401,'Credenciais inválidas ou e-mail não confirmado.');
   const p=check(await admin.from('profiles').select('*').eq('id',x.data.user.id).single());return reply(200,{user:cleanUser({...p,email:x.data.user.email}),access_token:x.data.session.access_token,refresh_token:x.data.session.refresh_token});
  }
  if(method==='POST'&&route==='/api/refresh'){
   const token=String(body.refresh_token||'');if(!token)return fail(401,'Sessão expirada. Faça login.');
   const x=await guest.auth.refreshSession({refresh_token:token});if(x.error||!x.data.session)return fail(401,'Sessão expirada. Faça login.');
   return reply(200,{access_token:x.data.session.access_token,refresh_token:x.data.session.refresh_token});
  }
  if(method==='POST'&&route==='/api/logout')return reply(200,{ok:true});
  if(method==='GET'&&route==='/api/me'){if(bearer.startsWith('Bearer ')&&!auth)return fail(401,'Sessão expirada.');return reply(200,{user:cleanUser(profile)})}
  if(!auth||!profile)return fail(401,'Faça login para continuar.');
  if(method==='PATCH'&&route==='/api/me'){
   const name=txt(body.name,70),phone=txt(body.phone).replace(/\D/g,'');if(name.length<2||phone.length<10||phone.length>13)return fail(400,'Nome ou telefone inválido.');
   const p=check(await admin.from('profiles').update({name,phone}).eq('id',auth.id).select().single());await log('perfil',auth.id);return reply(200,{user:cleanUser({...p,email:auth.email})});
  }
  if(method==='GET'&&route==='/api/bookings'){
   let q=admin.from('bookings').select('*,services(name)').order('booking_date',{ascending:false}).order('booking_time',{ascending:false}).limit(500);
   if(!adminOnly())q=q.eq('user_id',auth.id);let rows=check(await q);
   let usersMap={};if(adminOnly()){const ids=[...new Set(rows.map(b=>b.user_id))];if(ids.length){let people=check(await admin.from('profiles').select('*').in('id',ids));usersMap=Object.fromEntries(people.map(p=>[p.id,p]))}}
   return reply(200,{bookings:rows.map(b=>({id:b.id,userId:b.user_id,serviceId:b.service_id,date:b.booking_date,time:fmtTime(mins(b.booking_time)),status:b.status,price:Number(b.price),createdAt:b.created_at,service:b.services?.name||'Serviço',client:adminOnly()?cleanUser(usersMap[b.user_id]):undefined}))});
  }
  if(method==='POST'&&route==='/api/bookings'){
   const date=txt(body.date),time=txt(body.time),serviceId=txt(body.serviceId);
   if(!validTime(time)||!(await getSlots(date,serviceId)).includes(time))return fail(409,'Horário indisponível. Atualize a seleção.');
   const s=check(await admin.from('services').select('*').eq('id',serviceId).eq('active',true).single());
   const x=await admin.from('bookings').insert({user_id:auth.id,service_id:serviceId,booking_date:date,booking_time:time,duration:s.duration,price:s.price,status:'confirmed'}).select().single();
   if(x.error){if(x.error.code==='23P01')return fail(409,'Horário ocupado por outro cliente. Selecione outro.');throw x.error}
   await log('agendamento',auth.id,`${date} ${time}`);return reply(201,{booking:x.data});
  }
  let m=route.match(/^\/api\/bookings\/([\w-]+)\/cancel$/);
  if(method==='POST'&&m){let q=admin.from('bookings').select('*').eq('id',m[1]).maybeSingle();let b=check(await q);if(!b)return fail(404,'Agendamento não encontrado.');if(b.user_id!==auth.id&&!adminOnly())return fail(403,'Sem permissão.');if(b.status!=='confirmed')return fail(409,'Agendamento já cancelado.');check(await admin.from('bookings').update({status:'cancelled'}).eq('id',b.id));await log('cancelamento',auth.id,b.id);return reply(200,{ok:true})}
  if(!adminOnly())return fail(403,'Acesso restrito ao administrador.');
  if(method==='GET'&&route==='/api/admin/dashboard'){
   let [users,bookings]=await Promise.all([admin.from('profiles').select('id,role'),admin.from('bookings').select('booking_date,booking_time,status,price')]);check(users);check(bookings);let now=sameDate('America/Maceio');
   return reply(200,{clients:users.data.filter(u=>u.role==='client').length,total:bookings.data.length,upcoming:bookings.data.filter(b=>b.status==='confirmed'&&(b.booking_date>now||(b.booking_date===now&&mins(b.booking_time)>localClock('America/Maceio')))).length,revenue:bookings.data.filter(b=>b.status==='confirmed').reduce((s,b)=>s+Number(b.price),0)});
  }
  if(method==='GET'&&route==='/api/admin/users'){
   const people=check(await admin.from('profiles').select('*').order('created_at',{ascending:false}).limit(500));let users=[];for(const p of people){const x=await admin.auth.admin.getUserById(p.id);users.push(cleanUser({...p,email:x.data?.user?.email||''}))}return reply(200,{users});
  }
  if(method==='GET'&&route==='/api/admin/logs'){
   const logs=check(await admin.from('audit_logs').select('*').order('at',{ascending:false}).limit(100));return reply(200,{logs});
  }
  if(method==='PUT'&&route==='/api/admin/settings'){
   const open=txt(body.open),close=txt(body.close),days=body.days,interval=Number(body.interval);
   if(!validTime(open)||!validTime(close)||mins(close)<=mins(open)||!Array.isArray(days)||days.some(x=>!Number.isInteger(x)||x<0||x>6)||!Number.isInteger(interval)||interval<10||interval>120)return fail(400,'Configuração de horários inválida.');
   const s=check(await admin.from('shop_settings').update({name:txt(body.name,100),address:txt(body.address,160),phone:txt(body.phone,30),instagram:txt(body.instagram,100),notice:txt(body.notice,200),open_time:open,close_time:close,days:[...new Set(days)],slot_interval:interval}).eq('id',1).select().single());await log('configuracao',auth.id);return reply(200,{settings:s});
  }
  if(method==='GET'&&route==='/api/admin/services')return reply(200,{services:await loadServices()});
  const validateService=()=>{const name=txt(body.name,100),price=Number(body.price),duration=Number(body.duration);if(name.length<2||!Number.isFinite(price)||price<0||price>10000||!Number.isInteger(duration)||duration<10||duration>480)throw Error('Serviço inválido.');return {name,description:txt(body.description,200),price,duration,active:body.active!==false}};
  if(method==='POST'&&route==='/api/admin/services'){const s=validateService();s.id=require('node:crypto').randomUUID();const service=check(await admin.from('services').insert(s).select().single());await log('novo_servico',auth.id,s.name);return reply(201,{service})}
  m=route.match(/^\/api\/admin\/services\/([\w-]+)$/);
  if(method==='PUT'&&m){const s=validateService();const service=check(await admin.from('services').update(s).eq('id',m[1]).select().single());await log('editar_servico',auth.id,s.name);return reply(200,{service})}
  return fail(404,'Rota não encontrada.');
 }catch(err){console.error('API:',err);return fail(500,'Erro ao processar solicitação. Consulte os logs da Netlify.')}
};
