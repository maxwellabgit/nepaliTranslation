import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t, useUiLang } from '../../i18n';
import { useTheme } from '../../theme';

type Props = {
  surface: string;
  onNotNow?: () => void;
  /** Opens bilingual ad-free paywall when paywall_enabled. */
  onPreferNoAds?: () => void;
};

/**
 * Bundled house banner. Never calls the ad network.
 * Copy opens the in-app paywall when wired by AdSlot.
 */
export function HouseAd({ surface, onNotNow, onPreferNoAds }: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const copy = t('ads.houseCopy', lang);
  const dismiss = t('ads.houseDismiss', lang);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        house: {
          padding: 12,
          backgroundColor: theme.colors.pasteBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.divider,
          alignItems: 'center',
          gap: 6,
        },
        brand: { fontWeight: '800', color: theme.colors.crimson },
        copy: {
          fontSize: 13,
          color: theme.colors.text,
          textAlign: 'center',
          textDecorationLine: 'underline',
        },
        dismiss: {
          paddingVertical: 4,
          paddingHorizontal: 8,
          minHeight: 44,
          justifyContent: 'center',
        },
        dismissText: {
          fontSize: 13,
          color: theme.colors.textSecondary,
          fontWeight: '600',
        },
      }),
    [theme],
  );

  return (
    <View style={styles.house} testID={`ad-slot-house-${surface}`}>
      <Text style={styles.brand}>Bola</Text>
      <Pressable
        onPress={onPreferNoAds}
        accessibilityRole="button"
        accessibilityLabel={copy}
        testID="house-ad-prefer-no-ads"
      >
        <Text style={styles.copy}>{copy}</Text>
      </Pressable>
      <Pressable
        onPress={onNotNow}
        accessibilityRole="button"
        accessibilityLabel={dismiss}
        testID="house-ad-not-now"
        style={styles.dismiss}
      >
        <Text style={styles.dismissText}>{dismiss}</Text>
      </Pressable>
    </View>
  );
}
