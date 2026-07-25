import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import {
  flushReviewSync,
  loadReviewSyncConfig,
  loadReviewSyncStatus,
  saveReviewSyncConfig,
  type ReviewSyncConfig,
  type ReviewSyncStatus,
} from '../sync/reviewSync';
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
 * Traveler settings. Gold Review lives under Advanced — not in the main chrome.
 */
export function SettingsScreen({
  onClose,
  onOpenMeaningReview,
  neuralReady = false,
}: Props) {
  const [advanced, setAdvanced] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncConfig, setSyncConfig] = useState<ReviewSyncConfig | null>(null);
  const [syncStatus, setSyncStatus] = useState<ReviewSyncStatus | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);

  useEffect(() => {
    setAdvanced(false);
    setSyncOpen(false);
  }, []);

  const refreshSync = useCallback(async () => {
    const [cfg, status] = await Promise.all([
      loadReviewSyncConfig(),
      loadReviewSyncStatus(),
    ]);
    setSyncConfig(cfg);
    setSyncStatus(status);
  }, []);

  useEffect(() => {
    if (advanced) void refreshSync();
  }, [advanced, refreshSync]);

  const patchSync = async (partial: Partial<ReviewSyncConfig>) => {
    const base = syncConfig ?? (await loadReviewSyncConfig());
    const next = { ...base, ...partial };
    setSyncConfig(next);
    await saveReviewSyncConfig(next);
  };

  const onSyncNow = async () => {
    setSyncBusy(true);
    try {
      const result = await flushReviewSync({ reason: 'manual', force: true });
      await refreshSync();
      if (result.ok) {
        Alert.alert(
          'Sync',
          result.sent
            ? `Sent ${result.sent} review(s) to your PC.`
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
            ? 'NepTranslate runs IndicTrans2 on this device for free-form English → Nepali. Nepali → English uses the saved phrasebook. The EN→NE model ships in the install. Speech uses Apple recognition and may need a network.'
            : 'NepTranslate includes an on-device English → Nepali model in the install. If it has not finished loading, saved traveler phrases still work. Speech uses Apple recognition and may need a network.'}
        </Text>
        <Text style={styles.meta}>
          v{APP_VERSION}
          {BUILD_NUMBER ? ` (${BUILD_NUMBER})` : ''}
          {neuralReady ? ' · model ready' : ' · model pending'}
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
        <>
          <Pressable
            style={styles.subRow}
            onPress={onOpenMeaningReview}
            accessibilityRole="button"
            accessibilityLabel="Open Meaning Review"
          >
            <Text style={styles.subTitle}>Meaning Review</Text>
            <Text style={styles.subHint}>Edit Nepali / Roman · password required</Text>
          </Pressable>

          <Pressable
            style={styles.subRow}
            onPress={() => setSyncOpen((v) => !v)}
            accessibilityRole="button"
          >
            <Text style={styles.subTitle}>Review sync</Text>
            <Text style={styles.subHint}>
              {syncConfig?.enabled
                ? `On · ${syncStatus?.pending ?? 0} pending`
                : 'Off · auto-upload to your PC'}
            </Text>
          </Pressable>

          {syncOpen && syncConfig ? (
            <View style={styles.syncBox}>
              <View style={styles.switchRow}>
                <Text style={styles.syncLabel}>Sync enabled</Text>
                <Switch
                  value={syncConfig.enabled}
                  onValueChange={(enabled) => void patchSync({ enabled })}
                />
              </View>
              <Text style={styles.syncLabel}>Endpoint URL</Text>
              <TextInput
                style={styles.syncInput}
                value={syncConfig.endpointUrl}
                onChangeText={(endpointUrl) => setSyncConfig({ ...syncConfig, endpointUrl })}
                onEndEditing={() => void patchSync({ endpointUrl: syncConfig.endpointUrl })}
                placeholder="https://….trycloudflare.com"
                placeholderTextColor={colors.textPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text style={styles.syncLabel}>Secret</Text>
              <TextInput
                style={styles.syncInput}
                value={syncConfig.secret}
                onChangeText={(secret) => setSyncConfig({ ...syncConfig, secret })}
                onEndEditing={() => void patchSync({ secret: syncConfig.secret })}
                placeholder="Same as REVIEW_SYNC_SECRET"
                placeholderTextColor={colors.textPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <Text style={styles.syncHint}>
                Batches of 1 (immediate after Accept/Skip), or ~3s debounce. See training/REVIEW_SYNC.md.
              </Text>
              {syncStatus?.lastError ? (
                <Text style={styles.syncError}>Last error: {syncStatus.lastError}</Text>
              ) : null}
              {syncStatus?.lastOkAt ? (
                <Text style={styles.syncMeta}>
                  Last OK {syncStatus.lastOkAt.slice(0, 19).replace('T', ' ')} UTC
                  {syncStatus.lastBatchSize
                    ? ` · sent ${syncStatus.lastBatchSize}`
                    : ''}
                </Text>
              ) : null}
              <Pressable
                style={[styles.syncBtn, syncBusy && styles.syncBtnDisabled]}
                onPress={() => void onSyncNow()}
                disabled={syncBusy}
              >
                {syncBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.syncBtnText}>
                    Sync now{syncStatus?.pending ? ` (${syncStatus.pending})` : ''}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  syncLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  syncInput: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  syncHint: { fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  syncError: { fontSize: 12, lineHeight: 17, color: '#B00020' },
  syncMeta: { fontSize: 11, color: colors.textPlaceholder },
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
