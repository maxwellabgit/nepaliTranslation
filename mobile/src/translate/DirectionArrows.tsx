import { StyleSheet, View } from 'react-native';

/** Real stroke widths: icon-font weight does not reliably change on iOS. */
export function DirectionArrows({ source }: { source: 'en' | 'ne' }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.pair}>
      {(['en', 'ne'] as const).map((side) => {
        const selected = source === side;
        return (
          <View key={side} style={styles.arrow}>
            <View testID={`direction-${side}-shaft`} style={[styles.shaft, selected && styles.boldShaft]} />
            <View style={[styles.head, side === 'en' ? styles.right : styles.left, selected && styles.boldHead]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { width: 24, gap: 3 },
  arrow: { height: 9 },
  shaft: { position: 'absolute', left: 1, right: 1, top: 4, height: 1, backgroundColor: '#1A1410' },
  boldShaft: { top: 3, height: 3 },
  head: { position: 'absolute', top: 1, width: 7, height: 7, borderTopWidth: 1, borderRightWidth: 1, borderColor: '#1A1410' },
  boldHead: { borderTopWidth: 3, borderRightWidth: 3 },
  right: { right: 1, transform: [{ rotate: '45deg' }] },
  left: { left: 1, transform: [{ rotate: '225deg' }] },
});
