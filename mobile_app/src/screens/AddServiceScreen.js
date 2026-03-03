import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, API_BASE, uploadImage } from '../api';
import { colors } from '../theme';
import Screen from '../components/Screen';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

export default function AddServiceScreen({ navigation }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [image, setImage] = useState(null);
  const [uploadedPath, setUploadedPath] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const keyboardHeight = useKeyboardHeight();

  const canSubmit = name.trim().length > 0 && !saving && !uploading;

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo library access to choose a picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setImage({
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName || 'image.jpg',
      });
      setUploadedPath(null);
    } catch (e) {
      Alert.alert('Failed', e.message || 'Could not pick image');
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Please enter a service name.');
      return;
    }
    setSaving(true);
    try {
      let service_logo_path = uploadedPath;
      if (image?.uri && !service_logo_path) {
        setUploading(true);
        try {
          service_logo_path = await uploadImage(image);
          setUploadedPath(service_logo_path);
        } finally {
          setUploading(false);
        }
      }
      await api('/api/services', {
        method: 'POST',
        body: JSON.stringify({
          service_name: name.trim(),
          service_description: desc.trim() || undefined,
          service_logo_path: service_logo_path || undefined,
        }),
      });
      Alert.alert('Success', 'Service created. You can only list one service—edit or delete it to replace.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Failed', e.message || 'Could not create service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + keyboardHeight }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add Service</Text>
        <Text style={styles.subtitle}>List your business or service (one per account)</Text>

        <Text style={styles.label}>Photo (optional)</Text>
        <View style={styles.photoRow}>
          <TouchableOpacity style={styles.photoBtn} onPress={pickImage} activeOpacity={0.85}>
            <Text style={styles.photoBtnText}>{image ? 'Change photo' : 'Choose photo'}</Text>
          </TouchableOpacity>
          {image ? (
            <TouchableOpacity
              style={[styles.photoBtn, styles.photoBtnOutline]}
              onPress={() => { setImage(null); setUploadedPath(null); }}
              activeOpacity={0.85}
            >
              <Text style={[styles.photoBtnText, styles.photoBtnOutlineText]}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {image?.uri ? (
          <View style={styles.photoPreviewWrap}>
            <Image source={{ uri: image.uri }} style={styles.photoPreview} />
            {uploading ? (
              <View style={styles.photoUploading}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.photoUploadingText}>Uploading…</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.label}>Service name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Plumbing & Repairs"
          placeholderTextColor={colors.text3}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What you offer, area, contact info…"
          placeholderTextColor={colors.text3}
          value={desc}
          onChangeText={setDesc}
          multiline
        />

        <TouchableOpacity
          style={[styles.btnPrimary, (!canSubmit || saving) && styles.btnDisabled]}
          onPress={submit}
          disabled={!canSubmit}
        >
          <Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : 'Create Service'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.text2, marginTop: 4, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text2, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  textArea: { minHeight: 92, textAlignVertical: 'top' },
  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  photoBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center' },
  photoBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  photoBtnOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  photoBtnOutlineText: { color: colors.text2 },
  photoPreviewWrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface2, marginBottom: 16 },
  photoPreview: { width: '100%', height: 180, backgroundColor: colors.surface2 },
  photoUploading: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  photoUploadingText: { color: '#fff', fontWeight: '700' },
  btnPrimary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
