import { createElement } from 'react';

/** Sala de videollamada en el navegador: react-native-webview no funciona en la web, así que se usa un iframe. */
export function MeetingFrame({ url, onLoad, onError }: { url: string; onLoad: () => void; onError: () => void }) {
  return createElement('iframe', {
    src: url,
    title: 'Videollamada',
    allow: 'camera; microphone; fullscreen; display-capture; autoplay; clipboard-write',
    allowFullScreen: true,
    onLoad,
    onError,
    style: { flex: 1, width: '100%', height: '100%', border: 0, backgroundColor: '#000' },
  });
}
