import { useCallback, useRef, useState } from "react";
import { Alert, FlatList, Linking, RefreshControl } from "react-native";
import { apiFetch } from "../api/client";
import { isNetworkError } from "../api/network";
import { useAuth } from "../auth/context";
import {
  Banner,
  BrandMark,
  Button,
  Card,
  EmptyState,
  OfflineBanner,
  ScreenHeader,
  ScreenLayout,
  Spacer,
  StatusPill,
  Surface,
  Text,
  Touchable,
  useTheme,
} from "../design-system";
import { makeCoalescer } from "../hooks/coalesce";
import { withTimeout } from "../hooks/with-timeout";
import { usePolling } from "../hooks/use-polling";
import { strings } from "../i18n";
import { clearAssigned, loadAssigned, replaceAssigned, type AssignedOrder } from "../offline/assigned-cache";
import { enqueueDeliver, flushQueue } from "../offline/command-queue";
import { makeDeliverSender } from "../offline/deliver-sender";
import { sqliteCommandStore } from "../offline/sqlite-command-store";

const POLL_MS = 30_000;
const s = strings.staffApp;

export function DeliveryQueueScreen() {
  const theme = useTheme();
  const { logout } = useAuth();
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [offline, setOffline] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const cancelled = useRef(false);

  const run = useCallback(async () => {
    if (cancelled.current) return;
    try {
      const report = await flushQueue(sqliteCommandStore, makeDeliverSender(apiFetch));
      for (const c of report.conflicts) {
        const address = ordersRef.current.find((o) => o.id === c.orderId)?.deliveryAddress ?? c.orderId;
        Alert.alert(s.conflictTitle, `${address}\n${c.reason}`);
      }
      let nextNotice = report.unauthorized ? s.sessionExpired : null;
      try {
        const res = await apiFetch("/api/mobile/orders/assigned");
        if (res.ok) {
          const data = (await res.json()) as { orders: AssignedOrder[] };
          if (cancelled.current) return;
          await replaceAssigned(data.orders);
          setOrders(data.orders);
          setOffline(false);
        } else {
          nextNotice = res.status === 401 ? s.sessionExpired : s.serverError;
          setOrders(await loadAssigned());
        }
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        setOrders(await loadAssigned());
        setOffline(true);
      }
      setPendingIds(new Set((await sqliteCommandStore.list()).map((c) => c.orderId)));
      setNotice(nextNotice);
    } catch {
      setNotice(s.serverError);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Nunca dos corridas a la vez; un pedido durante una corrida agenda exactamente una repetición.
  const [runner] = useState(() => makeCoalescer(run));
  const refresh = runner.call;

  usePolling(refresh, POLL_MS);

  const pullToRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const deliver = async (orderId: string) => {
    try {
      await enqueueDeliver(sqliteCommandStore, orderId);
    } catch {
      setNotice(s.deliverFailed); // nada quedó en cola: el botón sigue habilitado para reintentar
      return;
    }
    setPendingIds((ids) => new Set(ids).add(orderId));
    await refresh();
  };

  const signOut = async () => {
    cancelled.current = true; // la corrida en curso ya no escribe caché ni estado
    try {
      await withTimeout(runner.idle(), 3000); // sin red, la corrida podría no terminar nunca
      await clearAssigned();
    } finally {
      logout();
    }
  };

  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setNotice(s.openFailed);
    }
  };

  const selected = orders.find((o) => o.id === selectedId) ?? orders[0];
  const serverFailed = loaded && orders.length === 0 && notice === s.serverError;

  let empty;
  if (!loaded) {
    empty = (
      <Surface tone="background" style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <BrandMark variant="isotipo" size={theme.components.header.mascotSize} animated={false} />
        <Spacer size="sm" />
        <Text variant="quiet">{s.loading}</Text>
      </Surface>
    );
  } else if (serverFailed) {
    empty = (
      <Surface tone="background" style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text variant="body">{s.serverError}</Text>
        <Spacer size="md" />
        <Button label={s.retry} variant="secondary" onPress={() => void refresh()} />
      </Surface>
    );
  } else {
    empty = <EmptyState title={s.emptyTitle} message={strings.dispatch.deliveryEmpty} />;
  }

  return (
    <ScreenLayout
      scroll={false}
      header={<ScreenHeader title={strings.dispatch.deliveryTitle} actionLabel={s.logout} onAction={() => void signOut()} />}
      banner={
        <>
          <OfflineBanner visible={offline} message={s.offlineBanner} />
          {notice && !serverFailed ? <Banner glyph="!" message={notice} /> : null}
        </>
      }
      bottomBar={
        selected ? (
          <Button
            label={strings.dispatch.markDeliveredButton}
            accessibilityHint={selected.customerName}
            disabled={pendingIds.has(selected.id)}
            onPress={() => void deliver(selected.id)}
          />
        ) : undefined
      }
    >
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        extraData={[selected?.id, pendingIds]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void pullToRefresh()} colors={[theme.colors.actionFill]} />
        }
        contentContainerStyle={{
          flexGrow: 1,
          gap: theme.components.layout.gap,
          paddingHorizontal: theme.components.layout.paddingH,
          paddingVertical: theme.components.layout.paddingV,
        }}
        ListEmptyComponent={empty}
        renderItem={({ item, index }) => {
          const isSelected = item.id === selected?.id;
          const isPending = pendingIds.has(item.id);
          const address = item.deliveryAddress;
          return (
            <Touchable
              accessible={false}
              onPress={() => setSelectedId(item.id)}
              style={{
                borderRadius: theme.components.card.radius,
                borderWidth: isSelected ? 3 : 0,
                borderColor: theme.colors.actionFill,
              }}
            >
              <Card index={index}>
                <Touchable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={address ? `${item.customerName}, ${address}` : item.customerName}
                  onPress={() => setSelectedId(item.id)}
                >
                  <Text variant="heading">{item.customerName}</Text>
                  <StatusPill
                    status={isPending ? "pending_sync" : "out_for_delivery"}
                    label={isPending ? s.pendingSync : s.onTheWay}
                  />
                </Touchable>
                {isPending ? <Text variant="quiet">{s.pendingSyncNote}</Text> : null}
                {address ? (
                  <Touchable
                    accessibilityRole="link"
                    accessibilityLabel={`${s.navigate}: ${address}`}
                    onPress={() =>
                      void open("https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(address))
                    }
                  >
                    <Text variant="quiet">{s.addressLabel}</Text>
                    <Text variant="title" color={theme.colors.link} style={{ textDecorationLine: "underline" }}>
                      {address}
                    </Text>
                  </Touchable>
                ) : (
                  <Text variant="title">{s.addressMissing}</Text>
                )}
                <Touchable
                  accessibilityRole="link"
                  accessibilityLabel={`${s.call}: ${item.customerPhone}`}
                  onPress={() => void open(`tel:${item.customerPhone}`)}
                >
                  <Text variant="quiet">{s.phoneLabel}</Text>
                  <Text variant="title" color={theme.colors.link} style={{ textDecorationLine: "underline" }}>
                    {item.customerPhone}
                  </Text>
                </Touchable>
                {isSelected ? <Text variant="label">{s.selected}</Text> : null}
              </Card>
            </Touchable>
          );
        }}
      />
    </ScreenLayout>
  );
}
