import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type AppButtonProps = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

const variantStyles: Record<
  Variant,
  { bg: string; border: string; text: string }
> = {
  primary: { bg: colors.crimson, border: colors.crimson, text: '#fff' },
  secondary: { bg: colors.surface, border: colors.divider, text: colors.text },
  danger: { bg: colors.surface, border: colors.danger, text: colors.danger },
  ghost: { bg: 'transparent', border: 'transparent', text: colors.blue },
};

export function AppButton({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  labelStyle,
  accessibilityLabel,
  testID,
  ...rest
}: AppButtonProps) {
  const v = variantStyles[variant];
  const isDisabled = Boolean(disabled || loading);
  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      style={[
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text style={[styles.label, { color: v.text }, labelStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

type AppCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function AppCard({ children, style, testID }: AppCardProps) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

type AppHeaderProps = {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  testID?: string;
};

export function AppHeader({ title, onBack, right, testID }: AppHeaderProps) {
  return (
    <View style={styles.header} testID={testID ?? 'app-header'}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={styles.headerSide}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="app-header-back"
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
      ) : (
        <View style={styles.headerSide} />
      )}
      <Text style={styles.headerTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  );
}

type FlashProps = {
  message: string;
  visible: boolean;
  testID?: string;
};

export function AppToast({ message, visible, testID }: FlashProps) {
  if (!visible) return null;
  return (
    <View
      style={styles.toast}
      accessibilityLiveRegion="polite"
      testID={testID ?? 'app-toast'}
    >
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

type StateProps = {
  title: string;
  detail?: string;
  testID?: string;
};

export function LoadingState({ title, detail, testID }: StateProps) {
  return (
    <View style={styles.state} testID={testID ?? 'loading-state'}>
      <ActivityIndicator color={colors.crimson} />
      <Text style={styles.stateTitle}>{title}</Text>
      {detail ? <Text style={styles.stateDetail}>{detail}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, detail, testID }: StateProps) {
  return (
    <View style={styles.state} testID={testID ?? 'empty-state'}>
      <Text style={styles.stateTitle}>{title}</Text>
      {detail ? <Text style={styles.stateDetail}>{detail}</Text> : null}
    </View>
  );
}

export function ErrorState({ title, detail, testID }: StateProps) {
  return (
    <View style={styles.state} testID={testID ?? 'error-state'}>
      <Text style={[styles.stateTitle, styles.errorTitle]}>{title}</Text>
      {detail ? <Text style={styles.stateDetail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  label: { fontSize: 15, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  headerSide: { width: 72, minHeight: 44, justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  backText: { fontSize: 22, color: colors.text },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  stateDetail: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorTitle: { color: colors.danger },
});
