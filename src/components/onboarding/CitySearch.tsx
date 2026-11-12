import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
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

const milesBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 3959 * 2 * Math.asin(Math.sqrt(h));
};

/**
 * "Use my location": reads the phone's position once, turns it into a city name on the device,
 * then looks that city up so we store the city's own coordinates. The GPS position is never saved.
 */
async function cityFromDevice(): Promise<PickedCity | 'denied' | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return 'denied';
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };

  let place: Location.LocationGeocodedAddress | undefined;
  try {
    [place] = await Location.reverseGeocodeAsync({ latitude: here.lat, longitude: here.lng });
  } catch {
    // Not available on every platform (e.g. web); fall through to the search below.
  }
  const name = place?.city ?? place?.subregion ?? place?.region;
  if (name) {
    const matches = await searchCities(name, new AbortController().signal).catch(() => []);
    const best = matches
      .map((r) => ({ r, d: milesBetween(here, { lat: r.latitude, lng: r.longitude }) }))
      .sort((a, b) => a.d - b.d)[0];
    if (best && best.d < 60) return { label: labelFor(best.r), lat: best.r.latitude, lng: best.r.longitude };
    const country = place?.isoCountryCode === 'US' ? 'USA' : place?.country;
    // Couldn't match a listed city: keep the name and only a rough (~7 mile) position.
    return { label: [name, place?.region, country].filter(Boolean).join(', '), lat: Math.round(here.lat * 10) / 10, lng: Math.round(here.lng * 10) / 10 };
  }
  return null;
}

type Props = { value: PickedCity | null; onPick: (city: PickedCity | null) => void };

export function CitySearch({ value, onPick }: Props) {
  const [query, setQuery] = useState(value?.label ?? '');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [focused, setFocused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState<string | null>(null);

  async function locateMe() {
    setLocating(true);
    setLocateMsg(null);
    try {
      const city = await cityFromDevice();
      if (city === 'denied') setLocateMsg('Location is off for Collab. Search for your city instead, or allow it in Settings.');
      else if (!city) setLocateMsg('Couldn’t work out your city. Try searching for it instead.');
      else {
        setQuery(city.label);
        setResults([]);
        onPick(city);
      }
    } catch {
      setLocateMsg('Couldn’t get your location. Try searching for your city instead.');
    } finally {
      setLocating(false);
    }
  }

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

      {!value && !showList ? (
        <Pressable
          onPress={locateMe}
          disabled={locating}
          style={({ pressed }) => [styles.locate, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          hitSlop={6}
        >
          {locating ? <ActivityIndicator size="small" color={colors.blue} /> : <Ionicons name="navigate" size={16} color={colors.blue} />}
          <Text style={styles.locateText}>{locating ? 'Finding your city…' : 'Use my current location'}</Text>
        </Pressable>
      ) : null}
      {locateMsg && !value ? <Text style={styles.locateMsg}>{locateMsg}</Text> : null}

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
    borderColor: colors.border,
    backgroundColor: colors.white,
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
  locate: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 4 },
  locateText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.blue },
  locateMsg: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, paddingHorizontal: 4 },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, padding: 16 },
});
