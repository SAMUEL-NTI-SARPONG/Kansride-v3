import { View, Text, StyleSheet, Switch } from 'react-native';
import { useState } from 'react';

export default function DriverHomeScreen() {
  const [isOnline, setIsOnline] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>Map View</Text>
        <Text style={styles.mapSubtext}>Kansawrodo · Sekondi-Takoradi</Text>
      </View>
      <View style={styles.bottomCard}>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusLabel}>
              {isOnline ? 'You are Online' : 'You are Offline'}
            </Text>
            <Text style={styles.statusHint}>
              {isOnline ? 'Waiting for ride requests...' : 'Go online to receive rides'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={setIsOnline}
            trackColor={{ true: '#1B8B4B', false: '#E2E8F0' }}
            thumbColor="#FFF"
          />
        </View>
        {isOnline && (
          <View style={styles.waitingCard}>
            <Text style={styles.waitingText}>No ride requests yet</Text>
            <Text style={styles.waitingSubtext}>Stay in the service area for best results</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8E8E8' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapText: { fontSize: 24, fontWeight: '600', color: '#64748B' },
  mapSubtext: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  bottomCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  statusHint: { fontSize: 14, color: '#64748B', marginTop: 2 },
  waitingCard: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16, alignItems: 'center' },
  waitingText: { fontSize: 16, fontWeight: '600', color: '#1B8B4B' },
  waitingSubtext: { fontSize: 12, color: '#64748B', marginTop: 4 },
});
