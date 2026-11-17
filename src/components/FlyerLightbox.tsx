import { Modal, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

/** Full-screen view of an event flyer. Tap anywhere to close. */
export function FlyerLightbox({ uri, open, onClose }: { uri: string; open: boolean; onClose: () => void }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.wrap} onPress={onClose} accessibilityLabel="Close flyer">
        <Image source={{ uri }} style={styles.image} contentFit="contain" transition={150} />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(8,10,14,0.95)', padding: 16, paddingVertical: 60 },
  image: { flex: 1 },
});
