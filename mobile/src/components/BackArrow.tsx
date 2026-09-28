import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

type Props = {
  onPress?: () => void;
  accessibilityLabel: string;
  testID?: string;
};

/** Same back control as Learn: Ionicons arrow, 24px, theme text color, 44pt target. */
export function BackArrow({ onPress, accessibilityLabel, testID }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      hitSlop={12}
      style={styles.btn}
    >
      <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
