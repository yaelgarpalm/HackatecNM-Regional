/**
 * Página HTML con mapa vectorial de OpenFreeMap/MapLibre. Se muestra en iframe (web)
 * o WebView (Android/iOS) y avisa a la app con postMessage al tocar un marcador o el mapa.
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
  // JSON dentro de <script>: se escapa "<" para que un nombre no pueda cerrar la etiqueta.
  const data = JSON.stringify(opts).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.js"></script>
<style>
  html, body, #map { margin: 0; width: 100%; height: 100%; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  body { overflow: hidden; }
  .maplibregl-ctrl-group { border-radius: 10px !important; overflow: hidden; }
  .maplibregl-ctrl-attrib { max-width: calc(100vw - 12px); font-size: 10px; }
  .home-pin, .uni-pin { display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
  .home-pin { background: #0D716B; color: #fff; border-radius: 999px; width: 30px; height: 30px; font-size: 15px; }
  .uni-pin { background: #B94E42; color: #fff; border-radius: 999px; width: 22px; height: 22px; font-size: 10px; font-weight: 800; }
  .location-pin { background: #2563EB; border: 3px solid #fff; border-radius: 50% 50% 50% 0; width: 18px; height: 18px; transform: rotate(-45deg); box-shadow: 0 2px 8px rgba(0,0,0,.3); }
  .map-pop-title { font-weight: 700; font-size: 14px; color: #18353A; }
  .map-pop-sub { font-size: 12px; color: #5A7074; margin-top: 2px; }
  .hint { position: absolute; z-index: 2; left: 50%; transform: translateX(-50%); top: 10px; background: #18353A; color: #fff;
    font-size: 12px; padding: 7px 12px; border-radius: 999px; pointer-events: none; white-space: nowrap; }
  .map-message { position: absolute; z-index: 3; inset: 0; display: grid; place-items: center; padding: 20px; color: #52666A; background: #F1F6F5; text-align: center; font-size: 14px; }
</style>
</head><body>
<div id="map"></div>
<div id="map-message" class="map-message" role="status">Cargando el mapa…</div>
<script>
  var o = ${data};
  var send = function (msg) {
    msg.source = 'vinculatec-map';
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else window.parent.postMessage(s, '*');
  };
  var mapMessage = document.getElementById('map-message');
  if (!window.maplibregl) {
    mapMessage.textContent = 'No se pudo cargar el mapa. Comprueba tu conexión e inténtalo de nuevo.';
  } else {
    // OpenFreeMap evita depender del servidor público de teselas tile.openstreetmap.org.
    var center = o.center || (o.markers[0] ? { lat: o.markers[0].lat, lng: o.markers[0].lng } : null);
    var map = new maplibregl.Map({
      container: 'map',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: center ? [center.lng, center.lat] : [-102.5, 23.6],
      zoom: center ? (o.zoom || 13) : 5,
      attributionControl: false,
      maplibreLogo: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    map.addControl(new maplibregl.AttributionControl({
      compact: false,
      customAttribution: '© <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · datos © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · <a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a>',
    }), 'bottom-right');

    var esc = function (t) { var d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; };
    var popup = function (m) {
      return '<div class="map-pop-title">' + esc(m.title) + '</div>' + (m.subtitle ? '<div class="map-pop-sub">' + esc(m.subtitle) + '</div>' : '');
    };
    var points = [];
    o.markers.forEach(function (m) {
      if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) return;
      var element = document.createElement('div');
      element.className = m.kind === 'home' ? 'home-pin' : m.kind === 'uni' ? 'uni-pin' : 'location-pin';
      if (m.kind === 'home') element.textContent = '★';
      if (m.kind === 'uni') element.textContent = 'U';
      var marker = new maplibregl.Marker({ element: element, anchor: 'center' })
        .setLngLat([m.lng, m.lat])
        .setPopup(new maplibregl.Popup({ offset: 18, maxWidth: '260px' }).setHTML(popup(m)))
        .addTo(map);
      element.addEventListener('click', function () { send({ type: 'select', id: m.id }); });
      points.push([m.lng, m.lat]);
    });

    var radiusRing = [];
    if (o.radiusKm && o.center) {
      var earthRadius = 6371008.8;
      var angularDistance = (o.radiusKm * 1000) / earthRadius;
      var phi1 = o.center.lat * Math.PI / 180;
      var lambda1 = o.center.lng * Math.PI / 180;
      for (var step = 0; step <= 64; step++) {
        var bearing = (step / 64) * 2 * Math.PI;
        var phi2 = Math.asin(Math.sin(phi1) * Math.cos(angularDistance) + Math.cos(phi1) * Math.sin(angularDistance) * Math.cos(bearing));
        var lambda2 = lambda1 + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(phi1),
          Math.cos(angularDistance) - Math.sin(phi1) * Math.sin(phi2));
        radiusRing.push([lambda2 * 180 / Math.PI, phi2 * 180 / Math.PI]);
      }
    }

    var touched = false;
    var loaded = false;
    var fit = function () {
      map.resize();
      if (radiusRing.length) {
        var lons = radiusRing.map(function (point) { return point[0]; });
        var lats = radiusRing.map(function (point) { return point[1]; });
        map.fitBounds([[Math.min.apply(null, lons), Math.min.apply(null, lats)], [Math.max.apply(null, lons), Math.max.apply(null, lats)]],
          { padding: 24, maxZoom: 13, duration: 0 });
      } else if (points.length > 1) {
        var lngs = points.map(function (point) { return point[0]; });
        var pointLats = points.map(function (point) { return point[1]; });
        map.fitBounds([[Math.min.apply(null, lngs), Math.min.apply(null, pointLats)], [Math.max.apply(null, lngs), Math.max.apply(null, pointLats)]],
          { padding: 30, maxZoom: 13, duration: 0 });
      } else if (center) {
        map.jumpTo({ center: [center.lng, center.lat], zoom: o.zoom || 13 });
      }
    };

    map.on('load', function () {
      loaded = true;
      mapMessage.style.display = 'none';
      if (radiusRing.length) {
        map.addSource('distance-radius', { type: 'geojson', data: {
          type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [radiusRing] },
        } });
        map.addLayer({ id: 'distance-radius-fill', type: 'fill', source: 'distance-radius',
          paint: { 'fill-color': '#0D716B', 'fill-opacity': 0.07 } });
        map.addLayer({ id: 'distance-radius-outline', type: 'line', source: 'distance-radius',
          paint: { 'line-color': '#0D716B', 'line-width': 1.5, 'line-opacity': 0.8 } });
      }
      fit();
    });
    map.on('error', function () {
      if (!loaded) mapMessage.textContent = 'No se pudo cargar el mapa. Comprueba tu conexión e inténtalo de nuevo.';
    });
    map.on('dragstart zoomstart', function (event) { if (event.originalEvent) touched = true; });
    if (window.ResizeObserver) new ResizeObserver(function () { map.resize(); if (loaded && !touched) fit(); }).observe(document.getElementById('map'));
    window.addEventListener('load', function () { if (loaded && !touched) fit(); });

    if (o.pickable) {
      var hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'Toca el mapa para marcar tu ubicación';
      document.body.appendChild(hint);
      var pin = null;
      map.on('click', function (event) {
        var location = event.lngLat;
        if (pin) pin.setLngLat(location);
        else pin = new maplibregl.Marker({ color: '#0D716B' }).setLngLat(location).addTo(map);
        send({ type: 'pick', lat: location.lat, lng: location.lng });
      });
    }
  }
</script>
</body></html>`;
}
