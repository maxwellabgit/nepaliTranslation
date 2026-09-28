import { Image, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import type { ReviewCategoryId } from '../features/contribution/reviewFlow';

const IMAGES: Record<ReviewCategoryId, number> = {
  english: require('../../assets/review/english.png'),
  deva: require('../../assets/review/devanagari.png'),
  roman: require('../../assets/review/romanized.png'),
};

export const REVIEW_CATEGORY_FACE: Record<
  ReviewCategoryId,
  {
    kicker: 'review.kickerEnglish' | 'review.kickerNepali';
    title: 'review.cardEnglish' | 'review.cardDeva' | 'review.cardRoman';
    bg: string;
    bgDark: string;
    accent: string;
  }
> = {
  english: {
    kicker: 'review.kickerEnglish',
    title: 'review.cardEnglish',
    bg: '#E8F6EA',
    bgDark: '#1C3326',
    accent: '#1E9B4A',
  },
  deva: {
    kicker: 'review.kickerNepali',
    title: 'review.cardDeva',
    bg: '#FDE8E6',
    bgDark: '#3A2424',
    accent: '#E24B4B',
  },
  roman: {
    kicker: 'review.kickerNepali',
    title: 'review.cardRoman',
    bg: '#E7F3FC',
    bgDark: '#1A2C3A',
    accent: '#2F86E0',
  },
};

function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const FADE_STEPS = 18;

/** Photo behind a Today's 10 card. Miniatures keep only the right side. */
export function ReviewCategoryImage({
  id,
  miniature = false,
}: {
  id: ReviewCategoryId;
  miniature?: boolean;
}) {
  if (miniature) {
    return (
      <View pointerEvents="none" style={styles.miniWindow}>
        <Image source={IMAGES[id]} resizeMode="cover" style={styles.miniImage} />
      </View>
    );
  }

  const tint = REVIEW_CATEGORY_FACE[id].bg;
  const webFade =
    Platform.OS === 'web'
      ? ({
          backgroundImage: `linear-gradient(90deg, ${tint} 0%, ${tint} 46%, ${rgba(tint, 0.82)} 60%, ${rgba(tint, 0.28)} 74%, ${rgba(tint, 0)} 88%)`,
        } as ViewStyle)
      : null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={IMAGES[id]} resizeMode="cover" style={styles.fullImage} />
      <View pointerEvents="none" style={[styles.fade, webFade]}>
        {Platform.OS === 'web'
          ? null
          : Array.from({ length: FADE_STEPS }, (_, step) => (
              <View
                key={step}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${(step / FADE_STEPS) * 100}%`,
                  width: `${100 / FADE_STEPS + 0.8}%`,
                  backgroundColor: tint,
                  opacity: Math.max(0, 1 - step / (FADE_STEPS - 1)),
                }}
              />
            ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '128%',
    height: '100%',
  },
  fade: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
  },
  miniWindow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '46%',
    overflow: 'hidden',
  },
  miniImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '230%',
    height: '100%',
  },
});
