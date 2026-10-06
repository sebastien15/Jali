import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { C } from "@/constants/theme";

export type MapDriver = { id: number; lat: number; lng: number; vehicleClass: string; label: string };

type Props = {
  center: { lat: number; lng: number };
  drivers: MapDriver[];
  onSelect?: (id: number) => void;
  route?: { lat: number; lng: number }[];
  height?: number | "100%";
};

const ICON: Record<string, string> = { moto: "🛵", car: "🚗", comfort: "🚙", van: "🚐" };

/**
 * OpenStreetMap (Leaflet) in a WebView — no Google Maps key needed (story S3.3).
 * Markers are updated in place through injected JS, so refreshes don't flicker.
 */
export function DriversMap({ center, drivers, onSelect, route, height = "100%" }: Props) {
  const ref = useRef<WebView>(null);
  const ready = useRef(false);

  // The page is built once; later changes are pushed with update()
  const html = useMemo(() => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0}
.car{font-size:24px;line-height:24px;text-align:center;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
.tag{background:${C.dark};color:#fff;font:700 11px sans-serif;padding:2px 6px;border-radius:8px;white-space:nowrap;transform:translate(-30%,-36px);display:inline-block}
.me{width:18px;height:18px;border-radius:9px;background:${C.green};border:3px solid #fff;box-shadow:0 0 0 2px ${C.green}}</style>
</head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([${center.lat},${center.lng}],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
L.marker([${center.lat},${center.lng}],{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[18,18]})}).addTo(map);
var markers={},line=null,icons=${JSON.stringify(ICON)};
function post(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(m)}
window.update=function(data){
  var seen={};
  (data.drivers||[]).forEach(function(d){
    seen[d.id]=1;
    var html='<div class="car">'+(icons[d.vehicleClass]||'🚗')+'</div><div class="tag">'+d.label+'</div>';
    if(markers[d.id]){markers[d.id].setLatLng([d.lat,d.lng]);markers[d.id].setIcon(L.divIcon({className:'',html:html,iconSize:[24,24]}));}
    else{markers[d.id]=L.marker([d.lat,d.lng],{icon:L.divIcon({className:'',html:html,iconSize:[24,24]})}).addTo(map).on('click',function(){post(String(d.id))});}
  });
  Object.keys(markers).forEach(function(id){if(!seen[id]){map.removeLayer(markers[id]);delete markers[id];}});
  if(line){map.removeLayer(line);line=null;}
  if(data.route&&data.route.length>1){line=L.polyline(data.route.map(function(p){return[p.lat,p.lng]}),{color:'${C.dark}',weight:5}).addTo(map);}
};
post('ready');
</script></body></html>`, [center.lat, center.lng]);

  const payload = JSON.stringify({ drivers, route: route ?? [] });

  useEffect(() => {
    if (ready.current) ref.current?.injectJavaScript(`window.update(${payload});true;`);
  }, [payload]);

  return (
    <View style={{ height, backgroundColor: C.bg, overflow: "hidden" }}>
      <WebView
        ref={ref}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={e => {
          const msg = e.nativeEvent.data;
          if (msg === "ready") {
            ready.current = true;
            ref.current?.injectJavaScript(`window.update(${payload});true;`);
          } else if (onSelect) {
            onSelect(Number(msg));
          }
        }}
        javaScriptEnabled
        scrollEnabled={false}
        style={{ flex: 1 }}
      />
    </View>
  );
}
