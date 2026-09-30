import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

/** Sala de videollamada dentro de la app (Android/iOS). En la web se usa MeetingFrame.web.tsx. */
export function MeetingFrame({ url, onLoad, onError }: { url: string; onLoad: () => void; onError: () => void }) {
  return (
    <WebView
      source={{ uri: url }}
      style={styles.webview}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      allowsFullscreenVideo
      originWhitelist={['https://*']}
      onLoadEnd={onLoad}
      onError={onError}
    />
  );
}

const styles = StyleSheet.create({ webview: { flex: 1, backgroundColor: '#000' } });
