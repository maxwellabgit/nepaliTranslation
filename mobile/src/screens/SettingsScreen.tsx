import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import {
  flushReviewSync,
  loadReviewSyncStatus,
  type ReviewSyncStatus,
} from '../sync/reviewSync';
import { getSttSupport, hasNepaliVoice } from '../stt/sttSupport';
import { colors } from '../theme';

type Props = {
  onClose: () => void;
  onOpenMeaningReview: () => void;
  neuralReady?: boolean;
};

const APP_VERSION =
  Constants.expoConfig?.version ??
  Constants.nativeAppVersion ??
  '1.6.2';
const BUILD_NUMBER =
  Constants.expoConfig?.ios?.buildNumber ??
  Constants.nativeBuildVersion ??
  '';

/**
 * Traveler settings. Meaning Review lives under Advanced.
 * Review sync is baked into the build — testers do not configure it.
 */
export function SettingsScreen({
  onClose,
  onOpenMeaningReview,
  neuralReady = false,
}: Props) {
  const [advanced, setAdvanced] = useState(false);
  const [syncStatus, setSyncStatus] = useState<ReviewSyncStatus | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [speechCaps, setSpeechCaps] = useState<{
    neStt: boolean;
    neTts: boolean;
  } | null>(null);

  useEffect(() => {
    void Promise.all([getSttSupport(), hasNepaliVoice()]).then(
      ([stt, neTts]) => setSpeechCaps({ neStt: stt.ne, neTts }),
    );
  }, []);

  const refreshSync = useCallback(async () => {
    setSyncStatus(await loadReviewSyncStatus());
  }, []);

  useEffect(() => {
    if (advanced) void refreshSync();
  }, [advanced, refreshSync]);

  const onSyncNow = async () => {
    setSyncBusy(true);
    try {
      const result = await flushReviewSync({ reason: 'manual', force: true });
      await refreshSync();
      if (result.ok) {
        Alert.alert(
          'Sync',
          result.sent
            ? `Sent ${result.sent} review(s).`
            : 'Nothing pending to send.',
        );
      } else {
        Alert.alert('Sync failed', result.error);
      }
    } finally {
      setSyncBusy(false);
    }
  };

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
          {neuralReady
            ? 'NepTranslate runs IndicTrans2 on this device for free-form translation in both directions (English ↔ Nepali). Models ship in the install — no network needed for translation. Speech uses Apple recognition and may need a network.'
            : 'NepTranslate includes on-device English ↔ Nepali models in the install. If they have not finished loading, saved traveler phrases still work. Speech uses Apple recognition and may need a network.'}
        </Text>
        <Text style={styles.meta}>
          v{APP_VERSION}
          {BUILD_NUMBER ? ` (${BUILD_NUMBER})` : ''}
          {neuralReady ? ' · model ready' : ' · model pending'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Speech on this device</Text>
        {speechCaps ? (
          <>
            <Text style={styles.capRow}>
              English voice input · available
            </Text>
            <Text style={styles.capRow}>
              Nepali voice input ·{' '}
              {speechCaps.neStt ? 'available' : 'not supported by this device'}
            </Text>
            <Text style={styles.capRow}>
              Nepali spoken aloud ·{' '}
              {speechCaps.neTts ? 'available' : 'no Nepali voice installed'}
            </Text>
            {!speechCaps.neStt || !speechCaps.neTts ? (
              <Text style={styles.meta}>
                iPhones don't ship Nepali speech services. Typing and reading
                translations work fully offline.
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.meta}>Checking…</Text>
        )}
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
        <>
          <Pressable
            style={styles.subRow}
            onPress={onOpenMeaningReview}
            accessibilityRole="button"
            accessibilityLabel="Open Meaning Review"
          >
            <Text style={styles.subTitle}>Meaning Review</Text>
            <Text style={styles.subHint}>
              Edit Nepali / Roman · password required · auto-syncs
            </Text>
          </Pressable>

          <View style={styles.syncBox}>
            <Text style={styles.subTitle}>Review sync</Text>
            <Text style={styles.subHint}>
              Built-in · {syncStatus?.pending ?? 0} pending
              {syncStatus?.lastOkAt
                ? ` · last OK ${syncStatus.lastOkAt.slice(0, 16).replace('T', ' ')}`
                : ''}
            </Text>
            {syncStatus?.lastError ? (
              <Text style={styles.syncError}>Last error: {syncStatus.lastError}</Text>
            ) : null}
            <Pressable
              style={[styles.syncBtn, syncBusy && styles.syncBtnDisabled]}
              onPress={() => void onSyncNow()}
              disabled={syncBusy}
            >
              {syncBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.syncBtnText}>Sync now</Text>
              )}
            </Pressable>
          </View>
        </>
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
  capRow: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    fontWeight: '600',
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
  syncBox: {
    marginTop: 8,
    marginHorizontal: 16,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 8,
  },
  syncError: { fontSize: 12, lineHeight: 17, color: '#B00020' },
  syncBtn: {
    marginTop: 4,
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
