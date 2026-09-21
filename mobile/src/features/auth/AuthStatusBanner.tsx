import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from './AuthProvider';
import { useServices } from '../../services/ServiceContext';
import { colors } from '../../theme';

/**
 * Visible, accessible feedback for auth/server failures.
 * Prefers AuthProvider alert; falls back to AuthService.lastError for tests/adapters.
 */
export function AuthStatusBanner() {
  const { alert, error, clearAlert } = useAuth();
  const { auth } = useServices();
  const serviceError = auth.lastError();
  const message = alert ?? error ?? serviceError;
  if (!message) return null;

  return (
    <View
      style={styles.banner}
      testID="auth-status-banner"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text} testID="auth-status-message">
        {message}
      </Text>
      <Pressable
        onPress={() => {
          clearAlert();
          auth.setLastError?.(null);
        }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss sign-in message"
        testID="auth-status-dismiss"
        hitSlop={8}
      >
        <Text style={styles.dismiss}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEE2E2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    flex: 1,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 18,
  },
  dismiss: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 14,
  },
});
