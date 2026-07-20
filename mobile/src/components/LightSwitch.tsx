import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  /** When true, switch is ON (right). */
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Label shown when off (left). */
  offLabel: string;
  /** Label shown when on (right). */
  onLabel: string;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/**
 * Light-switch toggle. ON = right side (accent). Used for Formal (on)
 * and Devanagari (on) vs Informal / Roman (off).
 */
export function LightSwitch({
  value,
  onValueChange,
  offLabel,
  onLabel,
  disabled,
  accessibilityLabel,
}: Props) {
  const a11yLabel =
    accessibilityLabel ?? `${value ? onLabel : offLabel}, switch`;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.row, disabled && styles.disabled]}
    >
      <Text style={[styles.sideLabel, !value && styles.sideLabelActive]}>
        {offLabel}
      </Text>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
      <Text style={[styles.sideLabel, value && styles.sideLabelActive]}>
        {onLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  disabled: { opacity: 0.45 },
  sideLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    minWidth: 64,
  },
  sideLabelActive: {
    color: colors.text,
    fontWeight: '700',
  },
  track: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#D4CBC2',
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  trackOn: {
    backgroundColor: colors.forest,
    justifyContent: 'flex-end',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  thumbOn: {},
});
