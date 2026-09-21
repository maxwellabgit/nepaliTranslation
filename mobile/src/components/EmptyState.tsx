import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme';

export type EmptyStateKind = 'empty' | 'loading' | 'error' | 'offline';

type Props = {
  title: string;
  detail?: string;
  kind?: EmptyStateKind;
  action?: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Reusable empty / loading / error / offline block for secondary surfaces.
 * testID defaults by kind so unit tests can assert without per-screen IDs.
 */
export function EmptyState({
  title,
  detail,
  kind = 'empty',
  action,
  testID,
  style,
}: Props) {
  const theme = useTheme();
  const resolvedTestId =
    testID ??
    (kind === 'loading'
      ? 'empty-state-loading'
      : kind === 'error'
        ? 'empty-state-error'
        : kind === 'offline'
          ? 'empty-state-offline'
          : 'empty-state');

  const titleColor =
    kind === 'error' ? theme.error.text : theme.colors.text;
  const detailColor =
    kind === 'offline' ? theme.colors.textSecondary : theme.colors.textSecondary;

  return (
    <View
      style={[
        styles.root,
        {
          padding: theme.spacing.xl,
          gap: theme.spacing.sm,
        },
        style,
      ]}
      testID={resolvedTestId}
      accessibilityRole={kind === 'error' ? 'alert' : undefined}
    >
      {kind === 'loading' ? (
        <ActivityIndicator
          color={theme.colors.crimson}
          testID="empty-state-spinner"
        />
      ) : null}
      <Text
        style={[
          styles.title,
          {
            color: titleColor,
            fontSize: theme.typography.title.fontSize,
            fontWeight: '700',
          },
        ]}
        testID={`${resolvedTestId}-title`}
      >
        {title}
      </Text>
      {detail ? (
        <Text
          style={[
            styles.detail,
            {
              color: detailColor,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
            },
          ]}
          testID={`${resolvedTestId}-detail`}
        >
          {detail}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  detail: {
    textAlign: 'center',
  },
});
