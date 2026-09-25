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
import { BuildProvenanceCard } from '../components/BuildProvenanceCard';
import { useFeatureFlags } from '../app/FeatureConfigProvider';
import { AccountSection } from '../features/auth/AccountSection';
import { withdrawContributionConsent } from '../features/auth/withdrawContributionConsent';
import {
  loadSharingToggles,
  saveSharingToggles,
  type SharingToggles,
} from '../storage/sharingToggles';
import {
  discardOwnerContributionFiles,
  stopPendingSharingKind,
} from '../services/mediaEnqueue';
import { recordSharingToggles } from '../features/auth/recordSharingToggles';
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
import { useSubscriptionOptional } from '../features/subscription/SubscriptionProvider';
import { RewardedAdButton } from '../features/ads/RewardedAdButton';
import { useAdConsent } from '../features/ads/useAdConsent';
import { isHttpsUrl, readLegalPublicUrls } from '../config/legalUrls';

const INAPPROPRIATE_AD_HELP =
  'mailto:support@neptranslate.app?subject=Inappropriate%20ad%20report';

type LegalLink = {
  testID: string;
  labelKey:
    | 'settings.privacyPolicy'
    | 'settings.terms'
    | 'settings.supportLink'
    | 'settings.deletionInfo';
  a11yKey:
    | 'settings.privacyPolicyA11y'
    | 'settings.termsA11y'
    | 'settings.supportLinkA11y'
    | 'settings.deletionInfoA11y';
  url: string;
};

type Props = {
  onClose: () => void;
  onOpenTodaysReview?: () => void;
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
  onOpenTodaysReview,
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
  const consent = useAdConsent(services.ads);
  const subscription = useSubscriptionOptional();
  const legalUrls = useMemo(() => readLegalPublicUrls(), []);
  const featureFlags = useFeatureFlags();
  const [sharing, setSharing] = useState<SharingToggles>({
    speech: false,
    photos: false,
  });

  useEffect(() => {
    void loadSharingToggles(auth.userId).then(setSharing);
  }, [auth.userId]);

  const refreshAccountSummary = auth.refreshAccountSummary;
  const authStatus = auth.status;

  const openLegalUrl = (url: string) => {
    if (!isHttpsUrl(url)) {
      Alert.alert(
        t('settings.legalLinkUnavailableTitle', lang),
        t('settings.legalLinkUnavailableBody', lang),
      );
      return;
    }
    void Linking.openURL(url).catch(() => {
      Alert.alert(
        t('settings.legalLinkUnavailableTitle', lang),
        t('settings.legalLinkUnavailableBody', lang),
      );
    });
  };

  const legalLinks: LegalLink[] = [
    {
      testID: 'settings-privacy-policy',
      labelKey: 'settings.privacyPolicy',
      a11yKey: 'settings.privacyPolicyA11y',
      url: legalUrls.privacyPolicyUrl,
    },
    {
      testID: 'settings-terms',
      labelKey: 'settings.terms',
      a11yKey: 'settings.termsA11y',
      url: legalUrls.termsOfServiceUrl,
    },
    {
      testID: 'settings-support',
      labelKey: 'settings.supportLink',
      a11yKey: 'settings.supportLinkA11y',
      url: legalUrls.supportUrl,
    },
    {
      testID: 'settings-deletion-info',
      labelKey: 'settings.deletionInfo',
      a11yKey: 'settings.deletionInfoA11y',
      url: legalUrls.deletionInfoUrl,
    },
  ];
  const anyLegalLive = legalLinks.some((link) => isHttpsUrl(link.url));

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
          deletionDueAt={auth.deletionDueAt}
          deletionCompletedAt={auth.deletionCompletedAt}
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
          speechSharing={sharing.speech}
          photoSharing={sharing.photos}
          onToggleSpeechSharing={(enabled) => {
            const next = { ...sharing, speech: enabled };
            setSharing(next);
            void saveSharingToggles(auth.userId, next);
            void recordSharingToggles(next);
            if (!enabled && auth.userId) {
              void stopPendingSharingKind(auth.userId, 'speech');
            }
          }}
          onTogglePhotoSharing={(enabled) => {
            const next = { ...sharing, photos: enabled };
            setSharing(next);
            void saveSharingToggles(auth.userId, next);
            void recordSharingToggles(next);
            if (!enabled && auth.userId) {
              void stopPendingSharingKind(auth.userId, 'photo');
            }
          }}
          onWithdrawConsent={() => {
            void withdrawContributionConsent().then((result) => {
              if (!result.ok) {
                Alert.alert(
                  t('auth.withdrawConsentTitle', lang),
                  t('settings.consentNotSavedBody', lang),
                );
                return;
              }
              if (auth.userId) void discardOwnerContributionFiles(auth.userId);
              void auth.refreshAccountSummary();
            });
          }}
        />

        {onOpenTodaysReview ? (
          <Pressable
            style={dynamic.section}
            onPress={onOpenTodaysReview}
            accessibilityRole="button"
            accessibilityLabel={t('settings.todaysReviewA11y', lang)}
            testID="settings-open-todays-review"
          >
            <Text style={dynamic.sectionLabel}>
              {t('settings.todaysReview', lang)}
            </Text>
            <Text style={dynamic.body}>
              {t('settings.todaysReviewDetail', lang)}
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

        <View style={dynamic.section} testID="settings-legal">
          <Text style={dynamic.sectionLabel}>{t('settings.legal', lang)}</Text>
          {!anyLegalLive ? (
            <Text style={dynamic.body} testID="settings-legal-not-live">
              {t('settings.legalNotLive', lang)}
            </Text>
          ) : null}
          {legalLinks.map((link) => (
            <Pressable
              key={link.testID}
              onPress={() => openLegalUrl(link.url)}
              accessibilityRole="link"
              accessibilityLabel={t(link.a11yKey, lang)}
              testID={link.testID}
            >
              <Text style={dynamic.link}>{t(link.labelKey, lang)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={dynamic.section} testID="settings-ads-privacy">
          <Text style={dynamic.sectionLabel}>
            {t('settings.adsPrivacy', lang)}
          </Text>
          <RewardedAdButton offline={offline} />
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

        {subscription?.paywallEnabled ? (
          <View style={dynamic.section} testID="settings-subscription">
            <Text style={dynamic.sectionLabel}>
              {t('settings.subscription', lang)}
            </Text>
            <Pressable
              onPress={() => subscription.openPaywall()}
              accessibilityRole="button"
              accessibilityLabel={t('settings.openPaywallA11y', lang)}
              testID="settings-open-paywall"
            >
              <Text style={dynamic.link}>{t('settings.openPaywall', lang)}</Text>
            </Pressable>
            <Pressable
              onPress={() => void subscription.manage()}
              accessibilityRole="link"
              accessibilityLabel={t('settings.manageSubscriptionA11y', lang)}
              testID="settings-manage-subscription"
            >
              <Text style={dynamic.link}>
                {t('settings.manageSubscription', lang)}
              </Text>
            </Pressable>
          </View>
        ) : null}

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
          <BuildProvenanceCard flags={featureFlags} />
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
