import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { t, useUiLang } from '../../i18n';
import type { ContributionDraft, OutboxSurface } from '../../storage/contributionOutbox';
import { updateHistoryTranslation } from '../../storage/phrasebook';
import type { Formality, NepaliScript } from '../../mt/onDeviceTranslate';
import { useTheme } from '../../theme';

type Props = {
  visible: boolean; source: string; translation: string; sourceLang: 'en' | 'ne';
  formality?: Formality | null; script?: NepaliScript | null; surface: OutboxSurface;
  translationMethod?: string | null; modelVersion?: string | null;
  existingDraft?: ContributionDraft | null; historyItemId?: string | null;
  onClose: () => void; onSaved?: (text: string) => void; onNeedAuth?: () => void;
};

/** Shared local editor. Language/register/script stay attached to the original row. */
export function CorrectionSheet({ visible, source, translation, existingDraft = null, historyItemId = null, onClose, onSaved }: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const [correction, setCorrection] = useState(translation);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    if (!visible) return;
    setCorrection(existingDraft?.correction_text ?? translation);
    setMessage(null);
  }, [visible, translation, historyItemId, existingDraft]);

  const styles = useMemo(() => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: theme.colors.surface, borderRadius: 20, borderWidth: 2, borderColor: '#C4922A', padding: 20, gap: 12, maxHeight: '88%' },
    title: { fontSize: 22, fontWeight: '400', color: theme.colors.text },
    label: { fontSize: 14, fontWeight: '400', color: theme.colors.textSecondary, marginBottom: 4 },
    body: { fontSize: 22, fontWeight: '400', color: theme.colors.text, lineHeight: 29, marginBottom: 12 },
    input: { minHeight: 112, borderWidth: 1, borderColor: '#C4922A', borderRadius: 12, padding: 12, fontSize: 22, fontWeight: '400', lineHeight: 29, color: theme.colors.text, textAlignVertical: 'top' },
    note: { fontSize: 14, color: theme.colors.errorText, lineHeight: 20 },
    actions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', alignItems: 'center' },
    button: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#C4922A', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
    save: { backgroundColor: theme.colors.forest },
    buttonText: { fontSize: 16, fontWeight: '400', color: theme.colors.text },
    saveText: { color: '#FFFFFF' },
  }), [theme]);

  const dismiss = () => { if (!saving.current) onClose(); };
  const save = async () => {
    if (saving.current) return;
    const text = correction.trim();
    if (!text) { setMessage(t('history.editNeedsText', lang)); return; }
    if (!historyItemId) { setMessage(t('history.editMissing', lang)); return; }
    saving.current = true;
    setBusy(true);
    try {
      const updated = await updateHistoryTranslation(historyItemId, text);
      if (!updated) { setMessage(t('history.editMissing', lang)); return; }
      onSaved?.(text);
      onClose();
    } catch { setMessage(t('history.editFailed', lang)); }
    finally { saving.current = false; setBusy(false); }
  };

  return <Modal visible={visible} animationType="slide" transparent onRequestClose={dismiss}>
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} disabled={busy} accessibilityRole="button" accessibilityLabel={t('common.dismiss', lang)} testID="correction-backdrop" />
      <View style={styles.sheet} accessibilityViewIsModal testID="correction-sheet">
        <Text style={styles.title}>{t('contributions.correctionTitle', lang)}</Text>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>{t('contributions.sourceLabel', lang)}</Text>
          <Text style={styles.body}>{source}</Text>
          <Text style={styles.label}>{t('contributions.yourCorrection', lang)}</Text>
          <TextInput style={styles.input} value={correction} onChangeText={setCorrection} editable={!busy}
            accessibilityLabel={t('contributions.yourCorrection', lang)} placeholder={t('contributions.correctionPlaceholder', lang)}
            placeholderTextColor={theme.colors.textPlaceholder} multiline testID="correction-input" />
        </ScrollView>
        {message ? <Text style={styles.note} accessibilityRole="alert">{message}</Text> : null}
        <View style={styles.actions} testID="correction-actions">
          <Pressable style={styles.button} onPress={dismiss} disabled={busy} accessibilityRole="button" accessibilityLabel={t('contributions.cancelA11y', lang)} testID="correction-cancel">
            <Text style={styles.buttonText}>{t('contributions.cancel', lang)}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.save]} onPress={() => void save()} disabled={busy} accessibilityRole="button" accessibilityLabel={t('contributions.saveDeviceA11y', lang)} testID="correction-save-draft">
            <Text style={[styles.buttonText, styles.saveText]}>{t('contributions.saveDevice', lang)}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
