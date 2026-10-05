import React, { forwardRef, useEffect, useState } from 'react';
import { View } from 'react-native';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../pdf/template';

export interface DocViewProps {
  html: string;
  width: number;
}

/** Browser version: the document is laid out at A4 width in a frame and scaled down to fit. */
export const DocView = forwardRef<View, DocViewProps>(function DocView({ html, width }, ref) {
  const [contentHeight, setContentHeight] = useState(0);
  useEffect(() => setContentHeight(0), [html]);
  const scale = width / PAGE_WIDTH;
  const pageHeight = Math.min(contentHeight || PAGE_HEIGHT * 0.6, PAGE_HEIGHT * 3);

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
          width: PAGE_WIDTH,
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
