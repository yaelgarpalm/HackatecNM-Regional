/**
 * Página HTML con un mapa de OpenStreetMap (Leaflet). La misma página se muestra en un iframe (web)
 * o en un WebView (Android/iOS) y avisa a la app con postMessage cuando se toca un marcador o el mapa.
 */
export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  /** home = tu organización · uni = universidad · pin = ubicación que se está eligiendo */
  kind: 'home' | 'uni' | 'pin';
};

export type MapMessage = { source: 'vinculatec-map'; type: 'select'; id: string } | { source: 'vinculatec-map'; type: 'pick'; lat: number; lng: number };

export function mapHtml(opts: { markers: MapMarker[]; center?: { lat: number; lng: number }; radiusKm?: number; pickable?: boolean; zoom?: number }) {
  // JSON dentro de <script>: se escapa "<" para que un nombre no pueda cerrar la etiqueta
  const data = JSON.stringify(opts).replace(/</g, '\\u003c');
  return `<!doctype html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { margin: 0; height: 100%; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .home-pin { background: #0F4C81; color: #fff; border: 3px solid #fff; border-radius: 999px; width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,.35); font-size: 15px; }
  .leaflet-popup-content { margin: 10px 12px; }
  .pop-title { font-weight: 700; font-size: 14px; color: #16202B; }
  .pop-sub { font-size: 12px; color: #5B6773; margin-top: 2px; }
  .hint { position: absolute; z-index: 1000; left: 50%; transform: translateX(-50%); top: 10px; background: #16202B; color: #fff;
    font-size: 12px; padding: 6px 10px; border-radius: 999px; pointer-events: none; }
</style>
</head><body>
<div id="map"></div>
<script>
  var o = ${data};
  var send = function (msg) {
    msg.source = 'vinculatec-map';
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else window.parent.postMessage(s, '*');
  };
  // Sin ubicación todavía: se muestra todo México
  var center = o.center || (o.markers[0] ? { lat: o.markers[0].lat, lng: o.markers[0].lng } : null);
  var map = L.map('map', { zoomControl: true, zoomSnap: 0.25 }).setView(center ? [center.lat, center.lng] : [23.6, -102.5], center ? (o.zoom || 13) : 5);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
  }).addTo(map);
  var esc = function (t) { var d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; };
  var popup = function (m) { return '<div class="pop-title">' + esc(m.title) + '</div>' + (m.subtitle ? '<div class="pop-sub">' + esc(m.subtitle) + '</div>' : ''); };
  var bounds = [];
  o.markers.forEach(function (m) {
    var mk;
    if (m.kind === 'home') {
      mk = L.marker([m.lat, m.lng], { icon: L.divIcon({ className: '', html: '<div class="home-pin">&#9733;</div>', iconSize: [30, 30], iconAnchor: [15, 15] }), zIndexOffset: 1000 });
    } else if (m.kind === 'pin') {
      mk = L.marker([m.lat, m.lng]);
    } else {
      mk = L.circleMarker([m.lat, m.lng], { radius: 9, color: '#fff', weight: 2, fillColor: '#eb6834', fillOpacity: 1 });
    }
    mk.addTo(map).bindPopup(popup(m));
    mk.on('click', function () { send({ type: 'select', id: m.id }); });
    bounds.push([m.lat, m.lng]);
  });
  var circle = (o.radiusKm && o.center)
    ? L.circle([o.center.lat, o.center.lng], { radius: o.radiusKm * 1000, color: '#2a78d6', weight: 1, fillOpacity: 0.06 }).addTo(map)
    : null;
  // Encuadre: el círculo de distancia o todos los marcadores. Se repite cuando el marco ya tiene su tamaño
  // final (en el iframe/WebView Leaflet puede arrancar midiendo 0 px y quedar demasiado cerca).
  var fit = function () {
    map.invalidateSize({ pan: false });
    if (circle) map.fitBounds(circle.getBounds(), { padding: [10, 10], animate: false });
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13, animate: false });
    else if (center) map.setView([center.lat, center.lng], map.getZoom(), { animate: false });
  };
  fit();
  // Reencuadra cada vez que el marco cambia de tamaño (hasta que el usuario mueva el mapa)
  var touched = false;
  map.on('dragstart zoomstart', function (e) { if (e.originalEvent || e.type === 'dragstart') touched = true; });
  if (window.ResizeObserver) new ResizeObserver(function () { if (!touched) fit(); }).observe(document.getElementById('map'));
  window.addEventListener('load', function () { if (!touched) fit(); });
  if (o.pickable) {
    var hint = document.createElement('div'); hint.className = 'hint'; hint.textContent = 'Toca el mapa para marcar tu ubicación';
    document.body.appendChild(hint);
    var pin = null;
    map.on('click', function (e) {
      if (pin) pin.setLatLng(e.latlng); else pin = L.marker(e.latlng).addTo(map);
      send({ type: 'pick', lat: e.latlng.lat, lng: e.latlng.lng });
    });
  }
</script>
</body></html>`;
}
