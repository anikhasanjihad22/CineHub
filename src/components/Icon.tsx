import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home' | 'search' | 'user' | 'play' | 'pause' | 'back' | 'heart' | 'plus' | 'check' | 'chevron-down'
  | 'chevron-right' | 'close' | 'info' | 'bookmark' | 'settings' | 'logout' | 'shield' | 'refresh' | 'send'
  | 'help' | 'fullscreen' | 'fullscreen-exit' | 'rewind' | 'forward' | 'speed' | 'lock' | 'unlock'
  | 'episodes' | 'next' | 'subtitles' | 'trash' | 'edit' | 'flask' | 'plug' | 'star' | 'mail' | 'eye' | 'eye-off'
  | 'aspect';

type Props = { name: IconName; size?: number; color?: string; filled?: boolean };

export function Icon({ name, size = 22, color = '#fff', filled = false }: Props) {
  const s = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'home' && <Path d="M4 11.2 12 4l8 7.2V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z" {...s} fill={filled ? color : 'none'} />}
      {name === 'search' && (<><Circle cx={11} cy={11} r={6.5} {...s} /><Path d="m16 16 4.5 4.5" {...s} /></>)}
      {name === 'user' && (<><Circle cx={12} cy={8.5} r={3.5} {...s} fill={filled ? color : 'none'} /><Path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" {...s} /></>)}
      {name === 'play' && <Path d="M8 5.8v12.4c0 .8.9 1.3 1.6.8l9-6.2a1 1 0 0 0 0-1.6l-9-6.2c-.7-.5-1.6 0-1.6.8z" fill={color} />}
      {name === 'pause' && (<><Rect x={6} y={5} width={4} height={14} rx={1} fill={color} /><Rect x={14} y={5} width={4} height={14} rx={1} fill={color} /></>)}
      {name === 'back' && <Path d="m14.5 5.5-6.5 6.5 6.5 6.5" {...s} />}
      {name === 'heart' && <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...s} fill={filled ? color : 'none'} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...s} />}
      {name === 'check' && <Path d="m5 12.5 4.5 4.5L19 7.5" {...s} />}
      {name === 'chevron-down' && <Path d="m6 9.5 6 6 6-6" {...s} />}
      {name === 'chevron-right' && <Path d="m9.5 6 6 6-6 6" {...s} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6 6 18" {...s} />}
      {name === 'info' && (<><Circle cx={12} cy={12} r={8.5} {...s} /><Path d="M12 11v5" {...s} /><Circle cx={12} cy={7.9} r={0.6} fill={color} stroke={color} strokeWidth={1} /></>)}
      {name === 'bookmark' && <Path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-4-6 4V5.5a1 1 0 0 1 1-1z" {...s} fill={filled ? color : 'none'} />}
      {name === 'settings' && (<><Circle cx={12} cy={12} r={3} {...s} /><Path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" {...s} /></>)}
      {name === 'logout' && (<><Path d="M10 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H10" {...s} /><Path d="M15 8.5 19 12l-4 3.5M19 12H9.5" {...s} /></>)}
      {name === 'shield' && <Path d="M12 3.5 5 6v5.5c0 4.2 2.8 7.6 7 9 4.2-1.4 7-4.8 7-9V6z" {...s} />}
      {name === 'refresh' && (<><Path d="M19 7.5A8 8 0 0 0 5.2 9" {...s} /><Path d="M19.5 3.5v4h-4" {...s} /><Path d="M5 16.5A8 8 0 0 0 18.8 15" {...s} /><Path d="M4.5 20.5v-4h4" {...s} /></>)}
      {name === 'send' && <Path d="M20.5 4 3.5 11l6 2.3L12 20l2.8-5.4L20.5 4zM9.5 13.3l11-9.3" {...s} />}
      {name === 'help' && (<><Circle cx={12} cy={12} r={8.5} {...s} /><Path d="M9.7 9.5a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1.9-1.1 1.8" {...s} /><Circle cx={12} cy={16.6} r={0.6} fill={color} stroke={color} strokeWidth={1} /></>)}
      {name === 'fullscreen' && <Path d="M4.5 9V5.5a1 1 0 0 1 1-1H9M15 4.5h3.5a1 1 0 0 1 1 1V9M19.5 15v3.5a1 1 0 0 1-1 1H15M9 19.5H5.5a1 1 0 0 1-1-1V15" {...s} />}
      {name === 'fullscreen-exit' && <Path d="M9 4.5v3.5a1 1 0 0 1-1 1H4.5M19.5 9H16a1 1 0 0 1-1-1V4.5M15 19.5V16a1 1 0 0 1 1-1h3.5M4.5 15H8a1 1 0 0 1 1 1v3.5" {...s} />}
      {name === 'rewind' && (<><Path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" {...s} /><Path d="M4 3.8v3.9h3.9" {...s} /><Path d="M10.2 9.3v5.6M13 9.3h2.2a.8.8 0 0 1 .8.8v1.2a.8.8 0 0 1-.8.8H13v-2.8z" {...s} strokeWidth={1.5} /></>)}
      {name === 'forward' && (<><Path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5" {...s} /><Path d="M20 3.8v3.9h-3.9" {...s} /><Path d="M10.2 9.3v5.6M13 9.3h2.2a.8.8 0 0 1 .8.8v1.2a.8.8 0 0 1-.8.8H13v-2.8z" {...s} strokeWidth={1.5} /></>)}
      {name === 'speed' && (<><Path d="M4.2 17a8.5 8.5 0 1 1 15.6 0" {...s} /><Path d="m12 13 4-4.5" {...s} /><Circle cx={12} cy={13.5} r={1.2} fill={color} stroke={color} strokeWidth={1} /></>)}
      {name === 'lock' && (<><Rect x={5.5} y={10.5} width={13} height={9} rx={2} {...s} /><Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...s} /></>)}
      {name === 'unlock' && (<><Rect x={5.5} y={10.5} width={13} height={9} rx={2} {...s} /><Path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.6-1.6" {...s} /></>)}
      {name === 'episodes' && (<><Rect x={3.5} y={9} width={13} height={9.5} rx={1.5} {...s} /><Path d="M7 6h13a0 0 0 0 1 0 0v10M10 5.5h10.5" {...s} /></>)}
      {name === 'next' && (<><Path d="M6 6.2v11.6c0 .8.9 1.3 1.6.8l8-5.8a1 1 0 0 0 0-1.6l-8-5.8C6.9 4.9 6 5.4 6 6.2z" fill={color} /><Path d="M18.5 5.5v13" {...s} /></>)}
      {name === 'subtitles' && (<><Rect x={3.5} y={5.5} width={17} height={13} rx={2.5} {...s} /><Path d="M7.5 11.5h3M13.5 11.5h3M7.5 15h5M15 15h1.5" {...s} /></>)}
      {name === 'trash' && <Path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7M10.3 10.5v5.5M13.7 10.5v5.5" {...s} />}
      {name === 'edit' && <Path d="M5 19l.8-3.6L16 5.2a1.6 1.6 0 0 1 2.3 0l.5.5a1.6 1.6 0 0 1 0 2.3L8.6 18.2z" {...s} />}
      {name === 'flask' && <Path d="M9.5 4.5h5M10.5 4.5v5.2L5.7 17.5A1.6 1.6 0 0 0 7.1 20h9.8a1.6 1.6 0 0 0 1.4-2.5l-4.8-7.8V4.5M8.5 14.5h7" {...s} />}
      {name === 'plug' && <Path d="M9 4v4M15 4v4M7 8h10v3.5a5 5 0 0 1-10 0zM12 16.5V20" {...s} />}
      {name === 'star' && <Path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.8 5.4-.7z" fill={color} />}
      {name === 'mail' && (<><Rect x={3.5} y={5.5} width={17} height={13} rx={2.5} {...s} /><Path d="m4.5 7.5 7.5 6 7.5-6" {...s} /></>)}
      {name === 'eye' && (<><Path d="M2.8 12S6 5.8 12 5.8 21.2 12 21.2 12 18 18.2 12 18.2 2.8 12 2.8 12z" {...s} /><Circle cx={12} cy={12} r={2.8} {...s} /></>)}
      {name === 'eye-off' && (<><Path d="M4 4l16 16" {...s} /><Path d="M9.8 6.2A8.7 8.7 0 0 1 12 5.8c6 0 9.2 6.2 9.2 6.2a15 15 0 0 1-3 3.6M6.3 7.9A15 15 0 0 0 2.8 12S6 18.2 12 18.2a8.8 8.8 0 0 0 3.5-.7" {...s} /></>)}
      {name === 'aspect' && (<><Rect x={3.5} y={6.5} width={17} height={11} rx={2} {...s} /><Path d="M8 10.5v-1.5h1.5M16 13.5v1.5h-1.5" {...s} /></>)}
    </Svg>
  );
}
