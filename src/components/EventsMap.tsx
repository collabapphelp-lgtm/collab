import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { AppleMaps as AppleMapsTypes } from 'expo-maps';
import { inNyc, metaFor, type EventOccurrence } from '@/lib/events';
import { UI_PREVIEW } from '@/lib/preview';
import { colors, fonts } from '@/lib/theme';

// expo-maps loads its native module as soon as it's imported, which throws on web. Load it only where it exists.
const AppleMaps: typeof import('expo-maps').AppleMaps | null = Platform.OS === 'ios' ? safeRequire() : null;
function safeRequire() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('expo-maps') as typeof import('expo-maps')).AppleMaps;
  } catch {
    return null;
  }
}

const NYC_CENTER = { latitude: 40.7306, longitude: -73.9566 };

/** Apple Maps (via expo-maps) needs iOS 17+. Elsewhere the Events tab shows the list only. */
export const MAP_SUPPORTED =
  Platform.OS === 'ios' ? !!AppleMaps && parseInt(String(Platform.Version), 10) >= 17 : Platform.OS === 'web' && UI_PREVIEW;

type Props = {
  /** Already filtered to what the person is looking at. One pin per listing (the soonest date). */
  events: EventOccurrence[];
  selectedKey?: string | null;
  onSelect: (e: EventOccurrence | null) => void;
  style?: StyleProp<ViewStyle>;
};

export function EventsMap({ events, selectedKey, onSelect, style }: Props) {
  // The same weekly open mic shouldn't stack 3 pins on top of each other in "This week".
  const pins = useMemo(() => {
    const seen = new Map<string, EventOccurrence>();
    for (const e of events) if (!seen.has(e.eventId) && inNyc(e.lat, e.lng)) seen.set(e.eventId, e);
    return [...seen.values()];
  }, [events]);

  const markers = useMemo<AppleMapsTypes.Marker[]>(
    () =>
      pins.map((e) => {
        const meta = metaFor(e);
        return {
          id: e.key,
          coordinates: { latitude: e.lat, longitude: e.lng },
          title: e.title,
          systemImage: meta.symbol,
          tintColor: e.key === selectedKey ? colors.text : meta.color,
        };
      }),
    [pins, selectedKey],
  );

  if (Platform.OS === 'web') return <PreviewBoard pins={pins} selectedKey={selectedKey} style={style} />;
  if (!MAP_SUPPORTED || !AppleMaps) return null;

  return (
    <AppleMaps.View
      style={style}
      cameraPosition={{ coordinates: NYC_CENTER, zoom: 11 }}
      markers={markers}
      uiSettings={{ compassEnabled: false, togglePitchEnabled: false, myLocationButtonEnabled: false }}
      properties={{ pointsOfInterest: { including: [] }, selectionEnabled: false }}
      onMarkerClick={(m) => onSelect(pins.find((p) => p.key === m.id) ?? null)}
      onMapClick={() => onSelect(null)}
    />
  );
}

/**
 * Web/UI-preview stand-in so screens can be reviewed in a browser: pins placed by coordinates on a plain
 * NYC-shaped board. The real app uses Apple Maps.
 */
function PreviewBoard({ pins, selectedKey, style }: { pins: EventOccurrence[]; selectedKey?: string | null; style?: StyleProp<ViewStyle> }) {
  const { minLat, maxLat, minLng, maxLng } = { minLat: 40.62, maxLat: 40.84, minLng: -74.06, maxLng: -73.86 };
  return (
    <View style={[style, board.wrap]}>
      <View style={[board.water, { left: '-10%', top: 0, width: '38%', height: '100%', transform: [{ rotate: '14deg' }] }]} />
      <View style={[board.water, { left: '52%', top: '-5%', width: '9%', height: '75%', transform: [{ rotate: '18deg' }] }]} />
      <View style={[board.water, { left: '20%', top: '86%', width: '80%', height: '30%' }]} />
      <Text style={[board.area, { left: '40%', top: '30%' }]}>Manhattan</Text>
      <Text style={[board.area, { left: '64%', top: '62%' }]}>Brooklyn</Text>
      <Text style={[board.area, { left: '70%', top: '24%' }]}>Queens</Text>
      {pins.map((e) => {
        const x = ((e.lng - minLng) / (maxLng - minLng)) * 100;
        const y = ((maxLat - e.lat) / (maxLat - minLat)) * 100;
        if (x < 0 || x > 100 || y < 0 || y > 100) return null;
        const sel = e.key === selectedKey;
        return (
          <View
            key={e.key}
            style={[
              board.pin,
              { left: `${x}%`, top: `${y}%`, backgroundColor: sel ? colors.text : metaFor(e).color },
              sel && { transform: [{ scale: 1.25 }] },
            ]}
          />
        );
      })}
      <Text style={board.note}>Map preview · Apple Maps on iPhone</Text>
    </View>
  );
}

const board = StyleSheet.create({
  wrap: { backgroundColor: '#EEF0E8', overflow: 'hidden' },
  water: { position: 'absolute', backgroundColor: '#C9DFEA' },
  area: { position: 'absolute', fontFamily: fonts.bodyMedium, fontSize: 11, color: '#9AA29A', letterSpacing: 0.5 },
  pin: {
    position: 'absolute',
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -18,
    borderRadius: 9,
    borderBottomLeftRadius: 2,
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ rotate: '-45deg' }],
  },
  note: { position: 'absolute', right: 8, bottom: 6, fontFamily: fonts.body, fontSize: 10, color: '#8A8F98' },
});
