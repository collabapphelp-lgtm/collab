import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PickedFlyer = { uri: string; aspect: number };

/** Picks a flyer from Photos, uncropped (flyers come in every shape). */
export async function pickFlyer(): Promise<PickedFlyer | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && perm.accessPrivileges !== 'limited') {
    Alert.alert('Allow photo access', 'To add a flyer, let Collab use your photos in Settings.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, aspect: a.width && a.height ? a.width / a.height : 0.8 };
}
