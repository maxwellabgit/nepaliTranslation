import { useEffect, useMemo, useRef, useState } from 'react';
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
import { PrivacyDataSection } from '../features/auth/PrivacyDataSection';
import {
  loadSharingToggles,
  saveSharingToggles,
  type SharingToggles,
} from '../storage/sharingToggles';
import { stopPendingSharingKind } from '../services/mediaEnqueue';
import { recordSharingToggles } from '../features/auth/recordSharingToggles';
import { useAuth } from '../features/auth/AuthProvider';
import { CONTRIBUTION_CONSENT_VERSION } from '../features/auth/consent';
import { recordContributionConsent } from '../features/auth/recordConsent';
import { flushPendingDrafts } from '../services/contributionSync';
import { useServices } from '../services/ServiceContext';
import { getSttSupport, hasNepaliVoice } from '../stt/sttSupport';
import { BackArrow } from '../components/BackArrow';
import { StatusBanner } from '../components/StatusBanner';
import { t, useNetworkOffline, useSetUiLang, useUiLang } from '../i18n';
import { useTheme } from '../theme';
import { useSubscriptionOptional } from '../features/subscription/SubscriptionProvider';
import { RewardedAdButton } from '../features/ads/RewardedAdButton';
import { useAdConsent } from '../features/ads/useAdConsent';
import { isHttpsUrl, readLegalPublicUrls } from '../config/legalUrls';
import { SupportSection } from '../features/support/SupportSection';

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
  const currentAuth = useRef(auth);
  currentAuth.current = auth;
  const consentAttempt = useRef(0);
  useEffect(() => () => { consentAttempt.current += 1; }, []);
  const services = useServices();
  const consent = useAdConsent(services.ads);
  const subscription = useSubscriptionOptional();
  const legalUrls = useMemo(() => readLegalPublicUrls(), []);
  const featureFlags = useFeatureFlags();
  const [sharing, setSharing] = useState<SharingToggles>({
    speech: false,
    photos: false,
  });
  const [supportCategory, setSupportCategory] = useState<'general' | 'ad' | null>(null);

  useEffect(() => {
    let active = true;
    void loadSharingToggles(auth.userId).then(value => { if (active) setSharing(value); });
    return () => { active = false; };
  }, [auth.userId, auth.consentVersion, auth.deletionDueAt, auth.deletionCompletedAt]);

  const refreshDataSummary = auth.refreshDataSummary;
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
      void refreshDataSummary();
    }
  }, [authStatus, refreshDataSummary]);

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
        <View style={styles.topBtn}>
          <BackArrow
            onPress={onClose}
            accessibilityLabel={t('settings.closeA11y', lang)}
            testID="settings-close"
          />
        </View>
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
            <Pressable
              style={[dynamic.langChip, lang === 'ne-roman' && dynamic.langChipOn]}
              onPress={() => setUiLang('ne-roman')}
              accessibilityRole="button"
              accessibilityState={{ selected: lang === 'ne-roman' }}
              accessibilityLabel={t('settings.languageRoman', lang)}
              testID="settings-lang-ne-roman"
            >
              <Text style={dynamic.body}>{t('settings.languageRoman', lang)}</Text>
            </Pressable>
          </View>
        </View>

        <View style={dynamic.section} testID="settings-credit-rewards">
          <Text style={dynamic.sectionLabel}>{t('settings.credits', lang)}</Text>
          <RewardedAdButton offline={offline} />
        </View>

        <PrivacyDataSection
          authConfigured={auth.authConfigured}
          status={auth.status}
          userId={auth.userId}
          consentVersion={auth.consentVersion}
          ageConfirmed={auth.ageConfirmed}
          deletionRetryPending={auth.deletionRetryPending}
          deletionDueAt={auth.deletionDueAt}
          deletionCompletedAt={auth.deletionCompletedAt}
          onRetryIdentity={() => void auth.retryIdentity()}
          onSaveConsent={() => {
            const owner = auth.userId;
            const attempt = ++consentAttempt.current;
            const valid = () => Boolean(owner && currentAuth.current.userId === owner &&
              currentAuth.current.status === 'signed-in' &&
              !currentAuth.current.deletionRetryPending &&
              !(currentAuth.current.deletionDueAt && !currentAuth.current.deletionCompletedAt) &&
              consentAttempt.current === attempt);
            if (!valid()) return;
            void auth.ensureGuestIdentity().then(async (ready) => {
              if (!ready || !valid()) return;
              const stopped = { speech: false, photos: false };
              setSharing(stopped);
              await saveSharingToggles(owner, stopped);
              if (!valid()) return;
              const result = await recordContributionConsent(owner!, valid);
              if (!valid()) return;
              if (!result.ok) {
                Alert.alert(t('settings.consentNotSavedTitle', lang),
                  t('settings.consentNotSavedBody', lang));
                return;
              }
              void flushPendingDrafts();
              void auth.refreshDataSummary();
            });
          }}
          onDeleteData={() => {
            consentAttempt.current += 1;
            setSharing({ speech: false, photos: false });
            void auth.deleteData().then(async () => {
              await auth.refreshDataSummary();
              setSharing(await loadSharingToggles(auth.userId));
            });
          }}
          speechSharing={sharing.speech}
          onToggleSpeechSharing={(enabled) => {
            const next = { ...sharing, speech: enabled };
            setSharing(next);
            void saveSharingToggles(auth.userId, next);
            void recordSharingToggles(next);
            if (!enabled && auth.userId) {
              void stopPendingSharingKind(auth.userId, 'speech');
            }
          }}
          onWithdrawConsent={() => {
            consentAttempt.current += 1;
            setSharing({ speech: false, photos: false });
            void auth.deleteData().then(async () => {
              await auth.refreshDataSummary();
              setSharing(await loadSharingToggles(auth.userId));
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

        <View style={dynamic.section}>
          <Pressable accessibilityRole="button" onPress={() => setSupportCategory('general')} testID="settings-in-app-support">
            <Text style={dynamic.link}>{t('support.title', lang)}</Text>
          </Pressable>
        </View>
        {supportCategory && <SupportSection key={`${auth.userId ?? 'offline'}:${supportCategory}`} category={supportCategory} />}

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
            onPress={() => setSupportCategory('ad')}
            accessibilityRole="button"
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
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
});
