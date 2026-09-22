import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { t, useUiLang } from '../../i18n';
import { useTheme } from '../../theme';
import { useSubscription } from './SubscriptionProvider';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Bilingual ad-free paywall. Price comes from StoreKit/RC when available;
 * never invents a hard-coded checkout amount as authoritative.
 */
export function PaywallSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const sub = useSubscription();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const priceLabel =
    sub.priceString ?? t('paywall.priceFallback', lang);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          gap: 12,
          paddingBottom: 28,
        },
        title: {
          fontSize: 20,
          fontWeight: '800',
          color: theme.colors.text,
        },
        body: {
          fontSize: 15,
          lineHeight: 22,
          color: theme.colors.textSecondary,
        },
        price: {
          fontSize: 28,
          fontWeight: '800',
          color: theme.colors.crimson,
        },
        status: { fontSize: 13, color: theme.colors.textSecondary },
        row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
        btn: {
          flexGrow: 1,
          minHeight: 44,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 14,
          backgroundColor: theme.colors.crimson,
        },
        btnSecondary: {
          backgroundColor: theme.colors.bg,
          borderWidth: 1,
          borderColor: theme.colors.divider,
        },
        btnText: { color: theme.colors.onPrimary, fontWeight: '700' },
        btnTextSecondary: { color: theme.colors.text, fontWeight: '700' },
      }),
    [theme],
  );

  if (!sub.paywallEnabled) return null;

  const statusCopy =
    sub.snapshot.status === 'billing_retry'
      ? t('paywall.billingRetry', lang)
      : sub.hasSubscription()
        ? t('paywall.active', lang)
        : sub.snapshot.status === 'expired' ||
            sub.snapshot.status === 'cancelled'
          ? t('paywall.expired', lang)
          : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop} testID="paywall-sheet">
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('paywall.title', lang)}</Text>
          <Text style={styles.body}>{t('paywall.body', lang)}</Text>
          <Text style={styles.price} testID="paywall-price">
            {priceLabel}
          </Text>
          {statusCopy ? (
            <Text style={styles.status} testID="paywall-status">
              {statusCopy}
            </Text>
          ) : null}
          {message ? (
            <Text style={styles.status} testID="paywall-message">
              {message}
            </Text>
          ) : null}
          {busy ? <ActivityIndicator /> : null}
          <View style={styles.row}>
            <Pressable
              style={styles.btn}
              disabled={busy || sub.hasSubscription()}
              accessibilityRole="button"
              accessibilityLabel={t('paywall.subscribeA11y', lang)}
              testID="paywall-subscribe"
              onPress={() => {
                setBusy(true);
                setMessage(null);
                void sub.purchase().then((r) => {
                  setBusy(false);
                  if (!r.ok) {
                    setMessage(t('paywall.unavailable', lang));
                    return;
                  }
                  onClose();
                });
              }}
            >
              <Text style={styles.btnText}>{t('paywall.subscribe', lang)}</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t('paywall.restoreA11y', lang)}
              testID="paywall-restore"
              onPress={() => {
                setBusy(true);
                setMessage(null);
                void sub.restore().then((r) => {
                  setBusy(false);
                  if (!r.ok) {
                    setMessage(t('paywall.restoreEmpty', lang));
                    return;
                  }
                  onClose();
                });
              }}
            >
              <Text style={styles.btnTextSecondary}>
                {t('paywall.restore', lang)}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t('paywall.manageA11y', lang)}
              testID="paywall-manage"
              onPress={() => {
                void sub.manage();
              }}
            >
              <Text style={styles.btnTextSecondary}>
                {t('paywall.manage', lang)}
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            testID="paywall-close"
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={styles.btnTextSecondary}>{t('common.close', lang)}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
