import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { colors } from '../theme';

type Props = {
  onClose: () => void;
  onOpenGoldReview: () => void;
};

const APP_VERSION =
  Constants.expoConfig?.version ??
  Constants.nativeAppVersion ??
  '1.4.5';
const BUILD_NUMBER =
  Constants.expoConfig?.ios?.buildNumber ??
  Constants.nativeBuildVersion ??
  '';

/**
 * Traveler settings. Gold Review lives under Advanced — not in the main chrome.
 */
export function SettingsScreen({ onClose, onOpenGoldReview }: Props) {
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    setAdvanced(false);
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.topBtn}>
          <Text style={styles.topBtnText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.topBtn} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>About</Text>
        <Text style={styles.body}>
          NepTranslate works offline for saved phrases and word guesses on this device.
          Speech uses Apple recognition (not fully offline). Neural on-device MT is the
          2.0 path after gold gates pass.
        </Text>
        <Text style={styles.meta}>
          v{APP_VERSION}
          {BUILD_NUMBER ? ` (${BUILD_NUMBER})` : ''}
        </Text>
      </View>

      <Pressable
        style={styles.row}
        onPress={() => setAdvanced((v) => !v)}
        accessibilityRole="button"
      >
        <Text style={styles.rowTitle}>Advanced</Text>
        <Text style={styles.rowChevron}>{advanced ? '▾' : '›'}</Text>
      </Pressable>

      {advanced ? (
        <Pressable
          style={styles.subRow}
          onPress={onOpenGoldReview}
          accessibilityRole="button"
          accessibilityLabel="Open Gold Review"
        >
          <Text style={styles.subTitle}>Gold Review</Text>
          <Text style={styles.subHint}>Internal quality bench · password required</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  topBtn: {
    width: 56,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBtnText: { fontSize: 22, color: colors.textSecondary },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textPlaceholder,
  },
  row: {
    marginTop: 16,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowChevron: { fontSize: 18, color: colors.textSecondary, fontWeight: '700' },
  subRow: {
    marginTop: 8,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 4,
  },
  subTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  subHint: { fontSize: 12, color: colors.textSecondary },
});
