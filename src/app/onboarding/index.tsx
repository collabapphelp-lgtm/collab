import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StepScreen, stepStyles } from '@/components/onboarding/StepScreen';
import { CitySearch, type PickedCity } from '@/components/onboarding/CitySearch';
import { useOnboarding } from '@/lib/onboarding-context';
import { DEFAULT_RADIUS_MILES } from '@/lib/onboarding-data';
import { colors, fonts, radius } from '@/lib/theme';

// Step 1: where are you based?
export default function LocationStep() {
  const { draft, saveStep } = useOnboarding();
  const [city, setCity] = useState<PickedCity | null>(
    draft.location && draft.geo ? { label: draft.location, lat: draft.geo.lat, lng: draft.geo.lng } : null,
  );
  const [global, setGlobal] = useState(draft.global ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function next() {
    if (!city) return;
    setSaving(true);
    setError(null);
    try {
      await saveStep({
        location: city.label,
        geo: { lat: city.lat, lng: city.lng },
        maxDistance: draft.maxDistance ?? DEFAULT_RADIUS_MILES,
        global,
      });
      router.push('/onboarding/type');
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StepScreen
      step="location"
      hideBack
      emoji="📍"
      title="Where are you based?"
      subtitle="We’ll show you creatives nearby first."
      onContinue={next}
      continueDisabled={!city}
      saving={saving}
      error={error}
      footerHint={city ? undefined : 'Pick your city from the list to continue'}
    >
      <View style={stepStyles.card}>
        <Text style={stepStyles.sectionLabel}>Your city</Text>
        <CitySearch value={city} onPick={setCity} />
      </View>

      <Pressable
        onPress={() => setGlobal((g) => !g)}
        style={[styles.globalCard, global && styles.globalCardOn]}
        accessibilityRole="switch"
        accessibilityState={{ checked: global }}
      >
        <Text style={styles.globe}>🌍</Text>
        <View style={styles.globalText}>
          <Text style={styles.globalTitle}>Open to global collabs</Text>
          <Text style={styles.globalBody}>Also connect with creatives anywhere. Remote work welcome.</Text>
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

const styles = StyleSheet.create({
  globalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(75,163,199,0.08)',
  },
  globalCardOn: { borderColor: colors.blue, backgroundColor: 'rgba(75,163,199,0.14)' },
  globe: { fontSize: 28 },
  globalText: { flex: 1 },
  globalTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  globalBody: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 2 },
});
