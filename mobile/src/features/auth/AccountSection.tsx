import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Clipboard from 'expo-clipboard';
import {
  CONTRIBUTION_CONSENT_SUMMARY,
  CONTRIBUTION_CONSENT_VERSION,
} from './consent';
import { colors } from '../../theme';

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
      'Delete account',
      'This deletes your NepTranslate account and contribution data on our servers. It does not cancel an Apple subscription. Translation history on this device stays until you clear it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: onDeleteAccount,
        },
      ],
    );
  };

  return (
    <View style={styles.section} testID="account-section">
      <Text style={styles.sectionLabel}>Account</Text>
      {!authConfigured ? (
        <Text style={styles.body}>
          Sign-in is not configured in this build. Translation, history, and
          settings still work.
        </Text>
      ) : null}
      {authConfigured && !signedIn && appleAvailable ? (
        <View testID="sign-in-apple">
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={styles.appleButton}
            onPress={onSignIn}
            accessibilityLabel="Sign in with Apple"
          />
        </View>
      ) : null}
      {authConfigured && !signedIn && !appleAvailable ? (
        <Text style={styles.body} testID="apple-unavailable">
          Sign in with Apple is not available on this device. Translation still
          works.
        </Text>
      ) : null}
      {status === 'signing-in' ? (
        <Text style={styles.meta} accessibilityLiveRegion="polite">
          Signing in…
        </Text>
      ) : null}
      {signedIn ? (
        <>
          <Text style={styles.body}>Support user ID</Text>
          <Text style={styles.mono} testID="support-user-id">
            {userId}
          </Text>
          <Pressable
            onPress={() => void Clipboard.setStringAsync(userId ?? '')}
            accessibilityRole="button"
            accessibilityLabel="Copy support user ID"
            testID="copy-user-id"
          >
            <Text style={styles.link}>Copy</Text>
          </Pressable>
          <Pressable
            onPress={() => void onSignOut()}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            testID="sign-out"
          >
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </>
      ) : null}

      <Text style={styles.sectionLabel}>Contributions</Text>
      <Text style={styles.body}>{CONTRIBUTION_CONSENT_SUMMARY}</Text>
      <Text style={styles.meta}>
        Draft {CONTRIBUTION_CONSENT_VERSION}. Legal review required before
        collection.
      </Text>
      <Pressable
        onPress={() => setAge((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: age }}
        accessibilityLabel="I confirm I am 13 or older"
        testID="age-confirm"
      >
        <Text style={styles.body}>{age ? '☑' : '☐'} I am 13 or older</Text>
      </Pressable>
      <Pressable
        style={[styles.button, (!signedIn || !age) && styles.buttonOff]}
        disabled={!signedIn || !age || consentCurrent}
        onPress={() => onSaveConsent(true)}
        accessibilityRole="button"
        accessibilityLabel="Save contribution consent"
        testID="save-consent"
      >
        <Text style={styles.buttonText}>
          {consentCurrent ? 'Consent saved' : 'Save consent'}
        </Text>
      </Pressable>
      {signedIn ? (
        <>
          <Pressable
            onPress={confirmDelete}
            disabled={status === 'deleting'}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            testID="delete-account"
          >
            <Text style={styles.danger}>
              {status === 'deleting' ? 'Deleting…' : 'Delete account'}
            </Text>
          </Pressable>
          {deletionRetryPending ? (
            <Pressable
              onPress={onDeleteAccount}
              accessibilityRole="button"
              accessibilityLabel="Retry account deletion"
              testID="retry-delete-account"
            >
              <Text style={styles.link}>Retry deletion</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  meta: { fontSize: 12, color: colors.textPlaceholder },
  mono: { fontSize: 12, color: colors.textSecondary },
  link: { fontSize: 15, fontWeight: '700', color: colors.blue, minHeight: 44 },
  button: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonOff: { opacity: 0.45 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  danger: { fontSize: 15, fontWeight: '700', color: colors.danger, minHeight: 44 },
  appleButton: { width: '100%', height: 44 },
});
