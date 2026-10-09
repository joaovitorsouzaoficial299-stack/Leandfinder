const TAGS = {
 loja:'nwr["shop"]', rest:'nwr["amenity"~"^(restaurant|fast_food|food_court|cafe|bar|pub|ice_cream)$"]',
 barb:'nwr["shop"~"^(hairdresser|barber)$"]', salao:'nwr["shop"~"^(hairdresser|beauty)$"]',
 odon:'nwr["amenity"="dentist"]', acad:'nwr["leisure"~"^(fitness_centre|sports_centre)$"]',
 assist:'nwr["shop"~"^(mobile_phone|computer|electronics|repair)$"]', imob:'nwr["office"="estate_agent"]',
 ofic:'nwr["shop"~"^(car_repair|motorcycle_repair|tyres)$"]', pet:'nwr["shop"="pet"]',
 roupa:'nwr["shop"="clothes"]', cel:'nwr["shop"="mobile_phone"]',
 local:'nwr["name"]["shop"]', perto:'nwr["name"]'
};
const LABELS={loja:'lojas',rest:'restaurantes',barb:'barbearias',salao:'salões de beleza',odon:'clínicas odontológicas',acad:'academias',assist:'assistências técnicas',imob:'imobiliárias',ofic:'oficinas mecânicas',pet:'pet shops',roupa:'lojas de roupas',cel:'lojas de celulares',local:'empresas locais',perto:'negócios próximos'};
const clean=v=>String(v||'').trim().slice(0,100);
async function request(url,options={},ms=25000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
 try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}
}
module.exports=async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');
 res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type');
 res.setHeader('Cache-Control','s-maxage=180, stale-while-revalidate=300');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST, OPTIONS');return res.status(405).json({error:'Método não permitido'});}
 try{
  const p=req.method==='POST'?(req.body||{}):req.query||{};
  const location=clean(p.location),category=clean(p.category||'local'),radius=Math.min(50,Math.max(1,Number(p.radius)||10));
  if(!location)return res.status(400).json({error:'Informe cidade e estado, por exemplo: Anápolis, GO.'});
  if(category==='custom'&&!clean(p.custom))return res.status(400).json({error:'Informe o tipo de negócio na busca personalizada.'});
  const geo=await request('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q='+encodeURIComponent(location),{headers:{'User-Agent':'LeadFinder/1.0 (lead research)','Accept-Language':'pt-BR'}},15000);
  if(!geo.ok)throw new Error('O serviço de localização está temporariamente indisponível.');
  const places=await geo.json();
  if(!places.length)return res.status(404).json({error:'Localização não encontrada. Tente informar cidade e UF.'});
  const lat=Number(places[0].lat),lon=Number(places[0].lon),around=Math.round(radius*1000);
  let selector=TAGS[category]||TAGS.local;
  if(category==='custom'){
   const term=clean(p.custom).replace(/[.*+?^${}()|[\]\\]/g,' ').replace(/["']/g,'').trim().slice(0,60);
   if(!term)return res.status(400).json({error:'Digite um termo válido para a busca personalizada.'});
   selector='nwr["name"~"'+term.replace(/\s+/g,'|')+'",i]';
  }
  // Aumenta a cobertura: até 1.000 elementos nomeados dentro do raio.
  const query='[out:json][timeout:25];('+['node','way','relation'].map(type=>type+selector+'["name"](around:'+around+','+lat+','+lon+');').join('')+');out center tags 1000;';
  let data=null,lastStatus=0;
  for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.nchc.org.tw/api/interpreter']){
   try{
    const r=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'LeadFinder/1.0'},body:'data='+encodeURIComponent(query)},35000);
    lastStatus=r.status;if(!r.ok)continue;
    const parsed=await r.json();if(Array.isArray(parsed.elements)){data=parsed;break;}
   }catch(e){}
  }
  if(!data)throw new Error('As fontes gratuitas estão sobrecarregadas. Aguarde um pouco e tente novamente.');
  const seen=new Set(),leads=[];
  for(const e of data.elements||[]){
   const t=e.tags||{},name=clean(t.name);if(!name)continue;
   const street=t['addr:street']||'',house=t['addr:housenumber']||'',suburb=t['addr:suburb']||t['addr:neighbourhood']||'';
   const key=(name.toLocaleLowerCase('pt-BR')+'|'+street.toLocaleLowerCase('pt-BR')+'|'+house);
   if(seen.has(key))continue;seen.add(key);
   const rawWebsite=t.website||t['contact:website']||'';
   const website=/^(https?:\/\/)/i.test(rawWebsite)?rawWebsite:rawWebsite?('https://'+rawWebsite):'';
   const rawIg=t['contact:instagram']||t.instagram||'';
   const instagram=rawIg?(rawIg.startsWith('http')?rawIg:'https://instagram.com/'+rawIg.replace(/^@/,'')):(/instagram/i.test(rawWebsite)?website:'');
   const phone=t.phone||t['contact:phone']||t['contact:mobile']||'';
   const rawWa=t['contact:whatsapp']||t.whatsapp||'';
   const whatsapp=String(rawWa||phone).replace(/\D/g,'');
   const addr=[street,house,suburb].filter(Boolean).join(', ');
   const point=e.lat!=null?{lat:e.lat,lng:e.lon}:e.center?{lat:e.center.lat,lng:e.center.lon}:{lat:null,lng:null};
   leads.push({id:'osm-'+e.type+'-'+e.id,name,category:t.shop||t.amenity||t.office||t.leisure||t.craft||LABELS[category]||'Negócio local',address:addr||'Endereço não cadastrado na fonte',city:location, state:'',rating:null,reviews:null,website:/facebook|instagram|wa\.me|whatsapp/i.test(rawWebsite)?'':website,instagram,phone,whatsapp,hours:t.opening_hours||'',openNow:null,lat:point.lat,lng:point.lng,source:'OpenStreetMap',sourceId:String(e.id),lastUpdated:null,websiteListed:Boolean(rawWebsite&&!/facebook|instagram|wa\.me|whatsapp/i.test(rawWebsite)),contactAvailable:Boolean(phone||rawWa)});
  }
  return res.status(200).json({source:'OpenStreetMap',count:leads.length,location:places[0].display_name,leads,partial:leads.length>=1000,query:{category,radiusKm:radius},attribution:'Dados © OpenStreetMap contributors',notice:'Os dados dependem dos cadastros públicos do OpenStreetMap. Nota, avaliações e contatos não cadastrados não são inventados.'});
 }catch(err){
  const message=err.name==='AbortError'?'A busca excedeu o tempo limite. Tente novamente.':(err.message||'Erro ao buscar empresas.');
  return res.status(502).json({error:message});
 }
};