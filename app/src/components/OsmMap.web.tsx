import { createElement, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';

import { colors, radius } from '@/components/theme';
import { mapHtml, type MapMessage } from '@/lib/mapHtml';

import type { OsmMapProps } from './OsmMap';

/** Mapa de OpenStreetMap en el navegador: la página del mapa va en un iframe y avisa con postMessage. */
export function OsmMap({ markers, center, radiusKm, pickable, height = 320, onSelect, onPick }: OsmMapProps) {
  const html = useMemo(() => mapHtml({ markers, center, radiusKm, pickable }), [markers, center, radiusKm, pickable]);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const handlers = useRef({ onSelect, onPick });

  useEffect(() => {
    handlers.current = { onSelect, onPick };
  }, [onSelect, onPick]);

  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return; // solo nuestro mapa
      try {
        const msg = JSON.parse(e.data) as MapMessage;
        if (msg.source !== 'vinculatec-map') return;
        if (msg.type === 'select') handlers.current.onSelect?.(msg.id);
        if (msg.type === 'pick') handlers.current.onPick?.(msg.lat, msg.lng);
      } catch { /* mensaje ajeno al mapa */ }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  return (
    <View style={{ height, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
      {createElement('iframe', {
        ref: frame,
        srcDoc: html,
        title: 'Mapa',
        // allow-same-origin no se da: el mapa no necesita acceso a la app, solo avisar con postMessage
        sandbox: 'allow-scripts allow-popups',
        style: { width: '100%', height: '100%', border: 0 },
      })}
    </View>
  );
}
