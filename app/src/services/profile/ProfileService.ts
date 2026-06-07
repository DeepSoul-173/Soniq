import * as ImagePicker from 'expo-image-picker';
import { useSettingsStore } from '@/src/store/settingsStore';

export class ProfileService {
  static updateDisplayName(displayName: string) {
    useSettingsStore.getState().updateSetting('displayName', displayName);
  }

  static updateProfileImage(profileImageUri: string) {
    useSettingsStore.getState().updateSetting('profileImageUri', profileImageUri);
  }

  static async pickProfileImage(): Promise<string | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]?.uri) return null;

    this.updateProfileImage(result.assets[0].uri);
    return result.assets[0].uri;
  }

  /** Pick a photo from the device to use as the app-wide background. */
  static async pickBackgroundImage(): Promise<string | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]?.uri) return null;

    const uri = result.assets[0].uri;
    const { updateSetting } = useSettingsStore.getState();
    updateSetting('backgroundType', 'image');
    updateSetting('backgroundValue', uri);
    return uri;
  }
}
