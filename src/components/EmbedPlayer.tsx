import { Linking, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { EMBED_ORIGIN, embedHtml, type Embed } from '@/lib/embed';

/** Spotify / YouTube / SoundCloud's own player, inside the app. */
export function EmbedPlayer({ embed }: { embed: Embed }) {
  return (
    <View style={[{ width: '100%', borderRadius: 12, overflow: 'hidden' }, embed.aspect ? { aspectRatio: embed.aspect } : { height: embed.height }]}>
      <WebView
        source={{ html: embedHtml(embed.src), baseUrl: EMBED_ORIGIN }}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        scrollEnabled={false}
        style={{ backgroundColor: 'transparent' }}
        // Taps that would leave the player ("Open in Spotify", "Watch on YouTube") open the real app.
        onShouldStartLoadWithRequest={(req) => {
          if (req.isTopFrame === false || req.url === 'about:blank' || req.url.startsWith(EMBED_ORIGIN)) return true;
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
      />
    </View>
  );
}
