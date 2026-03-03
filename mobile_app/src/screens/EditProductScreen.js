import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, API_BASE, uploadImage } from '../api';
import { colors } from '../theme';
import Screen from '../components/Screen';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

export default function EditProductScreen({ navigation, route }) {
  const { listingId } = route?.params || {};

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState('avail'); // avail | sold | dormant

  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [loadingCats, setLoadingCats] = useState(true);

  const [image, setImage] = useState(null); // { uri, mimeType, fileName }
  const [uploadedPath, setUploadedPath] = useState(null); // /uploads/...
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    api('/api/misc/categories')
      .then((rows) => setCategories(Array.isArray(rows) ? rows : []))
      .catch(() => setCategories([]))
      .finally(() => setLoadingCats(false));
  }, []);

  useEffect(() => {
    if (!listingId) return;
    setLoading(true);
    api(`/api/products/${listingId}`)
      .then((row) => {
        setName(row.product_name || '');
        setDesc(row.product_description || '');
        setPrice(row.product_price != null ? String(row.product_price) : '');
        setCategoryId(row.category_id ?? null);
        setStatus(row.status || 'avail');
        setUploadedPath(row.product_image_path || null);
        setImage(null);
      })
      .catch((e) => Alert.alert('Failed', e.message || 'Could not load listing'))
      .finally(() => setLoading(false));
  }, [listingId]);

  const canSubmit = useMemo(() => {
    const p = Number(String(price).replace(/,/g, ''));
    return (
      name.trim().length > 0 &&
      Number.isFinite(p) &&
      p > 0 &&
      !!categoryId &&
      !saving &&
      !uploading
    );
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
      // keep uploadedPath until we successfully upload a replacement
    } catch (e) {
      Alert.alert('Failed', e.message || 'Could not pick image');
    }
  };

  const save = async () => {
    const p = Number(String(price).replace(/,/g, ''));
    if (!name.trim()) return Alert.alert('Missing info', 'Please enter a product name.');
    if (!Number.isFinite(p) || p <= 0) return Alert.alert('Invalid price', 'Enter a valid price (e.g. 120).');
    if (!categoryId) return Alert.alert('Missing info', 'Please select a category.');

    setSaving(true);
    try {
      let product_image_path = uploadedPath;
      if (image?.uri) {
        setUploading(true);
        try {
          product_image_path = await uploadImage(image);
          setUploadedPath(product_image_path);
          setImage(null);
        } finally {
          setUploading(false);
        }
      }

      await api(`/api/products/${listingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          product_name: name.trim(),
          product_description: desc.trim() || undefined,
          product_price: p,
          category_id: categoryId,
          status,
          product_image_path: product_image_path || undefined,
        }),
      });
      Alert.alert('Saved', 'Listing updated.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Failed', e.message || 'Could not save changes');
    } finally {
      setSaving(false);
    }
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
        <Text style={styles.title}>Edit Listing</Text>
        <Text style={styles.subtitle}>Update your product listing</Text>

        <Text style={styles.label}>Photo</Text>
        <View style={styles.photoRow}>
          <TouchableOpacity style={styles.photoBtn} onPress={pickImage} activeOpacity={0.85}>
            <Text style={styles.photoBtnText}>{previewUri ? 'Change photo' : 'Choose photo'}</Text>
          </TouchableOpacity>
          {previewUri ? (
            <TouchableOpacity
              style={[styles.photoBtn, styles.photoBtnOutline]}
              onPress={() => {
                setImage(null);
                setUploadedPath(null);
              }}
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

        <Text style={styles.label}>Status</Text>
        <View style={styles.statusRow}>
          {['avail', 'dormant', 'sold'].map((s) => {
            const active = status === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, active && styles.statusChipActive]}
                onPress={() => setStatus(s)}
                activeOpacity={0.85}
              >
                <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                  {s === 'avail' ? 'Available' : s === 'dormant' ? 'Dormant' : 'Sold'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
          onPress={save}
          disabled={!canSubmit}
        >
          <Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
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
  photoPreview: { width: '100%', height: 220, backgroundColor: colors.surface2 },
  photoUploading: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  photoUploadingText: { color: '#fff', fontWeight: '700' },
  statusRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statusChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.surface2 },
  statusChipActive: { backgroundColor: colors.accentLt },
  statusChipText: { color: colors.text2, fontSize: 13, fontWeight: '600' },
  statusChipTextActive: { color: colors.accent, fontWeight: '800' },
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

