/**
 * AppShell integration test (not production-composition E2E).
 * Uses stand-in panes to prove mounted-state retention, hard-stop on tab
 * switch, overlays, and offline ad policy. Real-screen composition is H1.
 */
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AppShell } from '../AppShell';
import { AdSlot } from '../../features/ads/AdSlot';
import {
  createMockAdAdapter,
  executeAdPlan,
  planAdPlacement,
} from '../../features/ads/adMiddleware';
import type { HistoryItem } from '../../storage/phrasebook';

function AutoPane({
  active,
  onOpenHistory,
  onOpenSettings,
}: {
  active: boolean;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  neuralReady: boolean;
  mtWarmStatus: string | null;
  seed?: HistoryItem | null;
}) {
  const [text, setText] = useState('');
  return (
    <View testID="shell-auto">
      <Text testID="shell-auto-active">{active ? 'on' : 'off'}</Text>
      <TextInput
        testID="shell-auto-input"
        value={text}
        onChangeText={setText}
        accessibilityLabel="Translate input"
      />
      <Pressable testID="shell-open-history" onPress={onOpenHistory}>
        <Text>History</Text>
      </Pressable>
      <Pressable testID="shell-open-settings" onPress={onOpenSettings}>
        <Text>Settings</Text>
      </Pressable>
    </View>
  );
}

function ConversationPane({ active }: { active: boolean; neuralReady: boolean }) {
  const [note, setNote] = useState('thread');
  return (
    <View testID="shell-conversation">
      <Text testID="shell-conversation-active">{active ? 'on' : 'off'}</Text>
      <TextInput
        testID="shell-conversation-note"
        value={note}
        onChangeText={setNote}
        accessibilityLabel="Conversation note"
      />
    </View>
  );
}

function LearnPane({ active }: { active: boolean }) {
  const [pos, setPos] = useState('vowel-0');
  return (
    <View testID="shell-learn">
      <Text testID="shell-learn-active">{active ? 'on' : 'off'}</Text>
      <TextInput
        testID="shell-learn-pos"
        value={pos}
        onChangeText={setPos}
        accessibilityLabel="Lesson position"
      />
    </View>
  );
}

function HistoryOverlay({
  onClose,
}: {
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
}) {
  return (
    <View testID="shell-history">
      <Pressable testID="shell-close-history" onPress={onClose}>
        <Text>Close</Text>
      </Pressable>
    </View>
  );
}

function SettingsOverlay({
  onClose,
}: {
  onClose: () => void;
  onOpenMeaningReview: () => void;
  onOpenContributions: () => void;
  neuralReady: boolean;
}) {
  return (
    <View testID="shell-settings">
      <Pressable testID="shell-close-settings" onPress={onClose}>
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
      AutoPane={(p) => <AutoPane {...p} />}
      ConversationPane={(p) => <ConversationPane {...p} />}
      LearnPane={(p) => <LearnPane {...p} />}
      HistoryOverlay={(p) => <HistoryOverlay {...p} />}
      SettingsOverlay={(p) => <SettingsOverlay {...p} />}
      MeaningOverlay={() => <View testID="shell-meaning" />}
      ContributionsOverlay={() => <View testID="shell-contributions" />}
    />,
  );
  return onHardStop;
}

describe('AppShell integration (mounted panes + offline ads)', () => {
  it('walks Auto → Conversation → Learn without wiping pane state', async () => {
    const hardStop = await renderShell();
    expect(screen.getByTestId('tab-bar')).toBeTruthy();
    expect(screen.getByTestId('shell-auto-active').props.children).toBe('on');

    await fireEvent.changeText(screen.getByTestId('shell-auto-input'), 'hello');
    await fireEvent.press(screen.getByTestId('tab-conversation'));
    expect(hardStop).toHaveBeenCalled();
    await fireEvent.changeText(
      screen.getByTestId('shell-conversation-note'),
      'keep-thread',
    );

    await fireEvent.press(screen.getByTestId('tab-learn'));
    await fireEvent.changeText(screen.getByTestId('shell-learn-pos'), 'cons-3');

    await fireEvent.press(screen.getByTestId('tab-auto'));
    expect(screen.getByTestId('shell-auto-input').props.value).toBe('hello');

    await fireEvent.press(screen.getByTestId('tab-conversation'));
    expect(screen.getByTestId('shell-conversation-note').props.value).toBe(
      'keep-thread',
    );

    await fireEvent.press(screen.getByTestId('tab-learn'));
    expect(screen.getByTestId('shell-learn-pos').props.value).toBe('cons-3');
  });

  it('opens History and Settings overlays then returns to Auto', async () => {
    await renderShell();

    await fireEvent.press(screen.getByTestId('shell-open-history'));
    expect(screen.getByTestId('overlay-history')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('shell-close-history'));
    expect(screen.queryByTestId('overlay-history')).toBeNull();

    await fireEvent.press(screen.getByTestId('shell-open-settings'));
    expect(screen.getByTestId('overlay-settings')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('shell-close-settings'));
    expect(screen.queryByTestId('overlay-settings')).toBeNull();
  });

  it('never issues AdMob network calls for offline house or Conversation', async () => {
    const adapter = createMockAdAdapter();
    await executeAdPlan(
      planAdPlacement({
        surface: 'home',
        networkAdsEnabled: true,
        hasSubscription: false,
        earnedAdFreeUntilMs: null,
        trustedNowMs: 1,
        offline: true,
        bannerUnitId: 'ca-app-pub-test/banner',
      }),
      adapter,
    );
    await executeAdPlan(
      planAdPlacement({
        surface: 'conversation',
        networkAdsEnabled: true,
        hasSubscription: false,
        earnedAdFreeUntilMs: null,
        trustedNowMs: 1,
        offline: false,
        bannerUnitId: 'ca-app-pub-test/banner',
      }),
      adapter,
    );
    expect(adapter.networkCalls()).toEqual([]);

    await render(
      <AdSlot
        surface="history"
        offline
        networkAdsEnabled
        adapter={adapter}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('ad-slot-house-history')).toBeTruthy();
    });
    expect(adapter.networkCalls()).toEqual([]);
  });
});
