import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthProvider';
import { t, useUiLang } from '../../i18n';
import { useTheme } from '../../theme';
import { supportRpc, type SupportRequest } from './supportApi';

export function SupportSection({ category }: { category: 'general' | 'ad' }) {
  const auth = useAuth(); const lang = useUiLang(); const theme = useTheme();
  const owner = auth.userId;
  const [message, setMessage] = useState(''); const [allowed, setAllowed] = useState(false);
  const [requests, setRequests] = useState<SupportRequest[]>([]); const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'saved' | 'error' | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const generation = useRef(0); const nonce = useRef(Crypto.randomUUID());
  const listSequence = useRef(0);
  const draftWrites = useRef(Promise.resolve());
  const draftKey = owner ? `bola.support.draft.v1:${owner}:${category}` : null;
  useEffect(() => {
    const current = ++generation.current;
    const sequence = ++listSequence.current;
    setMessage(''); setAllowed(false); setRequests([]); setStatus(null); setBusy(false); setDraftReady(false); nonce.current = Crypto.randomUUID();
    if (draftKey) void draftWrites.current.then(() => AsyncStorage.getItem(draftKey)).then(value => {
      if (current === generation.current && value) { const draft = JSON.parse(value) as { message?: unknown; nonce?: unknown };
        if (typeof draft.message === 'string') setMessage(draft.message.slice(0, 2000));
        if (typeof draft.nonce === 'string') nonce.current = draft.nonce;
      }
    }).catch(() => undefined).finally(() => { if (current === generation.current) setDraftReady(true); });
    else setDraftReady(true);
    if (owner) void supportRpc<SupportRequest[]>(owner, 'support_list').then(value => { if (current === generation.current && sequence === listSequence.current) setRequests(value); }).catch(() => undefined);
    return () => { generation.current = current + 1; };
  }, [owner, draftKey]);
  const persist = (text: string) => {
    if (text !== message) nonce.current = Crypto.randomUUID();
    setMessage(text); setStatus(null);
    if (draftKey) { const value = JSON.stringify({ message: text, nonce: nonce.current });
      draftWrites.current = draftWrites.current.catch(() => undefined).then(() => AsyncStorage.setItem(draftKey, value));
    }
  };
  async function send() {
    if (!owner || !draftReady || busy || !allowed || !message.trim()) return;
    const current = generation.current; const text = message.trim(); const id = nonce.current;
    listSequence.current++;
    setBusy(true); setStatus(null);
    try {
      await supportRpc(owner, 'support_submit', { p_client_id: id, p_message: text, p_category: category, p_app_version: Constants.expoConfig?.version ?? '1.7.0' });
      if (current !== generation.current) return;
      await draftWrites.current.catch(() => undefined);
      if (draftKey) await AsyncStorage.removeItem(draftKey).catch(() => undefined);
      if (current !== generation.current) return;
      setMessage(''); nonce.current = Crypto.randomUUID(); setAllowed(false); setStatus('saved');
      const sequence = ++listSequence.current;
      const refreshed = await supportRpc<SupportRequest[]>(owner, 'support_list').catch(() => null);
      if (current === generation.current && sequence === listSequence.current && refreshed) setRequests(refreshed);
    } catch { if (current === generation.current) setStatus('error'); }
    finally { if (current === generation.current) setBusy(false); }
  }
  function remove(id: string) {
    Alert.alert(t('support.deleteTitle', lang), t('support.deleteBody', lang), [
      { text: t('common.cancel', lang), style: 'cancel' },
      { text: t('common.delete', lang), style: 'destructive', onPress: () => {
        if (!owner || busy) return; const current = generation.current; listSequence.current++; setBusy(true);
        void supportRpc(owner, 'support_delete', { p_id: id }).then(() => { if (current === generation.current) setRequests(rows => rows.filter(row => row.id !== id)); })
          .catch(() => { if (current === generation.current) setStatus('error'); }).finally(() => { if (current === generation.current) setBusy(false); });
      } },
    ]);
  }
  return <View testID="support-section" style={[styles.section, { backgroundColor: theme.colors.surface }]}>
    <Text style={[styles.title, { color: theme.colors.text }]}>{t('support.title', lang)}</Text>
    <Text style={{ color: theme.colors.text }}>{t('support.disclosure', lang)}</Text>
    {!owner && <Text style={{ color: theme.colors.text }}>{t('support.connect', lang)}</Text>}
    <TextInput testID="support-message" multiline editable={draftReady && !busy && Boolean(owner)} maxLength={2000} value={message} onChangeText={persist}
      placeholder={t('support.placeholder', lang)} accessibilityLabel={t('support.placeholder', lang)}
      style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.divider }]} />
    <Pressable disabled={busy} accessibilityRole="checkbox" accessibilityState={{ checked: allowed }} onPress={() => setAllowed(value => !value)} testID="support-opt-in">
      <Text style={{ color: theme.colors.text }}>{allowed ? '☑ ' : '☐ '}{t('support.sendConsent', lang)}</Text>
    </Pressable>
    <Pressable disabled={busy || !draftReady || !owner || !allowed || !message.trim()} accessibilityRole="button" onPress={() => void send()} testID="support-send" style={styles.action}>
      <Text style={{ color: theme.colors.forest }}>{t(busy ? 'common.loading' : 'support.send', lang)}</Text>
    </Pressable>
    <Pressable testID="support-refresh" disabled={busy || !owner} accessibilityRole="button" onPress={() => {
      if (!owner) return; const current = generation.current; const sequence = ++listSequence.current; setBusy(true);
      void supportRpc<SupportRequest[]>(owner, 'support_list').then(value => { if (current === generation.current && sequence === listSequence.current) setRequests(value); })
        .catch(() => { if (current === generation.current) setStatus('error'); }).finally(() => { if (current === generation.current) setBusy(false); });
    }} style={styles.action}><Text style={{ color: theme.colors.forest }}>{t('support.refresh', lang)}</Text></Pressable>
    {status && <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{t(status === 'saved' ? 'support.saved' : 'support.error', lang)}</Text>}
    {requests.map(row => <View key={row.id} style={styles.request}>
      <Text style={{ color: theme.colors.text }}>{row.message}</Text>
      <Text style={{ color: theme.colors.text }}>{row.reply ?? t('support.awaiting', lang)}</Text>
      <Pressable testID={`support-delete-${row.id}`} disabled={busy} accessibilityRole="button" onPress={() => remove(row.id)} style={styles.action}><Text style={{ color: theme.colors.forest }}>{t('common.delete', lang)}</Text></Pressable>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({ section: { marginHorizontal: 16, padding: 20, borderRadius: 18, gap: 12 }, title: { fontSize: 22 }, input: { minHeight: 100, fontSize: 22, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' }, action: { minHeight: 44, justifyContent: 'center' }, request: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 10 } });
