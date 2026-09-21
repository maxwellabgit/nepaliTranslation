import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { AppShell } from '../../app/AppShell';
import type { HistoryItem } from '../../storage/phrasebook';

function FakeAuto({
  active,
  onOpenHistory,
}: {
  active: boolean;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  neuralReady: boolean;
  mtWarmStatus: string | null;
  seed?: HistoryItem | null;
}) {
  const [text, setText] = useState('hello-auto');
  return (
    <View testID="fake-auto">
      <Text testID="auto-active">{active ? 'active' : 'inactive'}</Text>
      <TextInput
        testID="auto-input"
        value={text}
        onChangeText={setText}
        accessibilityLabel="Translate input"
      />
      <Pressable
        testID="open-history"
        accessibilityRole="button"
        accessibilityLabel="Open history"
        onPress={onOpenHistory}
      >
        <Text>History</Text>
      </Pressable>
    </View>
  );
}

function FakeCamera() {
  return <View testID="camera-preview" />;
}

function FakeLearn({ active }: { active: boolean }) {
  const [mark, setMark] = useState('lesson-pos');
  return (
    <View testID="fake-learn">
      <Text testID="learn-active">{active ? 'active' : 'inactive'}</Text>
      <TextInput
        testID="learn-mark"
        value={mark}
        onChangeText={setMark}
        accessibilityLabel="Learn mark"
      />
    </View>
  );
}

function FakeHistory({
  onClose,
}: {
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
}) {
  return (
    <View testID="fake-history">
      <Pressable
        testID="close-history"
        accessibilityRole="button"
        accessibilityLabel="Close history"
        onPress={onClose}
      >
        <Text>Close</Text>
      </Pressable>
    </View>
  );
}

async function renderShell(onHardStop = jest.fn()) {
  await render(
    <AppShell
      neuralReady={false}
      mtWarmStatus={null}
      onHardStop={onHardStop}
      TranslatePane={(p) => <FakeAuto {...p} />}
      CameraPane={() => <FakeCamera />}
      LearnPane={(p) => <FakeLearn {...p} />}
      HistoryOverlay={(p) => <FakeHistory {...p} />}
      SettingsOverlay={() => <View testID="fake-settings" />}
      ContributionsOverlay={() => <View testID="fake-contributions" />}
    />,
  );
  return onHardStop;
}

describe('AppShell tabs and overlays', () => {
  test('unmounts Camera and keeps Translate text across tabs', async () => {
    await renderShell();

    await fireEvent.press(screen.getByTestId('tab-camera'));
    expect(screen.getByTestId('camera-preview')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tab-translate'));
    expect(screen.queryByTestId('camera-preview')).toBeNull();
    expect(screen.getByTestId('auto-input').props.value).toBe('hello-auto');

    await fireEvent.press(screen.getByTestId('tab-camera'));
    expect(screen.getByTestId('camera-preview')).toBeTruthy();
  });

  test('invokes hard stop when switching tabs', async () => {
    const onHardStop = await renderShell();
    await fireEvent.press(screen.getByTestId('tab-camera'));
    expect(onHardStop).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('tab-translate'));
    expect(onHardStop).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByTestId('tab-learn'));
    expect(onHardStop).toHaveBeenCalledTimes(3);
  });

  test('keeps Learn pane state when switching away and back', async () => {
    await renderShell();
    await fireEvent.press(screen.getByTestId('tab-learn'));
    await fireEvent.changeText(screen.getByTestId('learn-mark'), 'keep-lesson');
    await fireEvent.press(screen.getByTestId('tab-translate'));
    expect(screen.queryByTestId('learn-mark')).toBeNull();
    await fireEvent.press(screen.getByTestId('tab-learn'));
    expect(screen.getByTestId('learn-mark').props.value).toBe('keep-lesson');
  });

  test('opens History overlay with hard stop and closes without remounting panes', async () => {
    const onHardStop = await renderShell();
    await fireEvent.changeText(screen.getByTestId('auto-input'), 'persist');
    await fireEvent.press(screen.getByTestId('open-history'));
    expect(onHardStop).toHaveBeenCalled();
    expect(screen.getByTestId('overlay-history')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('close-history'));
    expect(screen.queryByTestId('overlay-history')).toBeNull();
    expect(screen.getByTestId('auto-input').props.value).toBe('persist');
  });
});
