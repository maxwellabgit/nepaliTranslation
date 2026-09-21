import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  canSubmitContribution,
  CONTRIBUTION_CONSENT_SUMMARY,
  CONTRIBUTION_CONSENT_VERSION,
} from '../auth/consent';
import { useFeatureFlags } from '../../app/FeatureConfigProvider';
import { loadLocalConsent } from '../../storage/contributionConsent';
import {
  enqueueDraft,
  type ContributionDraft,
  type OutboxSurface,
} from '../../storage/contributionOutbox';
import { buildCorrectionDraftFields } from '../../storage/liveIncorrect';
import { flushPendingDrafts } from '../../services/contributionSync';
import type { Formality, NepaliScript } from '../../mt/onDeviceTranslate';
import { colors } from '../../theme';

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
  onClose,
  onSaved,
  onNeedAuth,
}: Props) {
  const auth = useAuth();
  const flags = useFeatureFlags();
  const [correction, setCorrection] = useState('');
  const [formality, setFormality] = useState<Formality | null>(null);
  const [script, setScript] = useState<NepaliScript | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consentVersion, setConsentVersion] = useState<string | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [draftIdempotencyKey, setDraftIdempotencyKey] = useState<
    string | undefined
  >(undefined);

  useEffect(() => {
    if (!visible) return;
    setMessage(null);
    if (existingDraft) {
      setCorrection(existingDraft.correction_text ?? '');
      setFormality(existingDraft.formality);
      setScript(existingDraft.script);
      setDraftIdempotencyKey(existingDraft.idempotency_key);
    } else {
      setCorrection('');
      setFormality(formalityProp ?? null);
      setScript(scriptProp ?? null);
      setDraftIdempotencyKey(undefined);
    }
    void loadLocalConsent().then((c) => {
      setConsentVersion(c?.consent_version ?? null);
      setAgeConfirmed(Boolean(c?.age_confirmed));
    });
  }, [visible, existingDraft, formalityProp, scriptProp]);

  const labelsMissing = !formality || !script;

  const save = async (wantSubmit: boolean) => {
    if (busy) return;
    if (wantSubmit && labelsMissing) {
      setMessage('Select formality and script before submitting.');
      return;
    }
    const fields = buildCorrectionDraftFields({
      source,
      translation,
      sourceLang,
      formality,
      script,
      surface,
      translationMethod,
      modelVersion,
    });
    if (!fields) {
      setMessage('Nothing to save.');
      return;
    }
    setBusy(true);
    try {
      const gate = canSubmitContribution({
        authConfigured: auth.authConfigured,
        signedIn: auth.status === 'signed-in',
        consentVersion,
        ageConfirmed,
      });
      const contributionsOn = flags.contributionsEnabled;
      let status: 'draft' | 'queued' = 'draft';
      let note: string | null = null;
      let needAuth = false;

      if (wantSubmit) {
        if (labelsMissing) {
          setMessage('Select formality and script before submitting.');
          return;
        }
        if (!contributionsOn) {
          note =
            'Saved on this device. Contribution upload is off until review finishes.';
        } else if (!gate.ok) {
          needAuth = true;
          note =
            gate.reason === 'sign_in'
              ? 'Saved on this device. Sign in with Apple to submit, then tap Submit contribution again.'
              : gate.reason === 'consent' || gate.reason === 'age'
                ? 'Saved on this device. Save contribution consent in Settings, then tap Submit contribution again.'
                : 'Saved on this device. Upload is unavailable right now.';
        } else {
          status = 'queued';
        }
      }

      const draft = await enqueueDraft({
        ...fields,
        idempotency_key: draftIdempotencyKey,
        correction_text: correction.trim() || null,
        formality,
        script,
        consent_version:
          status === 'queued' ? CONTRIBUTION_CONSENT_VERSION : consentVersion,
        status,
      });
      setDraftIdempotencyKey(draft.idempotency_key);

      if (status === 'queued') {
        void flushPendingDrafts();
        setMessage('Queued for upload when online.');
        onSaved?.();
        onClose();
      } else {
        setMessage(note ?? 'Draft saved on this device.');
        onSaved?.();
        if (!wantSubmit) {
          onClose();
        } else if (needAuth) {
          onNeedAuth?.();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="correction-sheet">
          <Text style={styles.title}>Suggest a better translation</Text>
          <Text style={styles.label}>Source</Text>
          <Text style={styles.body}>{source}</Text>
          <Text style={styles.label}>Current translation</Text>
          <Text style={styles.body}>{translation}</Text>
          <Text style={styles.label}>Your correction (optional)</Text>
          <TextInput
            style={styles.input}
            value={correction}
            onChangeText={setCorrection}
            placeholder="Type a better translation"
            placeholderTextColor={colors.textPlaceholder}
            multiline
            testID="correction-input"
          />
          {labelsMissing ? (
            <View testID="correction-label-pickers">
              <Text style={styles.label}>Formality (required to submit)</Text>
              <View style={styles.chipRow}>
                <Pressable
                  style={[
                    styles.chip,
                    formality === 'formal' && styles.chipOn,
                  ]}
                  onPress={() => setFormality('formal')}
                  testID="correction-formality-formal"
                  accessibilityRole="button"
                  accessibilityLabel="Formal"
                >
                  <Text
                    style={[
                      styles.chipText,
                      formality === 'formal' && styles.chipTextOn,
                    ]}
                  >
                    Formal
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
                  accessibilityLabel="Informal"
                >
                  <Text
                    style={[
                      styles.chipText,
                      formality === 'informal' && styles.chipTextOn,
                    ]}
                  >
                    Informal
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.label}>Script (required to submit)</Text>
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.chip, script === 'deva' && styles.chipOn]}
                  onPress={() => setScript('deva')}
                  testID="correction-script-deva"
                  accessibilityRole="button"
                  accessibilityLabel="Devanagari"
                >
                  <Text
                    style={[
                      styles.chipText,
                      script === 'deva' && styles.chipTextOn,
                    ]}
                  >
                    Devanagari
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.chip, script === 'roman' && styles.chipOn]}
                  onPress={() => setScript('roman')}
                  testID="correction-script-roman"
                  accessibilityRole="button"
                  accessibilityLabel="Roman"
                >
                  <Text
                    style={[
                      styles.chipText,
                      script === 'roman' && styles.chipTextOn,
                    ]}
                  >
                    Roman
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.meta} testID="correction-labels-set">
              {formality === 'formal' ? 'Formal' : 'Informal'} ·{' '}
              {script === 'deva' ? 'Devanagari' : 'Roman'}
            </Text>
          )}
          <Text style={styles.meta}>{CONTRIBUTION_CONSENT_SUMMARY}</Text>
          {message ? <Text style={styles.note}>{message}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel correction"
              testID="correction-cancel"
            >
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.buttonSecondary}
              onPress={() => void save(false)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Save on this device"
              testID="correction-save-draft"
            >
              <Text style={styles.buttonSecondaryText}>Save on this device</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() => void save(true)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Submit contribution"
              testID="correction-submit"
            >
              <Text style={styles.buttonText}>Submit contribution</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 8,
    maxHeight: '88%',
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  label: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  body: { fontSize: 16, color: colors.text, lineHeight: 22 },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  meta: { fontSize: 12, color: colors.textPlaceholder, lineHeight: 18 },
  note: { fontSize: 14, color: colors.blue, lineHeight: 20 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  chipOn: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  chipTextOn: { color: '#fff' },
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
    color: colors.textSecondary,
    minHeight: 44,
    textAlignVertical: 'center',
  },
  button: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.text,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  buttonSecondary: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  buttonSecondaryText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
});
