import { useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { colors, radius } from '@/components/theme';
import { mapHtml, type MapMarker, type MapMessage } from '@/lib/mapHtml';

export type OsmMapProps = {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  radiusKm?: number;
  pickable?: boolean;
  height?: number;
  onSelect?: (id: string) => void;
  onPick?: (lat: number, lng: number) => void;
};

/** Mapa de OpenStreetMap (Android/iOS). En la web se usa OsmMap.web.tsx. */
export function OsmMap({ markers, center, radiusKm, pickable, height = 320, onSelect, onPick }: OsmMapProps) {
  const html = useMemo(() => mapHtml({ markers, center, radiusKm, pickable }), [markers, center, radiusKm, pickable]);
  return (
    <View style={{ height, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data) as MapMessage;
            if (msg.type === 'select') onSelect?.(msg.id);
            if (msg.type === 'pick') onPick?.(msg.lat, msg.lng);
          } catch { /* mensaje ajeno al mapa */ }
        }}
      />
    </View>
  );
}
