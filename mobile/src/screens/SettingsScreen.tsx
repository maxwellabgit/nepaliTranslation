import { useEffect, useMemo, useState } from 'react';
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
import { StatusBanner } from '../components/StatusBanner';
import { t, useNetworkOffline, useSetUiLang, useUiLang } from '../i18n';
import { useTheme } from '../theme';

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
  const theme = useTheme();
  const lang = useUiLang();
  const setUiLang = useSetUiLang();
  const offline = useNetworkOffline();
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

  const dynamic = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: theme.colors.bg },
        topBar: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          paddingVertical: 10,
          paddingHorizontal: theme.spacing.xs,
        },
        topBtnText: { fontSize: 22, color: theme.colors.textSecondary },
        title: {
          flex: 1,
          textAlign: 'center',
          fontSize: theme.typography.title.fontSize,
          fontWeight: '600',
          color: theme.colors.text,
        },
        section: {
          marginTop: theme.spacing.xl,
          marginHorizontal: theme.spacing.lg,
          padding: theme.spacing.lg,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.xl,
          gap: theme.spacing.sm,
        },
        sectionLabel: {
          fontSize: theme.typography.label.fontSize,
          fontWeight: theme.typography.label.fontWeight,
          letterSpacing: theme.typography.label.letterSpacing,
          textTransform: 'uppercase',
          color: theme.colors.textSecondary,
        },
        body: {
          fontSize: theme.typography.body.fontSize,
          lineHeight: theme.typography.body.lineHeight,
          color: theme.colors.text,
        },
        link: {
          fontSize: theme.typography.body.fontSize,
          lineHeight: theme.typography.body.lineHeight,
          color: theme.colors.forest,
          fontWeight: '600',
          textDecorationLine: 'underline',
        },
        meta: {
          marginTop: 4,
          fontSize: theme.typography.caption.fontSize,
          color: theme.colors.textPlaceholder,
        },
        capRow: {
          fontSize: 14,
          lineHeight: 20,
          color: theme.colors.text,
          fontWeight: '600',
        },
        langChip: {
          minHeight: 44,
          minWidth: 44,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          justifyContent: 'center',
        },
        langChipOn: {
          borderColor: theme.colors.forest,
          backgroundColor: theme.colors.forestSoft,
        },
      }),
    [theme],
  );

  return (
    <View style={dynamic.root} testID="settings-screen">
      <View style={dynamic.topBar}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={styles.topBtn}
          accessibilityRole="button"
          accessibilityLabel={t('settings.closeA11y', lang)}
          testID="settings-close"
        >
          <Text style={dynamic.topBtnText}>←</Text>
        </Pressable>
        <Text style={dynamic.title}>{t('settings.title', lang)}</Text>
        <View style={styles.topBtn} />
      </View>

      {offline ? (
        <StatusBanner
          tone="offline"
          message={t('settings.offlineBanner', lang)}
          testID="settings-offline-banner"
        />
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={dynamic.section}>
          <Text style={dynamic.sectionLabel}>{t('settings.language', lang)}</Text>
          <View style={styles.langRow}>
            <Pressable
              style={[dynamic.langChip, lang === 'en' && dynamic.langChipOn]}
              onPress={() => setUiLang('en')}
              accessibilityRole="button"
              accessibilityState={{ selected: lang === 'en' }}
              accessibilityLabel={t('settings.languageEn', lang)}
              testID="settings-lang-en"
            >
              <Text style={dynamic.body}>{t('settings.languageEn', lang)}</Text>
            </Pressable>
            <Pressable
              style={[dynamic.langChip, lang === 'ne' && dynamic.langChipOn]}
              onPress={() => setUiLang('ne')}
              accessibilityRole="button"
              accessibilityState={{ selected: lang === 'ne' }}
              accessibilityLabel={t('settings.languageNe', lang)}
              testID="settings-lang-ne"
            >
              <Text style={dynamic.body}>{t('settings.languageNe', lang)}</Text>
            </Pressable>
          </View>
        </View>

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
                  t('settings.consentNotSavedTitle', lang),
                  t('settings.consentNotSavedBody', lang),
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
            style={dynamic.section}
            onPress={onOpenContributions}
            accessibilityRole="button"
            accessibilityLabel={t('settings.contributionsA11y', lang)}
            testID="settings-open-contributions"
          >
            <Text style={dynamic.sectionLabel}>
              {t('settings.contributions', lang)}
            </Text>
            <Text style={dynamic.body}>
              {t('settings.contributionsDetail', lang)}
            </Text>
          </Pressable>
        ) : null}

        <View style={dynamic.section} testID="settings-quality">
          <Text style={dynamic.sectionLabel}>
            {t('settings.quality', lang)}
          </Text>
          <Text style={dynamic.body}>{t('settings.qualityBody', lang)}</Text>
        </View>

        <View style={dynamic.section} testID="settings-privacy">
          <Text style={dynamic.sectionLabel}>
            {t('settings.privacy', lang)}
          </Text>
          <Text style={dynamic.body}>{t('settings.privacyBody', lang)}</Text>
        </View>

        <View style={dynamic.section} testID="settings-ads-privacy">
          <Text style={dynamic.sectionLabel}>
            {t('settings.adsPrivacy', lang)}
          </Text>
          {consent.privacyOptionsRequired ? (
            <Pressable
              onPress={() => void services.ads.showPrivacyOptions()}
              accessibilityRole="button"
              accessibilityLabel={t('settings.privacyOptionsA11y', lang)}
              testID="settings-ad-privacy-options"
            >
              <Text style={dynamic.link}>
                {t('settings.privacyOptions', lang)}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              void Linking.openURL(INAPPROPRIATE_AD_HELP).catch(() => {
                Alert.alert(
                  t('settings.reportAdFallbackTitle', lang),
                  t('settings.reportAdFallbackBody', lang),
                );
              });
            }}
            accessibilityRole="link"
            accessibilityLabel={t('settings.reportAdA11y', lang)}
            testID="settings-report-inappropriate-ad"
          >
            <Text style={dynamic.link}>{t('settings.reportAd', lang)}</Text>
          </Pressable>
        </View>

        <View style={dynamic.section}>
          <Text style={dynamic.sectionLabel}>{t('settings.about', lang)}</Text>
          <Text style={dynamic.body}>
            {neuralReady
              ? t('settings.aboutReady', lang)
              : t('settings.aboutPending', lang)}
          </Text>
          <Text style={dynamic.meta}>
            v{APP_VERSION}
            {BUILD_NUMBER ? ` (${BUILD_NUMBER})` : ''}
            {' · '}
            {neuralReady
              ? t('settings.modelReady', lang)
              : t('settings.modelPending', lang)}
          </Text>
          {auth.consentVersion ? (
            <Text style={dynamic.meta} testID="settings-consent-version">
              {auth.consentVersion === CONTRIBUTION_CONSENT_VERSION
                ? t('settings.consentCurrent', lang)
                : t('settings.consentVersion', lang, {
                    version: auth.consentVersion,
                  })}
            </Text>
          ) : null}
        </View>

        <View style={dynamic.section}>
          <Text style={dynamic.sectionLabel}>{t('settings.speech', lang)}</Text>
          {speechCaps ? (
            <>
              <Text style={dynamic.capRow}>{t('settings.speechEn', lang)}</Text>
              <Text style={dynamic.capRow}>
                {speechCaps.neStt
                  ? t('settings.speechNeAvailable', lang)
                  : t('settings.speechNeUnavailable', lang)}
              </Text>
              <Text style={dynamic.capRow}>
                {speechCaps.neTts
                  ? t('settings.ttsNeAvailable', lang)
                  : t('settings.ttsNeUnavailable', lang)}
              </Text>
              {!speechCaps.neStt || !speechCaps.neTts ? (
                <Text style={dynamic.meta}>
                  {t('settings.speechNote', lang)}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={dynamic.meta}>{t('settings.checking', lang)}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBtn: {
    width: 56,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: 40,
    gap: 12,
    paddingHorizontal: 16,
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});
