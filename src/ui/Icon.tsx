import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C } from '../theme';
import { useLocale } from './locale';

export type IconName =
  | 'home' | 'file' | 'users' | 'box' | 'sliders' | 'plus' | 'search' | 'chevron' | 'back' | 'check'
  | 'cloudCheck' | 'cloudUp' | 'cloudOff' | 'chat' | 'printer' | 'image' | 'download' | 'upload' | 'pencil'
  | 'close' | 'trash' | 'more' | 'user' | 'wallet' | 'moneyIn' | 'moneyOut' | 'alert' | 'chart' | 'calendar' | 'menu';

const PATHS: Record<IconName, React.ReactNode> = {
  home: (<><Path d="M3 11l9-8 9 8" /><Path d="M5 10v10h14V10" /></>),
  file: (<><Path d="M14 3H6v18h12V7z" /><Path d="M14 3v4h4" /><Path d="M9 13h6M9 17h6" /></>),
  users: (<><Circle cx="9" cy="8" r="3.5" /><Path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><Path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.3c2.1.8 3.5 2.8 3.5 5.7" /></>),
  user: (<><Circle cx="12" cy="8" r="3.8" /><Path d="M4.5 20c0-3.9 3.3-6.5 7.5-6.5s7.5 2.6 7.5 6.5" /></>),
  box: (<><Path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><Path d="M3 8l9 5 9-5M12 13v8" /></>),
  sliders: (<><Path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><Circle cx="16" cy="7" r="2" /><Circle cx="8" cy="17" r="2" /></>),
  plus: <Path d="M12 5v14M5 12h14" />,
  search: (<><Circle cx="11" cy="11" r="6.5" /><Path d="M16 16l4.5 4.5" /></>),
  chevron: <Path d="M9 6l6 6-6 6" />,
  back: <Path d="M15 6l-6 6 6 6" />,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  cloudCheck: (<><Path d="M7 18a4.5 4.5 0 01-.6-8.96A6 6 0 0118 10.5 3.8 3.8 0 0117.5 18z" /><Path d="M9.5 13.5l2 2 3.5-3.5" /></>),
  cloudUp: (<><Path d="M7 18a4.5 4.5 0 01-.6-8.96A6 6 0 0118 10.5 3.8 3.8 0 0117.5 18z" /><Path d="M12 15.5v-5M9.8 12.7L12 10.5l2.2 2.2" /></>),
  cloudOff: (<><Path d="M7 18a4.5 4.5 0 01-.6-8.96A6 6 0 0118 10.5 3.8 3.8 0 0117.5 18z" /><Path d="M12 10.5v3M12 15.6v.1" /></>),
  chat: <Path d="M4 20l1.4-4.2A8 8 0 1112 20a8 8 0 01-3.8-.95z" />,
  printer: (<><Path d="M7 8V3h10v5" /><Rect x="3" y="8" width="18" height="9" rx="2" /><Path d="M7 14h10v7H7z" /></>),
  image: (<><Rect x="3" y="4" width="18" height="16" rx="2" /><Circle cx="9" cy="10" r="1.8" /><Path d="M4 18l5-5 4 4 3-3 4 4" /></>),
  download: <Path d="M12 4v10M8 10l4 4 4-4M5 19h14" />,
  upload: <Path d="M12 15V5M8 9l4-4 4 4M5 19h14" />,
  pencil: <Path d="M4 20l1-4L16 5l3 3L8 19z" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  trash: (<><Path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13" /><Path d="M10 11v5M14 11v5" /></>),
  more: (<><Circle cx="12" cy="5" r="1.2" /><Circle cx="12" cy="12" r="1.2" /><Circle cx="12" cy="19" r="1.2" /></>),
  wallet: (<><Path d="M19 8V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-2" /><Path d="M21 10h-5a2 2 0 000 4h5z" /></>),
  moneyIn: <Path d="M17 7L7 17M7 9v8h8" />,
  moneyOut: <Path d="M7 17L17 7M9 7h8v8" />,
  chart: <Path d="M5 20v-8M12 20V5M19 20v-11M3 20h18" />,
  menu: <Path d="M4 7h16M4 12h16M4 17h16" />,
  calendar: (<><Rect x="3.5" y="5" width="17" height="15.5" rx="2" /><Path d="M3.5 10h17M8 3v4M16 3v4" /></>),
  alert: (<><Path d="M12 4l9 16H3z" /><Path d="M12 10v4.5M12 17.2v.1" /></>),
};

const MIRRORED: IconName[] = ['chevron', 'back'];

export function Icon({ name, size = 22, color = C.ink, stroke = 1.9 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const { rtl } = useLocale();
  const flip = rtl && MIRRORED.includes(name);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      {PATHS[name]}
    </Svg>
  );
}
