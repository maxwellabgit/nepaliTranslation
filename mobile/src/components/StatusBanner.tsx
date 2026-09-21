import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

export type StatusBannerTone = 'info' | 'warn' | 'error' | 'offline';

type Props = {
  message: string;
  tone?: StatusBannerTone;
  onDismiss?: () => void;
  dismissLabel?: string;
  testID?: string;
};

/** Compact status strip for offline / error / info on secondary journeys. */
export function StatusBanner({
  message,
  tone = 'info',
  onDismiss,
  dismissLabel = 'Dismiss',
  testID = 'status-banner',
}: Props) {
  const theme = useTheme();
  const palette =
    tone === 'error'
      ? {
          bg: theme.error.bg,
          border: theme.error.border,
          text: theme.error.text,
        }
      : tone === 'warn'
        ? {
            bg: theme.colors.bannerWarnBg,
            border: theme.colors.bannerWarnBorder,
            text: theme.colors.text,
          }
        : tone === 'offline'
          ? {
              bg: theme.colors.bannerOfflineBg,
              border: theme.colors.bannerOfflineBorder,
              text: theme.colors.text,
            }
          : {
              bg: theme.colors.bannerInfoBg,
              border: theme.colors.bannerInfoBorder,
              text: theme.colors.text,
            };

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: palette.bg,
          borderBottomColor: palette.border,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          gap: theme.spacing.sm,
        },
      ]}
      testID={testID}
      accessibilityRole={tone === 'error' ? 'alert' : 'summary'}
      accessibilityLiveRegion="polite"
    >
      <Text
        style={[
          styles.text,
          {
            color: palette.text,
            fontSize: theme.typography.body.fontSize - 1,
            lineHeight: 18,
          },
        ]}
        testID={`${testID}-message`}
      >
        {message}
      </Text>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          testID={`${testID}-dismiss`}
          hitSlop={8}
        >
          <Text
            style={[
              styles.dismiss,
              { color: palette.text, fontSize: theme.typography.body.fontSize - 1 },
            ]}
          >
            {dismissLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    flex: 1,
  },
  dismiss: {
    fontWeight: '600',
  },
});
