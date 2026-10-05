import React, { forwardRef, useEffect, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../pdf/template';

export interface DocViewProps {
  html: string;
  /** Width on screen. The document is laid out at A4 width and scaled to fit. */
  width: number;
}

// Reports the document's real height, so the preview and the shared picture end where the content ends.
const MEASURE = `
(function () {
  function send() { window.ReactNativeWebView.postMessage(String(document.body.offsetHeight)); }
  send();
  window.addEventListener('load', send);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(send);
  setTimeout(send, 600);
})();
true;`;

/** The document as the customer will see it. The outer view is what "Send as image" captures. */
export const DocView = forwardRef<View, DocViewProps>(function DocView({ html, width }, ref) {
  const [contentHeight, setContentHeight] = useState(0);
  useEffect(() => setContentHeight(0), [html]);
  const pageHeight = Math.min(contentHeight || PAGE_HEIGHT * 0.6, PAGE_HEIGHT * 3);
  return (
    <View ref={ref} collapsable={false} style={{ width, height: Math.round((width * pageHeight) / PAGE_WIDTH), backgroundColor: '#FFFFFF' }}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        setBuiltInZoomControls={false}
        androidLayerType="software"
        injectedJavaScript={MEASURE}
        onMessage={(event) => {
          const h = parseInt(event.nativeEvent.data, 10);
          if (h > 0) setContentHeight(h);
        }}
      />
    </View>
  );
});
