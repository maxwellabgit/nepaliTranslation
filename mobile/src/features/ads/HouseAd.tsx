import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme';
import { HOUSE_AD_COPY, HOUSE_AD_DISMISS } from './adConfig';

type Props = {
  surface: string;
  onNotNow?: () => void;
  /** Opens in-app paywall once Slice 09 exists; no-op until then. */
  onPreferNoAds?: () => void;
};

/**
 * Bundled house banner. Never calls the ad network.
 * Copy opens only the in-app paywall once Slice 09 exists.
 */
export function HouseAd({ surface, onNotNow, onPreferNoAds }: Props) {
  return (
    <View style={styles.house} testID={`ad-slot-house-${surface}`}>
      <Text style={styles.brand}>NepTranslate</Text>
      <Pressable
        onPress={onPreferNoAds}
        accessibilityRole="button"
        accessibilityLabel={HOUSE_AD_COPY}
        testID="house-ad-prefer-no-ads"
      >
        <Text style={styles.copy}>{HOUSE_AD_COPY}</Text>
      </Pressable>
      <Pressable
        onPress={onNotNow}
        accessibilityRole="button"
        accessibilityLabel={HOUSE_AD_DISMISS}
        testID="house-ad-not-now"
        style={styles.dismiss}
      >
        <Text style={styles.dismissText}>{HOUSE_AD_DISMISS}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  house: {
    padding: 12,
    backgroundColor: colors.pasteBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    alignItems: 'center',
    gap: 6,
  },
  brand: { fontWeight: '800', color: colors.crimson },
  copy: {
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  dismiss: { paddingVertical: 4, paddingHorizontal: 8 },
  dismissText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
});
