import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '@/lib/theme';

export type PickedCity = { label: string; lat: number; lng: number };

type GeoResult = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  country_code?: string;
  latitude: number;
  longitude: number;
};

// Open-Meteo geocoding: free, no API key, returns coordinates for radius matching.
// Its free tier is for non-commercial use; swap for a paid provider before public launch.
async function searchCities(query: string, signal: AbortSignal): Promise<GeoResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
  const res = await fetch(url, { signal });
  const data = (await res.json()) as { results?: GeoResult[] };
  return data.results ?? [];
}

function labelFor(r: GeoResult) {
  const country = r.country_code === 'US' ? 'USA' : r.country;
  return [r.name, r.admin1, country].filter(Boolean).join(', ');
}

type Props = { value: PickedCity | null; onPick: (city: PickedCity | null) => void };

export function CitySearch({ value, onPick }: Props) {
  const [query, setQuery] = useState(value?.label ?? '');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [focused, setFocused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Don't search again for the city they just picked.
    if (value && query === value.label) return;
    const q = query.trim();
    if (q.length < 2) return; // the list is hidden below 2 characters anyway
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setFailed(false);
      try {
        setResults(await searchCities(q, controller.signal));
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, value]);

  // Not tied to focus: on some platforms tapping a result blurs the input first, which would hide the list mid-tap.
  const showList = !value && query.trim().length >= 2;

  return (
    <View style={styles.wrap}>
      <View style={[styles.box, focused && styles.boxFocused]}>
        <Text style={styles.pin}>📍</Text>
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            if (value) onPick(null); // typing again clears the previous pick
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search your city"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          textContentType="addressCity"
          style={styles.input}
          accessibilityLabel="City"
        />
        {loading ? <ActivityIndicator color={colors.blue} /> : value ? <Text style={styles.ok}>✓</Text> : null}
      </View>

      {showList ? (
        <View style={styles.list}>
          {failed ? (
            <Text style={styles.muted}>Couldn’t search right now. Check your connection and try again.</Text>
          ) : results.length === 0 && !loading ? (
            <Text style={styles.muted}>No cities found</Text>
          ) : (
            results.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => {
                  const picked = { label: labelFor(r), lat: r.latitude, lng: r.longitude };
                  setQuery(picked.label);
                  setResults([]);
                  onPick(picked);
                }}
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: 'rgba(75,163,199,0.08)' }]}
              >
                <Text style={styles.city}>{r.name}</Text>
                <Text style={styles.region}>{[r.admin1, r.country_code === 'US' ? 'USA' : r.country].filter(Boolean).join(', ')}</Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 56,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.bgSecondary,
  },
  boxFocused: { borderColor: colors.blue, backgroundColor: colors.white },
  pin: { fontSize: 18 },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    ...Platform.select({ web: { outlineWidth: 0 }, default: {} }),
  },
  ok: { color: colors.blue, fontSize: 18, fontFamily: fonts.bodySemibold },
  list: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.white },
  item: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  city: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  region: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, padding: 16 },
});
