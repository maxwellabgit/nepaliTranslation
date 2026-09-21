import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Clipboard from 'expo-clipboard';
import {
  CONTRIBUTION_CONSENT_SUMMARY,
  CONTRIBUTION_CONSENT_VERSION,
} from './consent';
import { t, useUiLang } from '../../i18n';
import { useTheme } from '../../theme';

type Props = {
  authConfigured: boolean;
  status:
    | 'initializing'
    | 'guest'
    | 'signing-in'
    | 'signed-in'
    | 'deleting'
    | 'error';
  userId: string | null;
  consentVersion: string | null;
  ageConfirmed: boolean;
  deletionRetryPending?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onSaveConsent: (ageConfirmed: boolean) => void;
  onDeleteAccount: () => void;
};

export function AccountSection({
  authConfigured,
  status,
  userId,
  consentVersion,
  ageConfirmed,
  deletionRetryPending = false,
  onSignIn,
  onSignOut,
  onSaveConsent,
  onDeleteAccount,
}: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const [age, setAge] = useState(ageConfirmed);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const signedIn = (status === 'signed-in' || status === 'deleting') && Boolean(userId);
  const consentCurrent = consentVersion === CONTRIBUTION_CONSENT_VERSION && age;

  useEffect(() => {
    setAge(ageConfirmed);
  }, [ageConfirmed]);

  useEffect(() => {
    let cancelled = false;
    void AppleAuthentication.isAvailableAsync().then((ok) => {
      if (!cancelled) setAppleAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmDelete = () => {
    Alert.alert(
      t('auth.deleteAccountTitle', lang),
      t('auth.deleteAccountBody', lang),
      [
        { text: t('common.cancel', lang), style: 'cancel' },
        {
          text: t('auth.deleteAccount', lang),
          style: 'destructive',
          onPress: onDeleteAccount,
        },
      ],
    );
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginTop: 20,
          marginHorizontal: 16,
          padding: 16,
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          gap: 8,
        },
        sectionLabel: {
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: theme.colors.textSecondary,
        },
        body: { fontSize: 15, lineHeight: 22, color: theme.colors.text },
        meta: { fontSize: 12, color: theme.colors.textPlaceholder },
        mono: { fontSize: 12, color: theme.colors.textSecondary },
        link: {
          fontSize: 15,
          fontWeight: '700',
          color: theme.colors.blue,
          minHeight: 44,
        },
        button: {
          minHeight: 44,
          borderRadius: 12,
          backgroundColor: theme.colors.text,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
        },
        buttonOff: { opacity: 0.45 },
        buttonText: {
          color: theme.colors.onPrimary,
          fontWeight: '700',
          fontSize: 15,
        },
        danger: {
          fontSize: 15,
          fontWeight: '700',
          color: theme.colors.danger,
          minHeight: 44,
        },
        appleButton: { width: '100%', height: 44 },
      }),
    [theme],
  );

  return (
    <View style={styles.section} testID="account-section">
      <Text style={styles.sectionLabel}>{t('auth.account', lang)}</Text>
      {!authConfigured ? (
        <Text style={styles.body}>{t('auth.notConfigured', lang)}</Text>
      ) : null}
      {authConfigured && !signedIn && appleAvailable ? (
        <View testID="sign-in-apple">
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={
              theme.scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={12}
            style={styles.appleButton}
            onPress={onSignIn}
            accessibilityLabel={t('auth.signInApple', lang)}
          />
        </View>
      ) : null}
      {authConfigured && !signedIn && !appleAvailable ? (
        <Text style={styles.body} testID="apple-unavailable">
          {t('auth.signInUnavailable', lang)}
        </Text>
      ) : null}
      {status === 'signing-in' ? (
        <Text style={styles.meta} accessibilityLiveRegion="polite">
          {t('common.loading', lang)}
        </Text>
      ) : null}
      {signedIn ? (
        <>
          <Text style={styles.body}>{t('auth.supportUserId', lang)}</Text>
          <Text style={styles.mono} testID="support-user-id">
            {userId}
          </Text>
          <Pressable
            onPress={() => void Clipboard.setStringAsync(userId ?? '')}
            accessibilityRole="button"
            accessibilityLabel={t('auth.copyUserIdA11y', lang)}
            testID="copy-user-id"
          >
            <Text style={styles.link}>{t('common.copy', lang)}</Text>
          </Pressable>
          <Pressable
            onPress={() => void onSignOut()}
            accessibilityRole="button"
            accessibilityLabel={t('auth.signOut', lang)}
            testID="sign-out"
          >
            <Text style={styles.link}>{t('auth.signOut', lang)}</Text>
          </Pressable>
        </>
      ) : null}

      <Text style={styles.sectionLabel}>{t('settings.contributions', lang)}</Text>
      <Text style={styles.body}>{CONTRIBUTION_CONSENT_SUMMARY}</Text>
      <Text style={styles.meta}>
        {t('auth.consentDraftMeta', lang, {
          version: CONTRIBUTION_CONSENT_VERSION,
        })}
      </Text>
      <Pressable
        onPress={() => setAge((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: age }}
        accessibilityLabel={t('auth.ageConfirm', lang)}
        testID="age-confirm"
      >
        <Text style={styles.body}>
          {age ? '☑' : '☐'} {t('auth.ageConfirm', lang)}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.button, (!signedIn || !age) && styles.buttonOff]}
        disabled={!signedIn || !age || consentCurrent}
        onPress={() => onSaveConsent(true)}
        accessibilityRole="button"
        accessibilityLabel={t('auth.saveConsent', lang)}
        testID="save-consent"
      >
        <Text style={styles.buttonText}>
          {consentCurrent
            ? t('auth.consentSaved', lang)
            : t('auth.saveConsent', lang)}
        </Text>
      </Pressable>
      {signedIn ? (
        <>
          <Pressable
            onPress={confirmDelete}
            disabled={status === 'deleting'}
            accessibilityRole="button"
            accessibilityLabel={t('auth.deleteAccount', lang)}
            testID="delete-account"
          >
            <Text style={styles.danger}>
              {status === 'deleting'
                ? t('auth.deleting', lang)
                : t('auth.deleteAccount', lang)}
            </Text>
          </Pressable>
          {deletionRetryPending ? (
            <Pressable
              onPress={onDeleteAccount}
              accessibilityRole="button"
              accessibilityLabel={t('auth.retryDeleteA11y', lang)}
              testID="retry-delete-account"
            >
              <Text style={styles.link}>{t('common.retry', lang)}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
