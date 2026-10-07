import React, { forwardRef, useEffect, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../pdf/template';

export interface DocViewProps {
  html: string;
  /** Width on screen. The document is laid out at its page width and scaled to fit. */
  width: number;
  /** Width the page is laid out at: A4 unless given, narrower for a receipt. */
  pageWidth?: number;
  /** True for the moment the page is being photographed for "Send as image" (see useCapture). */
  capturing?: boolean;
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
export const DocView = forwardRef<View, DocViewProps>(function DocView({ html, width, pageWidth = PAGE_WIDTH, capturing = false }, ref) {
  const [contentHeight, setContentHeight] = useState(0);
  // Android can end the process that draws web pages when memory is short, leaving a blank page.
  // Counting those lets the page be loaded afresh instead of staying blank.
  const [reloads, setReloads] = useState(0);
  useEffect(() => setContentHeight(0), [html]);
  const pageHeight = Math.min(contentHeight || (PAGE_HEIGHT * 0.6 * pageWidth) / PAGE_WIDTH, PAGE_HEIGHT * 3);
  return (
    <View ref={ref} collapsable={false} style={{ width, height: Math.round((width * pageHeight) / pageWidth), backgroundColor: '#FFFFFF' }}>
      <WebView
        key={reloads}
        onRenderProcessGone={() => setReloads((n) => n + 1)}
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        setBuiltInZoomControls={false}
        androidLayerType={capturing ? 'software' : 'none'}
        injectedJavaScript={MEASURE}
        onMessage={(event) => {
          const h = parseInt(event.nativeEvent.data, 10);
          if (h > 0) setContentHeight(h);
        }}
      />
    </View>
  );
});
