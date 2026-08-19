import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { loadSavedPlaces, removeSavedPlace, upsertSavedPlace, type SavedPlaceKind, type SavedPlace } from '../../src/saved-places';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, FeedbackBanner, TextInput, borderRadius, colors, spacing, typography } from '@kansride/ui';
import { usePassengerInsets } from '../../src/ui/use-passenger-insets';

export default function SavedPlacesScreen() {
  const insets = usePassengerInsets();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<SavedPlaceKind>('custom');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPlaces(await loadSavedPlaces()); setError(null); }
    catch { setPlaces([]); setError('Saved places could not be loaded. You can add a new place.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const next = await upsertSavedPlace({ label, kind, latitude: Number(latitude), longitude: Number(longitude) });
      setPlaces(next); setLabel(''); setLatitude(''); setLongitude('');
    } catch (saveError) { Alert.alert('Could not save place', saveError instanceof Error ? saveError.message : 'Enter a label and valid coordinates.'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    try { setPlaces(await removeSavedPlace(id)); }
    catch { Alert.alert('Could not remove place', 'Try again.'); }
  };

  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity>
    <Text style={styles.eyebrow}>YOUR SHORTCUTS</Text><Text style={styles.title}>Saved places</Text><Text style={styles.subtitle}>Keep the places you visit most within easy reach.</Text>
    {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : error ? <FeedbackBanner tone="error" message={error} action={<TouchableOpacity onPress={() => void load()}><Text style={styles.retry}>Retry</Text></TouchableOpacity>} /> : places.length === 0 ? <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="bookmark-outline" size={30} color={colors.primary} /></View><Text style={styles.emptyTitle}>No saved places yet</Text><Text style={styles.emptyCopy}>Add home, work, or another regular stop below.</Text></View> : <View style={styles.placeList}>{places.map((place) => <Card key={place.id} variant="raised" shadow="sm" padding="md" style={styles.placeCard}><View style={styles.placeIcon}><Ionicons name={place.kind === 'home' ? 'home-outline' : place.kind === 'work' ? 'briefcase-outline' : 'location-outline'} size={21} color={colors.primary} /></View><View style={styles.placeCopy}><Text style={styles.placeLabel}>{place.label}</Text><Text style={styles.coordinates}>{place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}</Text></View><TouchableOpacity onPress={() => void remove(place.id)} accessibilityRole="button" accessibilityLabel={`Remove ${place.label}`} style={styles.removeButton}><Ionicons name="trash-outline" size={19} color={colors.error} /></TouchableOpacity></Card>)}</View>}
    <Card variant="raised" shadow="md" padding="lg" style={styles.form}>
      <Text style={styles.section}>Add a saved place</Text><Text style={styles.formCopy}>Choose a label and enter the location coordinates.</Text>
      <View style={styles.kindRow}>{(['home', 'work', 'custom'] as SavedPlaceKind[]).map((value) => <TouchableOpacity key={value} onPress={() => setKind(value)} style={[styles.kind, kind === value && styles.kindSelected]}><Ionicons name={value === 'home' ? 'home-outline' : value === 'work' ? 'briefcase-outline' : 'star-outline'} size={17} color={kind === value ? colors.primary : colors.textSecondary} /><Text style={[styles.kindText, kind === value && styles.kindTextSelected]}>{value[0].toUpperCase() + value.slice(1)}</Text></TouchableOpacity>)}</View>
      <TextInput value={label} onChangeText={setLabel} placeholder="e.g. Grandma’s house" label="Place name" accessibilityLabel="Saved place label" />
      <View style={styles.coordinateRow}><TextInput value={latitude} onChangeText={setLatitude} placeholder="4.90160" label="Latitude" keyboardType="decimal-pad" containerStyle={styles.coordinateInput} accessibilityLabel="Saved place latitude" /><TextInput value={longitude} onChangeText={setLongitude} placeholder="-1.78310" label="Longitude" keyboardType="decimal-pad" containerStyle={styles.coordinateInput} accessibilityLabel="Saved place longitude" /></View>
      <Button title="Save place" onPress={() => void save()} loading={saving} disabled={!label.trim() || !latitude || !longitude} fullWidth />
    </Card>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: spacing.lg },
  backButton: { width: 44, height: 44, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  eyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.3 }, title: { ...typography.h1, color: colors.textPrimary, marginTop: 2 }, subtitle: { ...typography.small, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.lg },
  loader: { marginVertical: spacing.xl }, retry: { ...typography.label, color: colors.primary, padding: spacing.sm },
  empty: { alignItems: 'center', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.lg }, emptyIcon: { width: 54, height: 54, borderRadius: borderRadius.xl, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.md }, emptyCopy: { ...typography.small, color: colors.textSecondary, textAlign: 'center', marginTop: 3 },
  placeList: { gap: 10, marginBottom: spacing.lg }, placeCard: { flexDirection: 'row', alignItems: 'center', gap: 12 }, placeIcon: { width: 42, height: 42, borderRadius: borderRadius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, placeCopy: { flex: 1 }, placeLabel: { ...typography.bodyBold, color: colors.textPrimary }, coordinates: { ...typography.caption, color: colors.textSecondary, marginTop: 2 }, removeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  form: { gap: 8 }, section: { ...typography.h3, color: colors.textPrimary }, formCopy: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.sm }, kindRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md }, kind: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }, kindSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, kindText: { ...typography.small, color: colors.textSecondary }, kindTextSelected: { color: colors.primary, fontWeight: '700' }, coordinateRow: { flexDirection: 'row', gap: 10 }, coordinateInput: { flex: 1 },
});
