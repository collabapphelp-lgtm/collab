import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts, radius, makeStyles, useColors } from '@/lib/theme';
import { nearestNeighborhood, searchNeighborhoods, type Neighborhood } from '@/lib/nyc-neighborhoods';

type Props = { value: Neighborhood | null; onPick: (n: Neighborhood | null) => void };

/** For people in NYC: pick a neighborhood so cards say "Bushwick, Brooklyn" instead of "New York". */
export function NeighborhoodPicker({ value, onPick }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const results = searchNeighborhoods(query);

  async function locateMe() {
    setLocating(true);
    setMsg(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return setMsg('Location is off for Collab. Search for your neighborhood instead.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const n = nearestNeighborhood(pos.coords.latitude, pos.coords.longitude);
      if (n) onPick(n);
      else setMsg('Looks like you’re outside the city right now. Search for your neighborhood instead.');
    } catch {
      setMsg('Couldn’t get your location. Search for your neighborhood instead.');
    } finally {
      setLocating(false);
    }
  }

  if (value) {
    return (
      <View style={styles.picked}>
        <Ionicons name="location" size={18} color={colors.blue} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pickedName}>{value.name}</Text>
          <Text style={styles.pickedBorough}>{value.borough}</Text>
        </View>
        <Pressable onPress={() => { setQuery(''); onPick(null); }} hitSlop={8} accessibilityRole="button">
          <Text style={styles.change}>Change</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.box}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search, like Bushwick or Astoria"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel="Neighborhood"
        />
      </View>
      {query.trim() ? (
        <View style={styles.list}>
          {results.length === 0 ? (
            <Text style={styles.muted}>No neighborhood by that name. Try a nearby one.</Text>
          ) : (
            results.map((n) => (
              <Pressable
                key={`${n.name}-${n.borough}`}
                onPress={() => onPick(n)}
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: 'rgba(75,163,199,0.08)' }]}
              >
                <Text style={styles.name}>{n.name}</Text>
                <Text style={styles.borough}>{n.borough}</Text>
              </Pressable>
            ))
          )}
        </View>
      ) : (
        <Pressable onPress={locateMe} disabled={locating} style={({ pressed }) => [styles.locate, pressed && { opacity: 0.7 }]} accessibilityRole="button" hitSlop={6}>
          {locating ? <ActivityIndicator size="small" color={colors.blue} /> : <Ionicons name="navigate" size={16} color={colors.blue} />}
          <Text style={styles.locateText}>{locating ? 'Finding your neighborhood…' : 'Use my current location'}</Text>
        </Pressable>
      )}
      {msg ? <Text style={styles.muted}>{msg}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: 8 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  input: { flex: 1, height: '100%', fontFamily: fonts.body, fontSize: 16, color: colors.text, ...Platform.select({ web: { outlineWidth: 0 }, default: {} }) },
  list: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.white },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  name: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  borough: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 2, borderColor: colors.blue, backgroundColor: '#E8F3F8' },
  pickedName: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  pickedBorough: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  change: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue },
  locate: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4 },
  locateText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.blue },
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, paddingHorizontal: 4, paddingVertical: 8 },
}));
