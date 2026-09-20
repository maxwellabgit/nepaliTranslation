import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clampLessonPosition,
  DEFAULT_LESSON_POSITION,
  type LessonPosition,
} from './alphabet';

const KEY = 'nepx.learn.lesson.v1';

export async function loadLessonPosition(): Promise<LessonPosition> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_LESSON_POSITION;
    const parsed = JSON.parse(raw) as LessonPosition;
    if (
      parsed.sectionId !== 'vowels' &&
      parsed.sectionId !== 'consonants' &&
      parsed.sectionId !== 'conjuncts'
    ) {
      return DEFAULT_LESSON_POSITION;
    }
    if (typeof parsed.glyphIndex !== 'number') return DEFAULT_LESSON_POSITION;
    return clampLessonPosition(parsed);
  } catch {
    return DEFAULT_LESSON_POSITION;
  }
}

export async function saveLessonPosition(pos: LessonPosition): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(clampLessonPosition(pos)));
}
