import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { AccountSection } from '../features/auth/AccountSection';
import { ContributionCard } from '../features/contribution/ContributionCard';
import { useAuth } from '../features/auth/AuthProvider';
import { CONTRIBUTION_CONSENT_VERSION } from '../features/auth/consent';
import { recordContributionConsent } from '../features/auth/recordConsent';
import { saveLocalConsent } from '../storage/contributionConsent';
import { flushPendingDrafts } from '../services/contributionSync';
import { useServices } from '../services/ServiceContext';
import { getSttSupport, hasNepaliVoice } from '../stt/sttSupport';
import { colors } from '../theme';

const INAPPROPRIATE_AD_HELP =
  'mailto:support@neptranslate.app?subject=Inappropriate%20ad%20report';

type Props = {
  onClose: () => void;
  onOpenContributions?: () => void;
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
 * Traveler settings. Founder Meaning Review is not in the production path
 * (moves to the protected admin console in Slice 10).
 */
export function SettingsScreen({
  onClose,
  onOpenContributions,
  neuralReady = false,
}: Props) {
  const [speechCaps, setSpeechCaps] = useState<{
    neStt: boolean;
    neTts: boolean;
  } | null>(null);
  const auth = useAuth();
  const services = useServices();
  const consent = services.ads.getConsentState();

  const refreshAccountSummary = auth.refreshAccountSummary;
  const authStatus = auth.status;

  useEffect(() => {
    void Promise.all([getSttSupport(), hasNepaliVoice()]).then(
      ([stt, neTts]) => setSpeechCaps({ neStt: stt.ne, neTts }),
    );
  }, []);

  useEffect(() => {
    if (authStatus === 'signed-in') {
      void refreshAccountSummary();
    }
  }, [authStatus, refreshAccountSummary]);

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
        consentVersion={auth.consentVersion}
        ageConfirmed={auth.ageConfirmed}
        deletionRetryPending={auth.deletionRetryPending}
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
            void flushPendingDrafts();
            void auth.refreshAccountSummary();
          });
        }}
        onDeleteAccount={() => {
          void auth.deleteAccount();
        }}
      />

      <ContributionCard />

      {onOpenContributions ? (
        <Pressable
          style={styles.section}
          onPress={onOpenContributions}
          accessibilityRole="button"
          accessibilityLabel="Open contributions and rewards"
          testID="settings-open-contributions"
        >
          <Text style={styles.sectionLabel}>Contributions & rewards</Text>
          <Text style={styles.body}>
            View drafts, sync status, and retry uploads on this device.
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.section} testID="settings-ads-privacy">
        <Text style={styles.sectionLabel}>Ads & privacy</Text>
        {consent.privacyOptionsRequired ? (
          <Pressable
            onPress={() => void services.ads.showPrivacyOptions()}
            accessibilityRole="button"
            accessibilityLabel="Ad privacy options"
            testID="settings-ad-privacy-options"
          >
            <Text style={styles.link}>Privacy options</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => {
            void Linking.openURL(INAPPROPRIATE_AD_HELP).catch(() => {
              Alert.alert(
                'Report an ad',
                'Email support@neptranslate.app with “Inappropriate ad report” in the subject.',
              );
            });
          }}
          accessibilityRole="link"
          accessibilityLabel="Report an inappropriate ad"
          testID="settings-report-inappropriate-ad"
        >
          <Text style={styles.link}>Report an inappropriate ad</Text>
        </Pressable>
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
        {auth.consentVersion ? (
          <Text style={styles.meta} testID="settings-consent-version">
            Consent {auth.consentVersion === CONTRIBUTION_CONSENT_VERSION ? 'current' : auth.consentVersion}
          </Text>
        ) : null}
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
  link: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.forest,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
});
