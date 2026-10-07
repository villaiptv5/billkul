import React, { forwardRef, useEffect, useState } from 'react';
import { View } from 'react-native';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../pdf/template';

export interface DocViewProps {
  html: string;
  width: number;
  /** Width the page is laid out at: A4 unless given, narrower for a receipt. */
  pageWidth?: number;
  /** Only matters on the phone. */
  capturing?: boolean;
}

/** Browser version: the document is laid out at A4 width in a frame and scaled down to fit. */
export const DocView = forwardRef<View, DocViewProps>(function DocView({ html, width, pageWidth = PAGE_WIDTH }, ref) {
  const [contentHeight, setContentHeight] = useState(0);
  useEffect(() => setContentHeight(0), [html]);
  const scale = width / pageWidth;
  const pageHeight = Math.min(contentHeight || (PAGE_HEIGHT * 0.6 * pageWidth) / PAGE_WIDTH, PAGE_HEIGHT * 3);

  const measure = (frame: HTMLIFrameElement) => {
    const body = frame.contentDocument?.body;
    if (body) setContentHeight(body.offsetHeight);
  };

  return (
    <View ref={ref} style={{ width, height: Math.round(pageHeight * scale), backgroundColor: '#FFFFFF', overflow: 'hidden', direction: 'ltr', alignItems: 'flex-start' }}>
      {React.createElement('iframe', {
        title: 'Document preview',
        srcDoc: html,
        sandbox: 'allow-same-origin',
        onLoad: (event: { currentTarget: HTMLIFrameElement }) => {
          const frame = event.currentTarget;
          measure(frame);
          // Web fonts can change the height slightly once they arrive.
          setTimeout(() => measure(frame), 800);
        },
        style: {
          width: pageWidth,
          height: pageHeight,
          flexShrink: 0,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        },
      })}
    </View>
  );
});
