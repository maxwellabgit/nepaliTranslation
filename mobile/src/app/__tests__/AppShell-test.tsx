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
        accessibilityLabel="Auto input"
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

function FakeConversation({ active }: { active: boolean; neuralReady: boolean }) {
  const [note, setNote] = useState('thread-alive');
  return (
    <View testID="fake-conversation">
      <Text testID="conversation-active">{active ? 'active' : 'inactive'}</Text>
      <TextInput
        testID="conversation-note"
        value={note}
        onChangeText={setNote}
        accessibilityLabel="Conversation note"
      />
    </View>
  );
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
      AutoPane={(p) => <FakeAuto {...p} />}
      ConversationPane={(p) => <FakeConversation {...p} />}
      LearnPane={(p) => <FakeLearn {...p} />}
      HistoryOverlay={(p) => <FakeHistory {...p} />}
      SettingsOverlay={() => <View testID="fake-settings" />}
      MeaningOverlay={() => <View testID="fake-meaning" />}
    />,
  );
  return onHardStop;
}

describe('AppShell tabs and overlays', () => {
  test('keeps Conversation mounted across tab switches (does not wipe state)', async () => {
    await renderShell();

    await fireEvent.press(screen.getByTestId('tab-conversation'));
    await fireEvent.changeText(
      screen.getByTestId('conversation-note'),
      'keep-me',
    );
    await fireEvent.press(screen.getByTestId('tab-auto'));
    // Hidden panes use display:none, so RTL cannot query them — but state remains.
    expect(screen.queryByTestId('conversation-note')).toBeNull();
    expect(screen.getByTestId('auto-input').props.value).toBe('hello-auto');

    await fireEvent.press(screen.getByTestId('tab-conversation'));
    expect(screen.getByTestId('conversation-note').props.value).toBe('keep-me');
  });

  test('invokes hard stop when switching tabs', async () => {
    const onHardStop = await renderShell();
    await fireEvent.press(screen.getByTestId('tab-conversation'));
    expect(onHardStop).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('tab-auto'));
    expect(onHardStop).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByTestId('tab-learn'));
    expect(onHardStop).toHaveBeenCalledTimes(3);
  });

  test('keeps Learn pane state when switching away and back', async () => {
    await renderShell();
    await fireEvent.press(screen.getByTestId('tab-learn'));
    await fireEvent.changeText(screen.getByTestId('learn-mark'), 'keep-lesson');
    await fireEvent.press(screen.getByTestId('tab-auto'));
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
