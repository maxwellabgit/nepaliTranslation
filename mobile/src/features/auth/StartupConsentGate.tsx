import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  isStartupConsentCurrent,
  loadStartupConsent,
  saveStartupConsent,
  STARTUP_CONSENT_VERSION,
} from '../../storage/startupConsent';
import { recordStartupConsent } from './recordStartupConsent';
import { AppButton } from '../../components/AppPrimitives';
import { t, useSetUiLang, useUiLang } from '../../i18n';
import { useTheme } from '../../theme';
import { readLegalPublicUrls } from '../../config/legalUrls';

/**
 * G2 startup consent gate.
 *
 * Wraps the app tree. Renders `children` only when the local record shows
 * T&C + Privacy + 18+ acknowledged for the current version. Otherwise a
 * bilingual modal takes over.
 *
 * The device-local record is authoritative for reaching product surfaces
 * (so guests can translate). If the user later signs in, we mirror the
 * acknowledgement to Supabase via `service_record_startup_consent`.
 */
type Props = {
  children: ReactNode;
  /** Testing seam — override the initial acknowledgement state. */
  initialAcknowledged?: boolean;
};

export function StartupConsentGate({ children, initialAcknowledged }: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const setLang = useSetUiLang();
  const [acknowledged, setAcknowledged] = useState<boolean>(
    initialAcknowledged ?? false,
  );
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [ready, setReady] = useState<boolean>(initialAcknowledged ?? false);

  useEffect(() => {
    // Test seam: when the parent asserts consent (production integration
    // tests, LearnScreen-test, ContributionsScreen-test, ...) skip the
    // storage lookup entirely so the effect cannot flip the gate closed
    // after the first render.
    if (initialAcknowledged) {
      setAcknowledged(true);
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const record = await loadStartupConsent();
      if (cancelled) return;
      const ok = isStartupConsentCurrent(record);
      setAcknowledged(ok);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialAcknowledged]);

  const openTerms = useCallback(() => {
    const url = readLegalPublicUrls().termsOfServiceUrl.trim();
    if (url) void Linking.openURL(url);
  }, []);
  const openPrivacy = useCallback(() => {
    const url = readLegalPublicUrls().privacyPolicyUrl.trim();
    if (url) void Linking.openURL(url);
  }, []);

  const canContinue = terms && privacy;

  const dynamic = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: theme.colors.bg },
        scroll: { padding: theme.spacing.lg, gap: theme.spacing.md },
        title: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.colors.text,
        },
        intro: { fontSize: 15, color: theme.colors.textSecondary },
        row: {
          flexDirection: 'row',
          gap: theme.spacing.md,
          alignItems: 'flex-start',
        },
        checkbox: {
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: theme.colors.text,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        },
        checkboxChecked: { backgroundColor: theme.colors.text },
        checkmark: { color: theme.colors.bg, fontWeight: '900', fontSize: 16 },
        text: { flex: 1, fontSize: 15, color: theme.colors.text },
        link: {
          color: theme.colors.blue,
          textDecorationLine: 'underline',
          marginTop: 4,
          fontSize: 14,
        },
        version: {
          fontSize: 12,
          color: theme.colors.textSecondary,
          marginTop: theme.spacing.md,
        },
        disabled: {
          fontSize: 12,
          color: theme.colors.textSecondary,
          marginTop: 4,
        },
      }),
    [theme],
  );

  const submit = useCallback(async () => {
    if (!canContinue) return;
    await saveStartupConsent({
      terms,
      privacy,
      age18Plus: false,
    });
    void recordStartupConsent({
      terms,
      privacy,
      age18Plus: false,
    });
    setAcknowledged(true);
  }, [canContinue, terms, privacy]);

  if (!ready) return null;
  if (acknowledged) return <>{children}</>;

  return (
    <View style={dynamic.root} testID="startup-consent-gate">
      <ScrollView contentContainerStyle={dynamic.scroll}>
        <Text style={dynamic.title}>{t('startupConsent.title', lang)}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.languageEn', lang)}
            onPress={() => setLang('en')}
            testID="startup-consent-lang-en"
          >
            <Text style={dynamic.link}>{t('settings.languageEn', lang)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.languageNe', lang)}
            onPress={() => setLang('ne')}
            testID="startup-consent-lang-ne"
          >
            <Text style={dynamic.link}>{t('settings.languageNe', lang)}</Text>
          </Pressable>
        </View>
        <Text style={dynamic.intro}>{t('startupConsent.intro', lang)}</Text>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: terms }}
          accessibilityLabel={t('startupConsent.terms', lang)}
          onPress={() => setTerms((v) => !v)}
          style={dynamic.row}
          testID="startup-consent-terms"
        >
          <View
            style={[
              dynamic.checkbox,
              terms ? dynamic.checkboxChecked : null,
            ]}
          >
            {terms ? <Text style={dynamic.checkmark}>✓</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={dynamic.text}>{t('startupConsent.terms', lang)}</Text>
            <Text style={dynamic.link} onPress={openTerms}>
              {t('startupConsent.readTerms', lang)}
            </Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: privacy }}
          accessibilityLabel={t('startupConsent.privacy', lang)}
          onPress={() => setPrivacy((v) => !v)}
          style={dynamic.row}
          testID="startup-consent-privacy"
        >
          <View
            style={[
              dynamic.checkbox,
              privacy ? dynamic.checkboxChecked : null,
            ]}
          >
            {privacy ? <Text style={dynamic.checkmark}>✓</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={dynamic.text}>{t('startupConsent.privacy', lang)}</Text>
            <Text style={dynamic.link} onPress={openPrivacy}>
              {t('startupConsent.readPrivacy', lang)}
            </Text>
          </View>
        </Pressable>

        <AppButton
          onPress={submit}
          disabled={!canContinue}
          testID="startup-consent-continue"
          label={t('startupConsent.continue', lang)}
        />
        {!canContinue ? (
          <Text style={dynamic.disabled}>
            {t('startupConsent.continueDisabled', lang)}
          </Text>
        ) : null}
        <Text style={dynamic.version}>
          {t('startupConsent.versionLabel', lang).replace(
            '{version}',
            STARTUP_CONSENT_VERSION,
          )}
        </Text>
      </ScrollView>
    </View>
  );
}
