import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { AccountSection } from '../features/auth/AccountSection';
import { useAuth } from '../features/auth/AuthProvider';
import { CONTRIBUTION_CONSENT_VERSION } from '../features/auth/consent';
import { requestAccountDeletion } from '../features/auth/deleteAccount';
import { recordContributionConsent } from '../features/auth/recordConsent';
import {
  clearAppleAuthorizationCode,
  loadAppleAuthorizationCode,
} from '../features/auth/appleAuthCode';
import { saveLocalConsent } from '../storage/contributionConsent';
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
  const [speechCaps, setSpeechCaps] = useState<{
    neStt: boolean;
    neTts: boolean;
  } | null>(null);
  const auth = useAuth();
  const [consentVersion, setConsentVersion] = useState<string | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  useEffect(() => {
    void Promise.all([getSttSupport(), hasNepaliVoice()]).then(
      ([stt, neTts]) => setSpeechCaps({ neStt: stt.ne, neTts }),
    );
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

      <ScrollView contentContainerStyle={styles.scroll}>
      <AccountSection
        authConfigured={auth.authConfigured}
        status={auth.status}
        userId={auth.userId}
        consentVersion={consentVersion}
        ageConfirmed={ageConfirmed}
        onSignIn={() => void auth.signInWithApple()}
        onSignOut={() => void auth.signOut()}
        onSaveConsent={() => {
          void recordContributionConsent().then((result) => {
            if (!result.ok) {
              Alert.alert(
                'Consent not saved',
                'Contribution consent was not recorded. Translation on this device is unchanged.',
              );
              return;
            }
            void saveLocalConsent(true);
            setAgeConfirmed(true);
            setConsentVersion(CONTRIBUTION_CONSENT_VERSION);
          });
        }}
        onDeleteAccount={() => {
          const userId = auth.userId;
          void (async () => {
            const authorizationCode = userId
              ? await loadAppleAuthorizationCode(userId)
              : null;
            const result = await requestAccountDeletion({
              authorizationCode: authorizationCode ?? undefined,
            });
            if (result.ok) {
              if (userId) await clearAppleAuthorizationCode(userId);
              void auth.signOut();
              return;
            }
            Alert.alert(
              'Deletion paused',
              'Account deletion did not finish. Translation history on this device was not cleared. Sign in with Apple again if this device does not have an authorization code, then retry.',
            );
          })();
        }}
      />

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
            onPress={() => {
              Alert.alert(
                'Developer tool',
                'Meaning Review is a local founder tool. It does not upload automatically.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open', onPress: onOpenMeaningReview },
                ],
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="Open Meaning Review"
          >
            <Text style={styles.subTitle}>Meaning Review</Text>
            <Text style={styles.subHint}>
              Local edits only · no password · no automatic upload
            </Text>
          </Pressable>
        </>
      ) : null}
      </ScrollView>
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
  scroll: { paddingBottom: 32 },
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
