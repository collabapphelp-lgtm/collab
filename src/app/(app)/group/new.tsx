import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { useAuth } from '@/lib/auth-context';
import { createGroup, GROUP_MAX_PEOPLE } from '@/lib/connections';
import { displayName, roleLine } from '@/lib/labels';
import { BLOCKED_LANGUAGE_MESSAGE, hasBlockedLanguage } from '@/lib/moderation';
import { useMatches } from '@/lib/use-matches';
import { fonts, makeStyles, useColors } from '@/lib/theme';

const MAX_PICKS = GROUP_MAX_PEOPLE - 1;

/** Start a group chat with 2–5 of your connections. They each get an invite to join. */
export default function NewGroup() {
  const styles = useStyles();
  const colors = useColors();
  const { profile } = useAuth();
  const { matches } = useMatches();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const people = (matches ?? [])
    .map((m) => m.other)
    .filter((p) => !q || `${displayName(p)} ${roleLine(p, 4)}`.toLowerCase().includes(q));

  function toggle(id: string) {
    setError(null);
    setPicked((list) => {
      if (list.includes(id)) return list.filter((x) => x !== id);
      if (list.length >= MAX_PICKS) {
        setError(`Groups can have up to ${GROUP_MAX_PEOPLE} people, including you.`);
        return list;
      }
      return [...list, id];
    });
  }

  async function create() {
    if (!profile || picked.length < 2) return;
    if (hasBlockedLanguage(name)) return setError(BLOCKED_LANGUAGE_MESSAGE);
    setSaving(true);
    setError(null);
    try {
      const invite = (matches ?? []).map((m) => m.other).filter((p) => picked.includes(p.id));
      const id = await createGroup(profile, invite, name);
      router.replace({ pathname: '/chat/[id]', params: { id } });
    } catch (e) {
      console.warn('Create group failed', e);
      setError((e as { message?: string }).message?.replace(/^.*?:\s*/, '') || 'Couldn’t create the group. Try again.');
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>New group</Text>
          <View style={{ width: 52 }} />
        </View>

        <View style={styles.top}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Group name (optional), e.g. Sunday session"
            placeholderTextColor={colors.textMuted}
            maxLength={40}
            style={styles.nameInput}
            accessibilityLabel="Group name"
          />
          <Text style={styles.explain}>
            Pick 2 to {MAX_PICKS} of your connections. They’ll get an invite, and anyone who joins gets connected with the others in the
            chat too.
          </Text>
          <View style={styles.search}>
            <Ionicons name="search" size={17} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search your connections"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              accessibilityLabel="Search your connections"
            />
          </View>
        </View>

        <FlatList
          data={people}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>{matches?.length ? 'No one matches that search.' : 'Connect with people first.'}</Text>}
          renderItem={({ item }) => {
            const on = picked.includes(item.id);
            return (
              <Pressable
                onPress={() => toggle(item.id)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgSecondary }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={displayName(item)}
              >
                <Avatar uri={item.photoURL} name={displayName(item)} seed={item.id} size={46} />
                <View style={styles.flex}>
                  <Text style={styles.name} numberOfLines={1}>
                    {displayName(item)}
                  </Text>
                  <Text style={styles.role} numberOfLines={1}>
                    {roleLine(item, 2)}
                  </Text>
                </View>
                <View style={[styles.check, on && styles.checkOn]}>{on ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}</View>
              </Pressable>
            );
          }}
        />

        <View style={styles.footer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={picked.length < 2 ? 'Pick at least 2 people' : `Start group with ${picked.length}`}
            onPress={create}
            disabled={picked.length < 2}
            loading={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  cancel: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.blue, width: 52 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  top: { paddingHorizontal: 20, gap: 12, paddingBottom: 10 },
  nameInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.text,
  },
  explain: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  name: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  role: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  error: { fontFamily: fonts.body, fontSize: 14, color: colors.red, textAlign: 'center' },
}));
