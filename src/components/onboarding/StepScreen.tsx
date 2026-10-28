import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { useAuth } from '@/lib/auth-context';
import { ONBOARDING_STEPS, type OnboardingStep } from '@/lib/onboarding-context';
import { colors, fonts, radius } from '@/lib/theme';

type Props = {
  step: OnboardingStep;
  title: string;
  subtitle?: string;
  emoji?: string;
  children: ReactNode;
  continueLabel?: string;
  continueDisabled?: boolean;
  saving?: boolean;
  error?: string | null;
  /** Small hint under the button, e.g. "Pick at least one". */
  footerHint?: string;
  onContinue: () => void;
  /** Hide the back button (first step). */
  hideBack?: boolean;
  /** Shows a "Skip" link at the top right. */
  onSkip?: () => void;
};

/** Shared layout for every onboarding step: progress bar, back, title, scrolling body, pinned Continue. */
export function StepScreen(props: Props) {
  const { signOutUser } = useAuth();
  const index = ONBOARDING_STEPS.indexOf(props.step);
  const progress = (index + 1) / ONBOARDING_STEPS.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.progressTrack} accessibilityLabel={`Step ${index + 1} of ${ONBOARDING_STEPS.length}`}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            {props.hideBack ? (
              // First step has nowhere to go back to; offer a way out instead.
              <Pressable onPress={signOutUser} hitSlop={10} accessibilityRole="button">
                <Text style={styles.logout}>Log out</Text>
              </Pressable>
            ) : (
              <BackButton onPress={() => router.back()} />
            )}
            <View style={styles.topRight}>
              <Text style={styles.stepCount}>
                {index + 1} of {ONBOARDING_STEPS.length}
              </Text>
              {props.onSkip ? (
                <Pressable onPress={props.onSkip} hitSlop={10} accessibilityRole="button" disabled={props.saving}>
                  <Text style={styles.skip}>Skip</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.header}>
            {props.emoji ? <Text style={styles.emoji}>{props.emoji}</Text> : null}
            <Text style={styles.title}>{props.title}</Text>
            {props.subtitle ? <Text style={styles.subtitle}>{props.subtitle}</Text> : null}
          </View>

          {props.children}
        </ScrollView>

        <View style={styles.footer}>
          <ErrorText message={props.error ?? null} />
          <Button
            title={props.continueLabel ?? 'Continue'}
            onPress={props.onContinue}
            disabled={props.continueDisabled}
            loading={props.saving}
          />
          {props.footerHint ? <Text style={styles.hint}>{props.footerHint}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  progressTrack: { height: 4, backgroundColor: colors.border, marginHorizontal: 24, borderRadius: 2, marginTop: 4 },
  progressFill: { height: 4, backgroundColor: colors.blue, borderRadius: 2 },
  content: { padding: 24, paddingTop: 12, paddingBottom: 32, gap: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logout: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.textSecondary, paddingVertical: 12 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  skip: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.blue, paddingVertical: 10 },
  stepCount: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  header: { gap: 6 },
  emoji: { fontSize: 36, marginBottom: 2 },
  title: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 33, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.textSecondary },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});

export const stepStyles = StyleSheet.create({
  sectionLabel: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  card: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    gap: 12,
    backgroundColor: colors.white,
  },
});
