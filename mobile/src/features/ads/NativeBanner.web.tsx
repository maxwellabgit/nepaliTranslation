import { Text } from 'react-native';
import { colors } from '../../theme';

/** Browser manual-test placeholder. Native AdMob does not load on web. */
export function NativeOrPlaceholderBanner(_props: { unitId: string }) {
  return (
    <Text style={{ color: colors.textSecondary, fontSize: 12, padding: 10 }}>
      Ad
    </Text>
  );
}
