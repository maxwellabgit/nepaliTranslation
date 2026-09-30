import { StyleSheet, Text, View } from 'react-native';

/**
 * Browser stand-in for the network banner. The native AdMob SDK does not load
 * on web. Earn credits is a separate slide in the same top rotation.
 */
export function NativeOrPlaceholderBanner(_props: { unitId: string }) {
  return (
    <View style={styles.sample} testID="sample-ad-banner">
      <Text style={styles.badge}>TEST AD</Text>
      <Text style={styles.sampleTitle}>Banner</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sample: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F1D8',
    paddingVertical: 8,
    gap: 1,
  },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#6B4A12',
  },
  sampleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1410',
  },
});
