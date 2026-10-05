import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

/**
 * Lets the user pick a photo, compresses it (max 1200 px wide, JPEG) and
 * returns a FormData ready for a multipart POST, or null if cancelled/denied.
 */
export async function pickPhotoForm(
  field: string,
  extra: Record<string, string> = {},
): Promise<FormData | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.9,
  });
  if (result.canceled) return null;

  const compressed = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
  );

  const form = new FormData();
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  if (Platform.OS === "web") {
    const blob = await (await fetch(compressed.uri)).blob();
    form.append(field, blob, `${field}.jpg`);
  } else {
    form.append(field, { uri: compressed.uri, name: `${field}.jpg`, type: "image/jpeg" } as any);
  }
  return form;
}
