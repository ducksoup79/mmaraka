/**
 * Add or edit product: image picker + uploadImage, categories from /api/misc/categories, POST or PATCH /api/products.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, API_BASE, uploadImage } from '../api';
import { colors } from '../theme';
import Screen from '../components/Screen';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

export default function AddProductScreen({ navigation }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [loadingCats, setLoadingCats] = useState(true);
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState(null); // { uri, mimeType, fileName }
  const [uploadedPath, setUploadedPath] = useState(null); // /uploads/...
  const [uploading, setUploading] = useState(false);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    api('/api/misc/categories')
      .then((rows) => {
        setCategories(Array.isArray(rows) ? rows : []);
      })
      .catch(() => setCategories([]))
      .finally(() => setLoadingCats(false));
  }, []);

  const canSubmit = useMemo(() => {
    const p = Number(String(price).replace(/,/g, ''));
    return name.trim().length > 0 && Number.isFinite(p) && p > 0 && !!categoryId && !saving && !uploading;
  }, [name, price, categoryId, saving, uploading]);

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
        fileName: asset.fileName || (asset.mimeType?.includes('png') ? 'image.png' : 'image.jpg'),
      });
      setUploadedPath(null);
    } catch (e) {
      Alert.alert('Failed', e.message || 'Could not pick image');
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Please enter a product name.');
      return;
    }
    const p = Number(String(price).replace(/,/g, ''));
    if (!Number.isFinite(p) || p <= 0) {
      Alert.alert('Invalid price', 'Enter a valid price (e.g. 120).');
      return;
    }
    if (!categoryId) {
      Alert.alert('Missing info', 'Please select a category.');
      return;
    }

    setSaving(true);
    try {
      let product_image_path = uploadedPath;
      if (image?.uri && !product_image_path) {
        setUploading(true);
        try {
          product_image_path = await uploadImage(image);
          setUploadedPath(product_image_path);
        } finally {
          setUploading(false);
        }
      }

      await api('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          product_name: name.trim(),
          product_description: desc.trim() || undefined,
          product_price: p,
          category_id: categoryId,
          product_image_path: product_image_path || undefined,
        }),
      });
      Alert.alert('Success', 'Listing created.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Failed', e.message || 'Could not create listing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + keyboardHeight }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add Listing</Text>
        <Text style={styles.subtitle}>Create a product listing on Mmaraka</Text>

      <Text style={styles.label}>Photo</Text>
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

      <Text style={styles.label}>Product name *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. iPhone 12"
        placeholderTextColor={colors.text3}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Optional details…"
        placeholderTextColor={colors.text3}
        value={desc}
        onChangeText={setDesc}
        multiline
      />

      <Text style={styles.label}>Price (BWP) *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 120"
        placeholderTextColor={colors.text3}
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Category *</Text>
      {loadingCats ? (
        <View style={styles.catsLoading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.catsLoadingText}>Loading categories…</Text>
        </View>
      ) : (
        <View style={styles.chipsWrap}>
          {categories.map((c) => {
            const active = categoryId === c.category_id;
            return (
              <TouchableOpacity
                key={c.category_id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCategoryId(c.category_id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.category_name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

        <TouchableOpacity
          style={[styles.btnPrimary, (!canSubmit || saving) && styles.btnDisabled]}
          onPress={submit}
          disabled={!canSubmit}
        >
          <Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : 'Create Listing'}</Text>
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
  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  photoBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center' },
  photoBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  photoBtnOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  photoBtnOutlineText: { color: colors.text2 },
  photoPreviewWrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface2, marginBottom: 16 },
  photoPreview: { width: '100%', height: 220, backgroundColor: colors.surface2 },
  photoUploading: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  photoUploadingText: { color: '#fff', fontWeight: '700' },
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
  catsLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  catsLoadingText: { color: colors.text2 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.surface2 },
  chipActive: { backgroundColor: colors.accentLt },
  chipText: { color: colors.text2, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: colors.accent, fontWeight: '700' },
  btnPrimary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

