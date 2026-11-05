import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Sheet } from '@/components/onboarding/Sheet';
import { Button } from '@/components/Button';
import { useAuth } from '@/lib/auth-context';
import { blockUser, reportUser, REPORT_REASONS } from '@/lib/safety';
import type { UserProfile } from '@/lib/types';
import { colors, fonts, radius } from '@/lib/theme';

type Props = {
  them: UserProfile;
  /** Called after a successful block (e.g. leave the chat, move to the next card). */
  onBlocked?: () => void;
  tone?: 'light' | 'dark';
};

/** "⋯" button with Report and Block. Required by Apple for apps with user profiles and messaging. */
export function SafetyButton({ them, onBlocked, tone = 'dark' }: Props) {
  const { user } = useAuth();
  const [reporting, setReporting] = useState(false);

  function confirmBlock() {
    Alert.alert(
      `Block ${them.firstName}?`,
      'They won’t show up for you anymore, and if you’re connected, your chat will close. They won’t be told.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              await blockUser(user.uid, them.id);
              onBlocked?.();
            } catch {
              Alert.alert('Couldn’t block', 'Check your connection and try again.');
            }
          },
        },
      ],
    );
  }

  function openMenu() {
    const options = [`Report ${them.firstName}`, `Block ${them.firstName}`, 'Cancel'];
    const handle = (i: number) => {
      if (i === 0) setReporting(true);
      if (i === 1) confirmBlock();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, destructiveButtonIndex: 1, cancelButtonIndex: 2 }, handle);
    } else {
      Alert.alert(them.firstName, undefined, [
        { text: options[0], onPress: () => handle(0) },
        { text: options[1], style: 'destructive', onPress: () => handle(1) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  return (
    <>
      <Pressable
        onPress={openMenu}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`More options for ${them.firstName}`}
        style={[styles.btn, tone === 'light' && styles.btnLight]}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
      </Pressable>
      <ReportSheet
        key={reporting ? 'open' : 'closed'}
        visible={reporting}
        them={them}
        onClose={() => setReporting(false)}
        onDone={(alsoBlock) => {
          setReporting(false);
          if (alsoBlock) confirmBlock();
        }}
      />
    </>
  );
}

function ReportSheet(props: { visible: boolean; them: UserProfile; onClose: () => void; onDone: (alsoBlock: boolean) => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!user || !reason) return;
    setSending(true);
    setError(null);
    try {
      await reportUser(user.uid, props.them.id, reason, details);
      setSent(true);
    } catch {
      setError('Couldn’t send the report. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Sheet visible={props.visible} title="Thanks for telling us" onClose={() => props.onDone(false)}>
        <Text style={styles.body}>
          We’ll review your report. Reports are confidential, and {props.them.firstName} won’t know who sent it.
        </Text>
        <Button title={`Also block ${props.them.firstName}`} onPress={() => props.onDone(true)} />
        <Button title="Done" variant="secondary" onPress={() => props.onDone(false)} />
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={props.visible}
      title={`Report ${props.them.firstName}`}
      onClose={props.onClose}
      footer={<Button title="Send report" onPress={submit} disabled={!reason} loading={sending} />}
    >
      <Text style={styles.body}>What’s going on? Your report is confidential.</Text>
      {REPORT_REASONS.map((r) => (
        <Pressable
          key={r}
          onPress={() => setReason(r)}
          accessibilityRole="radio"
          accessibilityState={{ selected: reason === r }}
          style={[styles.reason, reason === r && styles.reasonOn]}
        >
          <Text style={[styles.reasonText, reason === r && { color: colors.blue }]}>{r}</Text>
          {reason === r ? <Ionicons name="checkmark" size={18} color={colors.blue} /> : null}
        </Pressable>
      ))}
      <View style={styles.detailsBox}>
        <TextInput
          value={details}
          onChangeText={setDetails}
          placeholder="Anything else we should know? (optional)"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={1000}
          style={styles.details}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  btn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  btnLight: { backgroundColor: 'rgba(255,255,255,0.92)' },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.textSecondary },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  reasonOn: { borderColor: colors.blue, backgroundColor: 'rgba(75,163,199,0.06)' },
  reasonText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  detailsBox: { borderRadius: radius.md, backgroundColor: colors.bgSecondary, padding: 12 },
  details: {
    minHeight: 80,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
    ...Platform.select({ web: { outlineWidth: 0 }, default: {} }),
  },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.red, textAlign: 'center' },
});
