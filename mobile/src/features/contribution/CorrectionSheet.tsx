import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { t, useUiLang } from '../../i18n';
import {
  type ContributionDraft,
  type OutboxSurface,
} from '../../storage/contributionOutbox';
import { updateHistoryTranslation } from '../../storage/phrasebook';
import type { Formality, NepaliScript } from '../../mt/onDeviceTranslate';
import { useTheme } from '../../theme';

type Props = {
  visible: boolean;
  source: string;
  translation: string;
  sourceLang: 'en' | 'ne';
  formality?: Formality | null;
  script?: NepaliScript | null;
  surface: OutboxSurface;
  translationMethod?: string | null;
  modelVersion?: string | null;
  /** Resume an existing draft after the auth gate. */
  existingDraft?: ContributionDraft | null;
  /** When set, Save updates this local history row and never creates a public review. */
  historyItemId?: string | null;
  onClose: () => void;
  onSaved?: () => void;
  onNeedAuth?: () => void;
};

export function CorrectionSheet({
  visible,
  source,
  translation,
  sourceLang,
  formality: formalityProp = null,
  script: scriptProp = null,
  surface,
  translationMethod = null,
  modelVersion = null,
  existingDraft = null,
  historyItemId = null,
  onClose,
  onSaved,
  onNeedAuth,
}: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const [correction, setCorrection] = useState(
    existingDraft?.correction_text ?? '',
  );
  const [formality, setFormality] = useState<Formality | null>(
    existingDraft?.formality ?? formalityProp ?? null,
  );
  const [script, setScript] = useState<NepaliScript | null>(
    existingDraft?.script ?? scriptProp ?? null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          gap: 8,
          maxHeight: '88%',
        },
        title: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
        label: {
          marginTop: 8,
          fontSize: 12,
          fontWeight: '700',
          color: theme.colors.textSecondary,
          textTransform: 'uppercase',
        },
        body: { fontSize: 16, color: theme.colors.text, lineHeight: 22 },
        input: {
          minHeight: 72,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          borderRadius: 12,
          padding: 12,
          fontSize: 16,
          color: theme.colors.text,
          textAlignVertical: 'top',
        },
        meta: {
          fontSize: 12,
          color: theme.colors.textPlaceholder,
          lineHeight: 18,
        },
        note: { fontSize: 14, color: theme.colors.blue, lineHeight: 20 },
        chipRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
        chip: {
          minHeight: 40,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.bg,
        },
        chipOn: {
          backgroundColor: theme.colors.text,
          borderColor: theme.colors.text,
        },
        chipText: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.text,
        },
        chipTextOn: { color: theme.colors.onPrimary },
        actions: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: 10,
          marginTop: 8,
        },
        link: {
          fontSize: 15,
          fontWeight: '700',
          color: theme.colors.textSecondary,
          minHeight: 44,
          textAlignVertical: 'center',
        },
        button: {
          minHeight: 44,
          borderRadius: 12,
          backgroundColor: theme.colors.text,
          paddingHorizontal: 14,
          alignItems: 'center',
          justifyContent: 'center',
        },
        buttonText: {
          color: theme.colors.onPrimary,
          fontWeight: '700',
          fontSize: 14,
        },
        buttonSecondary: {
          minHeight: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          paddingHorizontal: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.bg,
        },
        buttonSecondaryText: {
          color: theme.colors.text,
          fontWeight: '700',
          fontSize: 14,
        },
      }),
    [theme],
  );

  const labelsMissing = !formality || !script;

  const save = async () => {
    if (busy) return;
    const text = correction.trim();
    if (!text) {
      setMessage(t('history.editNeedsText', lang));
      return;
    }
    if (!historyItemId) {
      setMessage(t('history.editMissing', lang));
      return;
    }
    setBusy(true);
    try {
      const updated = await updateHistoryTranslation(historyItemId, text);
      if (!updated) {
        setMessage(t('history.editMissing', lang));
        return;
      }
      setMessage(t('history.editSaved', lang));
      onSaved?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const formalLabel = t('contributions.formal', lang);
  const informalLabel = t('contributions.informal', lang);
  const devaLabel = t('contributions.deva', lang);
  const romanLabel = t('contributions.roman', lang);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="correction-sheet">
          <Text style={styles.title}>
            {t('contributions.correctionTitle', lang)}
          </Text>
          <Text style={styles.label}>{t('contributions.sourceLabel', lang)}</Text>
          <Text style={styles.body}>{source}</Text>
          <Text style={styles.label}>
            {t('contributions.currentLabel', lang)}
          </Text>
          <Text style={styles.body}>{translation}</Text>
          <Text style={styles.label}>
            {t('contributions.yourCorrection', lang)}
          </Text>
          <TextInput
            style={styles.input}
            value={correction}
            onChangeText={setCorrection}
            placeholder={t('contributions.correctionPlaceholder', lang)}
            placeholderTextColor={theme.colors.textPlaceholder}
            multiline
            testID="correction-input"
          />
          {labelsMissing ? (
            <View testID="correction-label-pickers">
              <Text style={styles.label}>
                {t('contributions.formalityRequired', lang)}
              </Text>
              <View style={styles.chipRow}>
                <Pressable
                  style={[
                    styles.chip,
                    formality === 'formal' && styles.chipOn,
                  ]}
                  onPress={() => setFormality('formal')}
                  testID="correction-formality-formal"
                  accessibilityRole="button"
                  accessibilityLabel={formalLabel}
                >
                  <Text
                    style={[
                      styles.chipText,
                      formality === 'formal' && styles.chipTextOn,
                    ]}
                  >
                    {formalLabel}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chip,
                    formality === 'informal' && styles.chipOn,
                  ]}
                  onPress={() => setFormality('informal')}
                  testID="correction-formality-informal"
                  accessibilityRole="button"
                  accessibilityLabel={informalLabel}
                >
                  <Text
                    style={[
                      styles.chipText,
                      formality === 'informal' && styles.chipTextOn,
                    ]}
                  >
                    {informalLabel}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.label}>
                {t('contributions.scriptRequired', lang)}
              </Text>
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.chip, script === 'deva' && styles.chipOn]}
                  onPress={() => setScript('deva')}
                  testID="correction-script-deva"
                  accessibilityRole="button"
                  accessibilityLabel={devaLabel}
                >
                  <Text
                    style={[
                      styles.chipText,
                      script === 'deva' && styles.chipTextOn,
                    ]}
                  >
                    {devaLabel}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.chip, script === 'roman' && styles.chipOn]}
                  onPress={() => setScript('roman')}
                  testID="correction-script-roman"
                  accessibilityRole="button"
                  accessibilityLabel={romanLabel}
                >
                  <Text
                    style={[
                      styles.chipText,
                      script === 'roman' && styles.chipTextOn,
                    ]}
                  >
                    {romanLabel}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.meta} testID="correction-labels-set">
              {formality === 'formal' ? formalLabel : informalLabel} ·{' '}
              {script === 'deva' ? devaLabel : romanLabel}
            </Text>
          )}
          <Text style={styles.meta}>{t('history.editSaved', lang)}</Text>
          {message ? <Text style={styles.note}>{message}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('contributions.cancelA11y', lang)}
              testID="correction-cancel"
            >
              <Text style={styles.link}>
                {t('contributions.cancel', lang)}
              </Text>
            </Pressable>
            <Pressable
              style={styles.buttonSecondary}
              onPress={() => void save()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t('contributions.saveDeviceA11y', lang)}
              testID="correction-save-draft"
            >
              <Text style={styles.buttonSecondaryText}>
                {t('contributions.saveDevice', lang)}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
