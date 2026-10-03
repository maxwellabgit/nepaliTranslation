import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CONTRIBUTION_CONSENT_VERSION } from './consent';
import { t, useUiLang } from '../../i18n';
import { useTheme } from '../../theme';

type Props = {
  authConfigured: boolean;
  status: 'initializing' | 'guest' | 'signing-in' | 'signed-in' | 'deleting' | 'error';
  userId: string | null;
  consentVersion: string | null;
  ageConfirmed: boolean;
  deletionRetryPending?: boolean;
  deletionDueAt?: string | null;
  deletionCompletedAt?: string | null;
  onRetryIdentity: () => void;
  onSaveConsent: (ageConfirmed: boolean) => void;
  onDeleteData: () => void;
  speechSharing?: boolean;
  onToggleSpeechSharing?: (enabled: boolean) => void;
  onWithdrawConsent?: () => void;
};

/** Private identity authorizes optional services; it is never presented as an account. */
export function PrivacyDataSection({ authConfigured, status, userId, consentVersion,
  ageConfirmed, deletionRetryPending = false, deletionDueAt = null,
  deletionCompletedAt = null, onRetryIdentity, onSaveConsent, onDeleteData,
  speechSharing = false, onToggleSpeechSharing, onWithdrawConsent }: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const current = consentVersion === CONTRIBUTION_CONSENT_VERSION && ageConfirmed;
  const [age, setAge] = useState(ageConfirmed);
  const [optIn, setOptIn] = useState(current);
  const knownOwner = Boolean(userId);
  const connected = status === 'signed-in' && Boolean(userId);
  const deletionPending = Boolean(deletionDueAt && !deletionCompletedAt);
  const busy = status === 'initializing' || status === 'signing-in' || status === 'deleting';
  const canSave = connected && age && optIn && !current && !deletionPending && !deletionRetryPending;
  useEffect(() => { setAge(ageConfirmed); setOptIn(current); }, [ageConfirmed, current]);
  const styles = useMemo(() => StyleSheet.create({
    section: { marginTop: 20, marginHorizontal: 16, padding: 16, backgroundColor: theme.colors.surface, borderRadius: 16, gap: 10 },
    title: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
    body: { fontSize: 15, lineHeight: 22, color: theme.colors.text },
    meta: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
    choice: { minHeight: 44, justifyContent: 'center' },
    button: { minHeight: 44, borderRadius: 12, backgroundColor: theme.colors.text, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    buttonOff: { opacity: 0.45 },
    buttonText: { color: theme.colors.onPrimary, fontWeight: '700', fontSize: 15 },
    link: { fontSize: 15, fontWeight: '700', color: theme.colors.blue },
    danger: { fontSize: 15, fontWeight: '700', color: theme.colors.danger },
  }), [theme]);
  const confirmWithdraw = () => Alert.alert(t('auth.withdrawConsentTitle', lang), t('auth.withdrawConsentBody', lang), [
    { text: t('common.cancel', lang), style: 'cancel' },
    { text: t('auth.withdrawConsent', lang), style: 'destructive', onPress: () => onWithdrawConsent?.() },
  ]);
  const confirmDelete = () => Alert.alert(t('auth.deleteAccountTitle', lang), t('auth.deleteAccountBody', lang), [
    { text: t('common.cancel', lang), style: 'cancel' },
    { text: t('auth.deleteAccount', lang), style: 'destructive', onPress: onDeleteData },
  ]);
  return <View style={styles.section} testID="privacy-data-section">
    <Text style={styles.title}>{t('privacy.title', lang)}</Text>
    <Text style={styles.body} testID="privacy-installation-warning">{t('privacy.installationWarning', lang)}</Text>
    {!connected && <Text style={styles.meta}>{t('privacy.optionalServicesUnavailable', lang)}</Text>}
    {authConfigured && !connected && <Pressable style={styles.choice} disabled={busy} onPress={onRetryIdentity}
      accessibilityRole="button" accessibilityLabel={t('privacy.retryConnection', lang)} testID="privacy-retry-connection">
      <Text style={styles.link}>{busy ? t('common.loading', lang) : t('privacy.retryConnection', lang)}</Text>
    </Pressable>}
    <Text style={styles.title}>{t('settings.contributionConsent', lang)}</Text>
    <Text style={styles.body} testID="contribution-consent-body">{t('auth.contributionConsentBody', lang)}</Text>
    <Text style={styles.meta}>{t('privacy.consentSeparate', lang)}</Text>
    <Pressable style={styles.choice} onPress={() => setOptIn(value => !value)} disabled={current || deletionPending}
      accessibilityRole="checkbox" accessibilityState={{ checked: optIn }} aria-checked={optIn} accessibilityLabel={t('privacy.modelImprovementOptIn', lang)} testID="model-improvement-opt-in">
      <Text style={styles.body}>{optIn ? '☑' : '☐'} {t('privacy.modelImprovementOptIn', lang)}</Text>
    </Pressable>
    <Pressable style={styles.choice} onPress={() => setAge(value => !value)} disabled={current || deletionPending}
      accessibilityRole="checkbox" accessibilityState={{ checked: age }} aria-checked={age} accessibilityLabel={t('auth.ageConfirm', lang)} testID="age-confirm">
      <Text style={styles.body}>{age ? '☑' : '☐'} {t('auth.ageConfirm', lang)}</Text>
    </Pressable>
    <Pressable style={[styles.button, !canSave && styles.buttonOff]} disabled={!canSave}
      onPress={() => { if (canSave) onSaveConsent(age); }} accessibilityRole="button" accessibilityLabel={t('auth.saveConsent', lang)} testID="save-consent">
      <Text style={styles.buttonText}>{current ? t('auth.consentSaved', lang) : t('auth.saveConsent', lang)}</Text>
    </Pressable>
    <Text style={styles.meta} testID="privacy-audio-disclosure">{t('privacy.audioDisclosure', lang)}</Text>
    <Pressable style={styles.choice} disabled={!current || !connected || deletionPending || deletionRetryPending}
      onPress={() => onToggleSpeechSharing?.(!speechSharing)} accessibilityRole="switch" accessibilityState={{ checked: speechSharing }} aria-checked={speechSharing}
      accessibilityLabel={t('auth.shareSpeech', lang)} testID="share-speech">
      <Text style={styles.body}>{speechSharing ? '☑' : '☐'} {t('auth.shareSpeech', lang)}</Text>
    </Pressable>
    {deletionCompletedAt ? <Text style={styles.meta} testID="deletion-completed-at">{t('auth.deletionComplete', lang)}</Text>
      : deletionDueAt ? <Text style={styles.meta} testID="deletion-due-at">{t('auth.deletionScheduled', lang, { date: new Date(deletionDueAt).toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-US', { dateStyle: 'medium', timeZone: 'America/New_York' }) })}</Text> : null}
    {knownOwner && <>
      <Pressable style={styles.choice} disabled={!consentVersion || deletionPending || deletionRetryPending} onPress={confirmWithdraw} accessibilityRole="button"
        accessibilityLabel={t('auth.withdrawConsent', lang)} testID="withdraw-consent"><Text style={styles.danger}>{t('auth.withdrawConsent', lang)}</Text></Pressable>
      <Pressable style={styles.choice} disabled={status === 'deleting' || deletionPending || deletionRetryPending} onPress={confirmDelete} accessibilityRole="button"
        accessibilityLabel={t('auth.deleteAccount', lang)} testID="delete-shared-data"><Text style={styles.danger}>{t('auth.deleteAccount', lang)}</Text></Pressable>
      {deletionRetryPending && <Pressable style={styles.choice} onPress={onDeleteData} accessibilityRole="button"
        accessibilityLabel={t('auth.retryDeleteA11y', lang)} testID="retry-delete-shared-data"><Text style={styles.link}>{t('common.retry', lang)}</Text></Pressable>}
    </>}
  </View>;
}
