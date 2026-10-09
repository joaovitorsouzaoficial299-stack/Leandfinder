const TAGS = {
  loja: '[shop]', rest: '[amenity~"^(restaurant|fast_food|bar|cafe)$"]',
  barb: '[shop~"^(hairdresser|barber)$"]', salao: '[shop~"^(hairdresser|beauty)$"]',
  odon: '[amenity="dentist"]', acad: '[leisure="fitness_centre"]',
  assist: '[shop~"^(mobile_phone|computer|electronics)$"]', imob: '[office="estate_agent"]',
  ofic: '[shop="car_repair"]', pet: '[shop="pet"]', roupa: '[shop="clothes"]',
  cel: '[shop="mobile_phone"]', local: '[shop]', perto: '[shop]'
};
const LABELS = {loja:'lojas',rest:'restaurantes',barb:'barbearias',salao:'salões de beleza',odon:'clínicas odontológicas',acad:'academias',assist:'assistências técnicas',imob:'imobiliárias',ofic:'oficinas mecânicas',pet:'pet shops',roupa:'lojas de roupas',cel:'lojas de celulares',local:'empresas',perto:'negócios'};
const clean = v => String(v || '').replace(/[\[\]{}()\\^$.*+?|]/g, '').slice(0,80);
async function fetchWithTimeout(url, options={}, ms=20000) {
 const controller = new AbortController(); const timer=setTimeout(()=>controller.abort(),ms);
 try { return await fetch(url,{...options,signal:controller.signal}); } finally { clearTimeout(timer); }
}
module.exports = async (req,res) => {
 res.setHeader('Access-Control-Allow-Origin','*');
 res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
 if(req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Método não permitido'}); }
 try {
  const p = req.method === 'POST' ? (req.body || {}) : req.query;
  const location = clean(p.location);
  const category = clean(p.category || 'local');
  const radius = Math.min(50,Math.max(1,Number(p.radius)||10));
  if(!location) return res.status(400).json({error:'Informe cidade e estado.'});
  const geoUrl='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q='+encodeURIComponent(location);
  const geo=await fetchWithTimeout(geoUrl,{headers:{'User-Agent':'LeadFinder/1.0 (business discovery app)','Accept-Language':'pt-BR'}});
  if(!geo.ok) throw new Error('Serviço de localização indisponível. Tente novamente.');
  const places=await geo.json();
  if(!places.length) return res.status(404).json({error:'Não encontramos essa localização. Tente “Cidade, UF”.'});
  const lat=Number(places[0].lat), lon=Number(places[0].lon);
  let selector=TAGS[category] || (category==='custom' ? '' : '[shop]');
  if(category==='custom') {
    const custom=clean(p.custom);
    if(!custom) return res.status(400).json({error:'Informe o tipo de negócio na busca personalizada.'});
    selector='[name~"'+custom.replace(/"/g,'')+'",i]';
  }
  const query='[out:json][timeout:20];(node'+selector+'["name"](around:'+Math.round(radius*1000)+','+lat+','+lon+');way'+selector+'["name"](around:'+Math.round(radius*1000)+','+lat+','+lon+');relation'+selector+'["name"](around:'+Math.round(radius*1000)+','+lat+','+lon+'););out center tags 200;';
  let response;
  for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']) {
    try { response=await fetchWithTimeout(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'LeadFinder/1.0'},body:'data='+encodeURIComponent(query)},25000); if(response.ok) break; } catch(e) {}
  }
  if(!response || !response.ok) throw new Error('A fonte de empresas está ocupada. Aguarde alguns segundos e tente novamente.');
  const data=await response.json();
  const seen=new Set();
  const leads=(data.elements||[]).map(e=>{
   const t=e.tags||{}, phone=t.phone||t['contact:phone']||t['contact:mobile']||'';
   const website=t.website||t['contact:website']||'';
   const instagram=t['contact:instagram']||t.instagram||'';
   const whatsapp=t['contact:whatsapp']||'';
   const name=t.name||''; const key=name.toLowerCase()+'|'+(t['addr:street']||'').toLowerCase();
   if(!name||seen.has(key)) return null; seen.add(key);
   const address=[t['addr:street'],t['addr:housenumber'],t['addr:suburb']||t['addr:neighbourhood']].filter(Boolean).join(', ');
   const coords=e.lat!=null?{lat:e.lat,lng:e.lon}:{lat:e.center&&e.center.lat,lng:e.center&&e.center.lon};
   const site= /instagram|facebook|wa\.me|whatsapp/i.test(website)?'':website;
   const ig=instagram ? (instagram.startsWith('http')?instagram:'https://instagram.com/'+instagram.replace(/^@/,'')) : (/instagram/i.test(website)?website:'');
   return {id:'osm-'+e.type+'-'+e.id,name,category:t.shop||t.amenity||t.office||t.leisure||LABELS[category]||'Negócio local',address:address||'Endereço não cadastrado',city:places[0].name||location,state:'',rating:null,reviews:null,website:site,instagram:ig,phone,whatsapp:whatsapp.replace(/\D/g,''),hours:t.opening_hours||'',openNow:null,lat:coords.lat,lng:coords.lng,source:'OpenStreetMap'};
  }).filter(Boolean);
  return res.status(200).json({source:'OpenStreetMap',count:leads.length,location:places[0].display_name,leads,attribution:'Dados © OpenStreetMap contributors'});
 } catch(err) {
  const message=err.name==='AbortError'?'A busca demorou demais. Tente novamente.':(err.message||'Erro ao buscar empresas.');
  return res.status(502).json({error:message});
 }
};