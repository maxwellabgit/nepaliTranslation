import { render, screen } from '@testing-library/react-native';
import { EmptyState } from '../../components/EmptyState';
import { StatusBanner } from '../../components/StatusBanner';
import { ThemeProvider } from '../../theme';

describe('EmptyState / StatusBanner', () => {
  test('EmptyState renders default and kind testIDs', async () => {
    const view = await render(
      <ThemeProvider scheme="light">
        <EmptyState title="Nothing" detail="Yet" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByTestId('empty-state-title').props.children).toBe(
      'Nothing',
    );
    expect(screen.getByTestId('empty-state-detail').props.children).toBe('Yet');

    await view.rerender(
      <ThemeProvider scheme="light">
        <EmptyState kind="loading" title="Loading" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('empty-state-loading')).toBeTruthy();
    expect(screen.getByTestId('empty-state-spinner')).toBeTruthy();

    await view.rerender(
      <ThemeProvider scheme="dark">
        <EmptyState kind="error" title="Failed" testID="custom-error" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('custom-error')).toBeTruthy();
    expect(screen.getByTestId('custom-error-title').props.children).toBe(
      'Failed',
    );

    await view.rerender(
      <ThemeProvider scheme="light">
        <EmptyState kind="offline" title="Offline" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('empty-state-offline')).toBeTruthy();
  });

  test('StatusBanner renders message testID for offline tone', async () => {
    await render(
      <ThemeProvider scheme="light">
        <StatusBanner
          tone="offline"
          message="Network down"
          testID="status-banner"
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('status-banner')).toBeTruthy();
    expect(screen.getByTestId('status-banner-message').props.children).toBe(
      'Network down',
    );
  });
});
