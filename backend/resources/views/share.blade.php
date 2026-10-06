<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Follow a Jali trip</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#F2F4F8;color:#0D1117}
  header{background:#0055CC;color:#FFD000;padding:16px 20px;font-weight:900;font-size:20px}
  .card{background:#fff;margin:16px;border-radius:16px;padding:16px;border:1px solid #DDE2EC}
  .plate{background:#FFD000;border-radius:10px;padding:10px;text-align:center;font-size:26px;font-weight:900;letter-spacing:2px;margin-top:10px}
  .muted{color:#4A5568;font-size:14px} .status{font-weight:900;font-size:18px}
  a.btn{display:block;text-align:center;background:#0D1117;color:#fff;padding:14px;border-radius:12px;text-decoration:none;font-weight:800;margin-top:12px}
</style>
</head>
<body>
<header>Jali · live trip</header>
<div class="card" id="box"><div class="muted">Loading…</div></div>
<script>
var token = @json($token);
var labels = {requested:'Waiting for a driver',accepted:'Driver on the way',arrived:'Driver has arrived',in_progress:'On the trip',completed:'Trip completed'};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function load(){
  fetch('/api/share/'+encodeURIComponent(token),{headers:{Accept:'application/json'}}).then(function(r){return r.json().then(function(j){return [r.status,j]})}).then(function(res){
    var s=res[0], d=res[1], box=document.getElementById('box');
    if(s!==200){box.innerHTML='<div class="status">'+esc(d.message||'This link is not valid.')+'</div>';return;}
    var h='<div class="status">'+esc(labels[d.status]||d.status)+'</div><div class="muted">'+esc(d.rider.first_name)+' · '+esc(d.pickup||'')+' → '+esc(d.dropoff||'')+'</div>';
    if(d.driver){h+='<p><b>'+esc(d.driver.name)+'</b><br><span class="muted">'+esc([d.vehicle&&d.vehicle.color,d.vehicle&&d.vehicle.model].filter(Boolean).join(' '))+'</span></p>';}
    if(d.vehicle){h+='<div class="plate">'+esc(d.vehicle.plate)+'</div>';}
    if(d.position){h+='<a class="btn" href="https://www.openstreetmap.org/?mlat='+d.position.lat+'&mlon='+d.position.lng+'#map=16/'+d.position.lat+'/'+d.position.lng+'">See the car on a map</a>';}
    h+='<p class="muted">Updated '+new Date(d.updated_at).toLocaleTimeString()+'</p>';
    box.innerHTML=h;
  }).catch(function(){});
}
load(); setInterval(load,15000);
</script>
</body>
</html>
