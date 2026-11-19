import { createElement } from 'react';
import { View } from 'react-native';
import type { Embed } from '@/lib/embed';

/** Web (design previews): a plain iframe. */
export function EmbedPlayer({ embed }: { embed: Embed }) {
  return (
    <View style={[{ width: '100%', borderRadius: 12, overflow: 'hidden' }, embed.aspect ? { aspectRatio: embed.aspect } : { height: embed.height }]}>
      {createElement('iframe', { src: embed.src, style: { border: 0, width: '100%', height: '100%' }, allow: 'autoplay; encrypted-media; fullscreen' })}
    </View>
  );
}
