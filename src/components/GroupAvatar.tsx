import { StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import type { Group } from '@/lib/connections';
import { displayName } from '@/lib/labels';
import { colors } from '@/lib/theme';

/** Two overlapping faces for a group chat. */
export function GroupAvatar({ group, me, size }: { group: Group; me: string; size: number }) {
  const faces = [...group.members, ...group.invited]
    .filter((u) => u !== me)
    .map((u) => group.people[u])
    .filter(Boolean)
    .slice(0, 2);
  const small = Math.round(size * 0.72);
  return (
    <View style={{ width: size, height: size }}>
      {faces[1] ? (
        <View style={styles.back}>
          <Avatar uri={faces[1].photoURL} name={displayName(faces[1])} seed={faces[1].id} size={small} />
        </View>
      ) : null}
      {faces[0] ? (
        <View style={[styles.front, { borderRadius: small / 2 + 2 }]}>
          <Avatar uri={faces[0].photoURL} name={displayName(faces[0])} seed={faces[0].id} size={small} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', top: 0, right: 0 },
  front: { position: 'absolute', bottom: 0, left: 0, borderWidth: 2, borderColor: colors.white, backgroundColor: colors.white },
});
