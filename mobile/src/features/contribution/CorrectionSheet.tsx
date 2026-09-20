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
import { DEFAULT_FEATURE_FLAGS } from '../../app/featureFlags';
import {
  loadLocalConsent,
} from '../../storage/contributionConsent';
import {
  enqueueDraft,
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
  formality: Formality;
  script: NepaliScript;
  surface: OutboxSurface;
  onClose: () => void;
  onSaved?: () => void;
};

export function CorrectionSheet({
  visible,
  source,
  translation,
  sourceLang,
  formality,
  script,
  surface,
  onClose,
  onSaved,
}: Props) {
  const auth = useAuth();
  const [correction, setCorrection] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consentVersion, setConsentVersion] = useState<string | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCorrection('');
    setMessage(null);
    void loadLocalConsent().then((c) => {
      setConsentVersion(c?.consent_version ?? null);
      setAgeConfirmed(Boolean(c?.age_confirmed));
    });
  }, [visible]);

  const save = async (wantSubmit: boolean) => {
    if (busy) return;
    const fields = buildCorrectionDraftFields({
      source,
      translation,
      sourceLang,
      formality,
      script,
      surface,
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
      const contributionsOn = DEFAULT_FEATURE_FLAGS.contributionsEnabled;
      let status: 'draft' | 'pending' = 'draft';
      let note: string | null = null;

      if (wantSubmit) {
        if (!contributionsOn) {
          note =
            'Saved on this device. Contribution upload is off until review finishes.';
        } else if (!gate.ok) {
          note =
            gate.reason === 'sign_in'
              ? 'Saved on this device. Sign in with Apple in Settings to upload.'
              : gate.reason === 'consent' || gate.reason === 'age'
                ? 'Saved on this device. Save contribution consent in Settings to upload.'
                : 'Saved on this device. Upload is unavailable right now.';
        } else {
          status = 'pending';
        }
      }

      await enqueueDraft({
        ...fields,
        correction_text: correction.trim() || null,
        consent_version:
          status === 'pending' ? CONTRIBUTION_CONSENT_VERSION : consentVersion,
        status,
      });

      if (status === 'pending') {
        void flushPendingDrafts();
        setMessage('Queued for upload when online.');
      } else {
        setMessage(note ?? 'Draft saved on this device.');
      }
      onSaved?.();
      if (status === 'pending' || !wantSubmit) {
        onClose();
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
              style={styles.button}
              onPress={() => void save(false)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Save correction draft"
              testID="correction-save-draft"
            >
              <Text style={styles.buttonText}>Save draft</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() => void save(true)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Submit correction"
              testID="correction-submit"
            >
              <Text style={styles.buttonText}>Submit</Text>
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  link: { fontSize: 15, fontWeight: '700', color: colors.textSecondary, minHeight: 44, textAlignVertical: 'center' },
  button: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.text,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
