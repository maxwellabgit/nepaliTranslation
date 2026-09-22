import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '../theme';
import { readBuildProvenance } from '../config/buildProvenance';
import type { FeatureFlags } from '../app/featureFlags';

/**
 * R0 build-provenance surface. Renders under Settings → About so a device
 * tester can quote the exact identity of the build in `DEVICE_PROOF.md`
 * without opening the developer tools.
 *
 * Contains no secret material. Flag values are booleans only.
 */
type Props = {
  flags?: Partial<FeatureFlags>;
};

export function BuildProvenanceCard({ flags }: Props) {
  const theme = useTheme();
  const provenance = useMemo(() => readBuildProvenance(), []);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginTop: theme.spacing.sm,
          padding: theme.spacing.sm,
          borderRadius: theme.radii.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
          gap: 2,
        },
        row: {
          fontSize: 12,
          color: theme.colors.textSecondary,
          fontFamily: undefined,
        },
        rowMono: {
          fontSize: 12,
          color: theme.colors.textSecondary,
          fontFamily: 'Menlo',
        },
        label: {
          fontSize: 12,
          fontWeight: '700',
          color: theme.colors.text,
          marginTop: 4,
        },
      }),
    [theme],
  );

  const flagRows = flags
    ? Object.keys(flags)
        .sort()
        .map((key) => `${key}=${String(flags[key as keyof FeatureFlags])}`)
    : [];

  return (
    <View style={styles.wrap} testID="build-provenance">
      <Text style={styles.rowMono} testID="build-provenance-version">
        v{provenance.appVersion}
        {provenance.buildNumber ? ` (${provenance.buildNumber})` : ''}
      </Text>
      <Text style={styles.rowMono} testID="build-provenance-git">
        git: {provenance.gitShaShort || 'unknown'}
      </Text>
      <Text style={styles.rowMono} testID="build-provenance-channel">
        channel: {provenance.releaseChannel} · ads: {provenance.adsEnv}
      </Text>
      <Text style={styles.rowMono} testID="build-provenance-model">
        model: {provenance.modelFamily}
      </Text>
      <Text style={styles.rowMono}>
        en-indic: {provenance.modelEnIndicRevisionShort || '?'}
        {'  '}indic-en: {provenance.modelIndicEnRevisionShort || '?'}
      </Text>
      {flagRows.length > 0 ? (
        <>
          <Text style={styles.label}>feature flags</Text>
          {flagRows.map((row) => (
            <Text
              key={row}
              style={styles.rowMono}
              testID={`build-provenance-flag-${row.split('=')[0]}`}
            >
              {row}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}
