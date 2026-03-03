import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, API_BASE, uploadImage } from '../api';
import { colors } from '../theme';
import Screen from '../components/Screen';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

export default function EditServiceScreen({ navigation, route }) {
  const { serviceId } = route?.params || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [image, setImage] = useState(null);
  const [uploadedPath, setUploadedPath] = useState(null);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (!serviceId) return;
    setLoading(true);
    api(`/api/services/${serviceId}`)
      .then((row) => {
        setName(row.service_name || '');
        setDesc(row.service_description || '');
        setUploadedPath(row.service_logo_path || null);
        setImage(null);
      })
      .catch((e) => Alert.alert('Failed', e.message || 'Could not load service'))
      .finally(() => setLoading(false));
  }, [serviceId]);

  const canSubmit = name.trim().length > 0 && !saving && !uploading;

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo library access.');
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
    } catch (e) {
      Alert.alert('Failed', e.message || 'Could not pick image');
    }
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert('Missing info', 'Please enter a service name.');
    setSaving(true);
    try {
      let service_logo_path = uploadedPath;
      if (image?.uri) {
        setUploading(true);
        try {
          service_logo_path = await uploadImage(image);
          setUploadedPath(service_logo_path);
          setImage(null);
        } finally {
          setUploading(false);
        }
      }
      await api(`/api/services/${serviceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          service_name: name.trim(),
          service_description: desc.trim() || undefined,
          service_logo_path: service_logo_path || undefined,
        }),
      });
      Alert.alert('Saved', 'Service updated.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Failed', e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const del = () => {
    Alert.alert('Delete service?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/services/${serviceId}`, { method: 'DELETE' });
            Alert.alert('Deleted', 'Service removed.');
            navigation.goBack();
          } catch (e) {
            Alert.alert('Failed', e.message || 'Could not delete');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading…</Text>
      </Screen>
    );
  }

  const previewUri = image?.uri || (uploadedPath ? `${API_BASE}${uploadedPath}` : null);

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + keyboardHeight }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Edit Service</Text>
        <Text style={styles.subtitle}>Update your service listing</Text>

        <Text style={styles.label}>Photo</Text>
        <View style={styles.photoRow}>
          <TouchableOpacity style={styles.photoBtn} onPress={pickImage} activeOpacity={0.85}>
            <Text style={styles.photoBtnText}>{previewUri ? 'Change photo' : 'Choose photo'}</Text>
          </TouchableOpacity>
          {previewUri ? (
            <TouchableOpacity
              style={[styles.photoBtn, styles.photoBtnOutline]}
              onPress={() => { setImage(null); setUploadedPath(null); }}
              activeOpacity={0.85}
            >
              <Text style={[styles.photoBtnText, styles.photoBtnOutlineText]}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {previewUri ? (
          <View style={styles.photoPreviewWrap}>
            <Image source={{ uri: previewUri }} style={styles.photoPreview} />
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
          placeholder="What you offer…"
          placeholderTextColor={colors.text3}
          value={desc}
          onChangeText={setDesc}
          multiline
        />

        <TouchableOpacity
          style={[styles.btnPrimary, (!canSubmit || saving) && styles.btnDisabled]}
          onPress={save}
          disabled={!canSubmit}
        >
          <Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnDanger} onPress={del}>
          <Text style={styles.btnDangerText}>Delete Service</Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  loadingText: { marginTop: 12, color: colors.text2 },
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
  btnPrimary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDanger: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: colors.dangerLt },
  btnDangerText: { color: colors.danger, fontSize: 16, fontWeight: '700' },
});
