import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { loadSavedPlaces, removeSavedPlace, upsertSavedPlace, type SavedPlaceKind, type SavedPlace } from '../../src/saved-places';

export default function SavedPlacesScreen() {
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

  return <View style={styles.container}>
    <TouchableOpacity onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>Back</Text></TouchableOpacity>
    <Text style={styles.title}>Saved Places</Text>
    {loading ? <ActivityIndicator color="#1B8B4B" /> : error ? <View style={styles.card}><Text style={styles.error}>{error}</Text><TouchableOpacity onPress={load} style={styles.button}><Text style={styles.buttonText}>Retry</Text></TouchableOpacity></View> : places.length === 0 ? <Text style={styles.empty}>No saved places yet.</Text> : places.map((place) => <View key={place.id} style={styles.card}><Text style={styles.placeLabel}>{place.label}</Text><Text style={styles.coordinates}>{place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}</Text><TouchableOpacity onPress={() => void remove(place.id)} accessibilityRole="button"><Text style={styles.remove}>Remove</Text></TouchableOpacity></View>)}
    <View style={styles.form}>
      <Text style={styles.section}>Add or replace a place</Text>
      <View style={styles.kindRow}>{(['home', 'work', 'custom'] as SavedPlaceKind[]).map((value) => <TouchableOpacity key={value} onPress={() => setKind(value)} style={[styles.kind, kind === value && styles.kindSelected]}><Text>{value[0].toUpperCase() + value.slice(1)}</Text></TouchableOpacity>)}</View>
      <TextInput value={label} onChangeText={setLabel} placeholder="Place label" style={styles.input} accessibilityLabel="Saved place label" />
      <TextInput value={latitude} onChangeText={setLatitude} placeholder="Latitude" keyboardType="decimal-pad" style={styles.input} accessibilityLabel="Saved place latitude" />
      <TextInput value={longitude} onChangeText={setLongitude} placeholder="Longitude" keyboardType="decimal-pad" style={styles.input} accessibilityLabel="Saved place longitude" />
      <TouchableOpacity onPress={() => void save()} disabled={saving} style={[styles.button, saving && styles.disabled]} accessibilityRole="button"><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save place'}</Text></TouchableOpacity>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB', padding: 24, paddingTop: 60, gap: 12 },
  back: { color: '#1B8B4B', fontWeight: '700' }, title: { fontSize: 26, fontWeight: '700', color: '#1A1A2E' },
  empty: { color: '#64748B' }, card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  placeLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' }, coordinates: { color: '#64748B' }, remove: { color: '#B91C1C', fontWeight: '700', marginTop: 6 },
  error: { color: '#B91C1C' }, form: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, gap: 10 }, section: { fontWeight: '700' }, kindRow: { flexDirection: 'row', gap: 8 }, kind: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, alignItems: 'center' }, kindSelected: { borderColor: '#1B8B4B', backgroundColor: '#F0FDF4' }, input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12 }, button: { backgroundColor: '#1B8B4B', borderRadius: 8, padding: 12, alignItems: 'center' }, disabled: { opacity: 0.5 }, buttonText: { color: '#FFF', fontWeight: '700' },
});
