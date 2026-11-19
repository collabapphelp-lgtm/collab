import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { StepScreen, useStepStyles } from '@/components/onboarding/StepScreen';
import { CitySearch, type PickedCity } from '@/components/onboarding/CitySearch';
import { NeighborhoodPicker } from '@/components/onboarding/NeighborhoodPicker';
import { isNyc, neighborhoodFromLabel, neighborhoodLabel, type Neighborhood } from '@/lib/nyc-neighborhoods';
import { useOnboarding } from '@/lib/onboarding-context';
import { DEFAULT_RADIUS_MILES } from '@/lib/onboarding-data';
import { fonts, radius, makeStyles, useColors } from '@/lib/theme';

// Step 1: where are you based?
export default function LocationStep() {
  const styles = useStyles();
  const stepStyles = useStepStyles();
  const colors = useColors();
  const { draft, saveStep, advance } = useOnboarding();
  const [city, setCity] = useState<PickedCity | null>(
    draft.location && draft.geo ? { label: draft.location, lat: draft.geo.lat, lng: draft.geo.lng } : null,
  );
  const [hood, setHood] = useState<Neighborhood | null>(neighborhoodFromLabel(draft.location) ?? null);
  const inNyc = !!city && isNyc(city.lat, city.lng);
  function pickCity(c: PickedCity | null) {
    setCity(c);
    setHood(neighborhoodFromLabel(c?.label) ?? null); // "Use my location" in NYC already picks one
  }
  const [global, setGlobal] = useState(draft.global ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function next() {
    if (!city) return;
    setSaving(true);
    setError(null);
    try {
      // In NYC the neighborhood is the location, with its center as the position.
      const spot = inNyc && hood ? { label: neighborhoodLabel(hood), lat: hood.lat, lng: hood.lng } : city;
      await saveStep({
        location: spot.label,
        geo: { lat: spot.lat, lng: spot.lng },
        maxDistance: draft.maxDistance ?? DEFAULT_RADIUS_MILES,
        global,
      });
      advance('/onboarding/type');
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function skip() {
    setSaving(true);
    try {
      await saveStep({ global: true });
    } catch {
      // Not critical; they can set location later.
    } finally {
      setSaving(false);
    }
    advance('/onboarding/type');
  }

  return (
    <StepScreen
      step="location"
      onSkip={skip}
      hideBack
      title="Where are you based?"
      subtitle="We’ll show you creatives nearby first."
      onContinue={next}
      continueDisabled={!city}
      saving={saving}
      error={error}
      footerHint={!city ? 'Pick your city from the list to continue' : inNyc && !hood ? 'Add your neighborhood so people nearby find you' : undefined}
    >
      <View style={stepStyles.card}>
        <Text style={stepStyles.sectionLabel}>Your city</Text>
        <CitySearch value={city} onPick={pickCity} />
      </View>

      {inNyc ? (
        <View style={stepStyles.card}>
          <Text style={stepStyles.sectionLabel}>Your neighborhood</Text>
          <Text style={styles.hoodNote}>So people see Bushwick or Astoria, not just New York.</Text>
          <NeighborhoodPicker value={hood} onPick={setHood} />
        </View>
      ) : null}

      <Pressable
        onPress={() => setGlobal((g) => !g)}
        style={[styles.globalCard, global && styles.globalCardOn]}
        accessibilityRole="switch"
        accessibilityState={{ checked: global }}
      >
        <Text style={styles.globe}>🌍</Text>
        <View style={styles.globalText}>
          <Text style={styles.globalTitle}>Open to global collabs</Text>
          <Text style={styles.globalBody}>Also connect with creatives anywhere in the world.</Text>
        </View>
        <Switch
          value={global}
          onValueChange={setGlobal}
          trackColor={{ true: colors.blue, false: colors.border }}
          accessibilityLabel="Open to global collabs"
        />
      </Pressable>

    </StepScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  globalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  globalCardOn: { borderColor: colors.blue, backgroundColor: '#E8F3F8' },
  globe: { fontSize: 28 },
  globalText: { flex: 1 },
  globalTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  hoodNote: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: -4, marginBottom: 4 },
  globalBody: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 2 },
}));
