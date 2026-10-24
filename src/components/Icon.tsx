import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type IconName = 'home' | 'search' | 'user' | 'play' | 'back' | 'heart' | 'plus' | 'check' | 'chevron-down';

export function Icon({ name, size = 22, color = '#fff', filled = false }: {
  name: IconName; size?: number; color?: string; filled?: boolean;
}) {
  const s = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'home' && <Path d="M4 11.2 12 4l8 7.2V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z" {...s} />}
      {name === 'search' && (<><Circle cx={11} cy={11} r={6.5} {...s} /><Path d="m16 16 4.5 4.5" {...s} /></>)}
      {name === 'user' && (<><Circle cx={12} cy={8.5} r={3.5} {...s} /><Path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" {...s} /></>)}
      {name === 'play' && <Path d="M8 5.8v12.4c0 .8.9 1.3 1.6.8l9-6.2a1 1 0 0 0 0-1.6l-9-6.2c-.7-.5-1.6 0-1.6.8z" fill={color} />}
      {name === 'back' && <Path d="m14.5 5.5-6.5 6.5 6.5 6.5" {...s} />}
      {name === 'heart' && <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...s} fill={filled ? color : 'none'} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...s} />}
      {name === 'check' && <Path d="m5 12.5 4.5 4.5L19 7.5" {...s} />}
      {name === 'chevron-down' && <Path d="m6 9.5 6 6 6-6" {...s} />}
    </Svg>
  );
}
