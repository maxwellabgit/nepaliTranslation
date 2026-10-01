import { StyleSheet, View } from 'react-native';
import { CreditAwardOverlay } from './CreditAwardOverlay';
import { useCreditAwardOptional } from './CreditAwardProvider';

/** Root award layer shared by Translate, Camera, and Learn. */
export function CreditAwardHost() {
  const award = useCreditAwardOptional();
  if (!award.presentation || award.phase === 'idle') return null;
  return (
    <View pointerEvents="box-none" style={styles.host}>
      <CreditAwardOverlay
        credits={award.presentation.credits}
        minutes={award.presentation.minutes}
        capped={award.presentation.capped}
        totalCredits={Math.floor(award.presentation.toRemainingMs / 600_000)}
        title={award.presentation.title}
        body={award.presentation.body}
        rewardName={award.presentation.rewardName}
        flying={award.phase !== 'message'}
        onCollect={award.collect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 40,
  },
});
