import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, RefreshControl } from "react-native";
import { apiFetch } from "../api/client";
import { isNetworkError } from "../api/network";
import { useAuth } from "../auth/context";
import { useHeaderAvatar } from "../auth/use-header-avatar";
import {
  Banner,
  BrandMark,
  Button,
  Card,
  EmptyState,
  OfflineBanner,
  OptionRow,
  ScreenHeader,
  ScreenLayout,
  Spacer,
  StatusPill,
  Surface,
  Text,
  Touchable,
  useTheme,
} from "../design-system";
import { classifyDispatchResponse, nextAction } from "../dispatch/actions";
import { interpretLoad, type Fetched } from "../dispatch/load";
import type { DeliveryStaff, QueueOrder, QueueStatus } from "../dispatch/types";
import { formatCents } from "../format/money";
import { makeCoalescer } from "../hooks/coalesce";
import { usePolling } from "../hooks/use-polling";
import { rejectAfter } from "../hooks/with-timeout";
import { strings } from "../i18n";

const POLL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 15_000; // fetch de RN no tiene plazo propio: sin esto una corrida trabada nunca termina

/** Petición + lectura del cuerpo con plazo; un timeout o un json inválido rechazan. */
const request = (path: string, init?: RequestInit): Promise<Fetched> =>
  rejectAfter(
    (async () => {
      const res = await apiFetch(path, init);
      return { status: res.status, body: res.ok ? await res.json() : await res.json().catch(() => null) };
    })(),
    REQUEST_TIMEOUT_MS,
  );
const s = strings.staffApp;

const STATUS_LABEL: Record<QueueStatus, string> = {
  received: s.dispatchStatusReceived,
  in_prep: s.dispatchStatusInPrep,
  ready_for_pickup: s.dispatchStatusReady,
};

const typeLabel = (o: QueueOrder) =>
  o.fulfillmentType === "pickup" ? strings.cart.fulfillmentPickup : strings.cart.fulfillmentDelivery;

/** Despachador: trabaja solo en línea. Sin red muestra la última cola y deshabilita las acciones (no encola). */
export function DespachadorQueueScreen() {
  const theme = useTheme();
  const { logout } = useAuth();
  const headerAvatar = useHeaderAvatar();
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [staff, setStaff] = useState<DeliveryStaff[] | null>(null); // null: nunca cargó
  const [loaded, setLoaded] = useState(false); // hubo al menos un intento de carga
  const [fetched, setFetched] = useState(false); // hubo al menos una cola recibida
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [chosenStaffId, setChosenStaffId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // evita un doble toque antes de que se repinte el botón
  const cancelled = useRef(false);

  const endSession = useCallback(async () => {
    cancelled.current = true; // la corrida en curso ya no escribe estado
    await logout();
  }, [logout]);

  const run = useCallback(async () => {
    if (cancelled.current) return;
    try {
      const [queue, team] = await Promise.allSettled([
        request("/api/mobile/orders/queue"),
        request("/api/mobile/delivery-staff"),
      ]);
      if (cancelled.current) return;
      const out = interpretLoad(queue, team);
      if (out.unauthorized) return void (await endSession());
      setOffline(out.offline);
      if (out.staff) setStaff(out.staff); // una falla de repartidores conserva la lista anterior
      if (out.orders) {
        setOrders(out.orders);
        setFetched(true);
        setNotice(null);
      } else if (!out.offline) {
        setNotice(s.dispatchLoadError);
      }
      if (out.forbidden) setNotice(s.dispatchForbidden); // 403: la sesión sigue, se explica el motivo
    } catch {
      setNotice(s.dispatchLoadError);
    } finally {
      setLoaded(true);
    }
  }, [endSession]);

  // Nunca dos corridas a la vez; un pedido durante una corrida agenda exactamente una repetición.
  const [runner] = useState(() => makeCoalescer(run));
  const refresh = runner.call;

  usePolling(refresh, POLL_MS);

  const pullToRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const select = (orderId: string) => {
    setSelectedId(orderId);
    setPickingFor(null);
    setChosenStaffId(null);
  };

  const closePicker = () => {
    setPickingFor(null);
    setChosenStaffId(null);
  };

  const openPicker = (orderId: string) => {
    setSelectedId(orderId); // fija la selección: una orden nueva arriba no la mueve
    setPickingFor(orderId);
    setChosenStaffId(null);
  };

  // La orden elegida salió de la cola: se suelta la selección y el selector, sin arrastrar el repartidor elegido.
  useEffect(() => {
    if (selectedId && !orders.some((o) => o.id === selectedId)) {
      setSelectedId(null);
      setPickingFor(null);
      setChosenStaffId(null);
    }
  }, [orders, selectedId]);

  const act = async (orderId: string, path: "status" | "assign", body: Record<string, string>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let reload = false;
    try {
      const res = await request(`/api/mobile/orders/${orderId}/${path}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const result = classifyDispatchResponse(res.status, res.body);
      if (result.kind === "unauthorized") return void (await endSession());
      if (result.kind === "forbidden" || result.kind === "server") {
        setNotice(result.kind === "forbidden" ? s.dispatchForbidden : s.dispatchActionFailed);
        return;
      }
      if (result.kind === "conflict") Alert.alert(s.dispatchConflictTitle, result.reason || s.dispatchActionFailed);
      else setNotice(null);
      closePicker();
      reload = true; // ok o conflicto: la cola del servidor manda
    } catch (error) {
      if (isNetworkError(error)) setOffline(true);
      else {
        setNotice(s.dispatchActionFailed); // timeout o respuesta ilegible: no sabemos si se aplicó
        reload = true;
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    if (reload) void refresh(); // fuera de la sección ocupada: un poll trabado no retiene el botón
  };

  // Sin selección explícita, la primera; una selección que ya no está no cae en otra hasta que el efecto la suelte.
  const selected = selectedId ? orders.find((o) => o.id === selectedId) : orders[0];
  const action = selected ? nextAction(selected) : null;
  const picking = !!selected && pickingFor === selected.id;
  const chosen = staff?.find((m) => m.id === chosenStaffId);
  const loadFailed = loaded && !fetched;

  let empty;
  if (!loaded) {
    empty = (
      <Surface tone="background" style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <BrandMark variant="isotipo" size={theme.components.header.mascotSize} animated={false} />
        <Spacer size="sm" />
        <Text variant="quiet">{s.dispatchLoading}</Text>
      </Surface>
    );
  } else if (loadFailed) {
    empty = (
      <Surface tone="background" style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text variant="body">{notice ?? s.dispatchLoadError}</Text>
        <Spacer size="md" />
        <Button label={s.retry} variant="secondary" onPress={() => void refresh()} />
      </Surface>
    );
  } else {
    empty = <EmptyState title={s.dispatchEmptyTitle} message={s.dispatchEmptyBody} />;
  }

  let bottomBar;
  if (selected && action) {
    const hint = selected.customerName;
    if (action.kind === "none") {
      bottomBar = <Text variant="body">{s.dispatchPickupNoAction}</Text>;
    } else if (action.kind === "start_prep" || action.kind === "mark_ready") {
      const start = action.kind === "start_prep";
      bottomBar = (
        <Button
          label={start ? s.dispatchStartPrep : s.dispatchMarkReady}
          accessibilityHint={hint}
          loading={busy}
          disabled={offline}
          onPress={() => void act(selected.id, "status", { status: start ? "in_prep" : "ready_for_pickup" })}
        />
      );
    } else if (!staff || staff.length === 0) {
      bottomBar = (
        <>
          <Text variant="body">{staff ? s.dispatchNoStaff : s.dispatchStaffLoadError}</Text>
          <Button label={s.dispatchAssignTitle} accessibilityHint={hint} disabled onPress={() => undefined} />
        </>
      );
    } else if (picking) {
      bottomBar = (
        <>
          <Button
            label={chosen ? `${s.dispatchAssignConfirm}: ${chosen.name}` : s.dispatchAssignConfirm}
            accessibilityHint={hint}
            loading={busy}
            disabled={offline || !chosen}
            onPress={() => chosen && void act(selected.id, "assign", { deliveryUserId: chosen.id })}
          />
          <Button label={s.cancelLabel} variant="secondary" disabled={busy} onPress={closePicker} />
        </>
      );
    } else {
      bottomBar = (
        <Button
          label={s.dispatchAssignTitle}
          accessibilityHint={hint}
          disabled={offline}
          onPress={() => openPicker(selected.id)}
        />
      );
    }
  }

  return (
    <ScreenLayout
      scroll={false}
      header={<ScreenHeader title={s.dispatchTitle} avatar={headerAvatar} />}
      banner={
        <>
          <OfflineBanner visible={offline} message={s.dispatchOfflineBanner} />
          {notice && !loadFailed ? <Banner glyph="!" message={notice} /> : null}
        </>
      }
      bottomBar={bottomBar}
    >
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        extraData={[selected?.id, picking, chosenStaffId, staff, busy, offline]}
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
          const type = typeLabel(item);
          return (
            <Touchable
              accessible={false}
              onPress={() => select(item.id)}
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
                  accessibilityLabel={`${item.customerName}, ${type}, ${STATUS_LABEL[item.fulfillmentStatus]}`}
                  accessibilityHint={isSelected ? undefined : s.dispatchSelectOrder}
                  onPress={() => select(item.id)}
                >
                  <Text variant="heading">{item.customerName}</Text>
                  <StatusPill status={item.fulfillmentStatus} label={STATUS_LABEL[item.fulfillmentStatus]} />
                </Touchable>
                <Text variant="bodyStrong">{type}</Text>
                {item.deliveryAddress ? (
                  <>
                    <Text variant="quiet">{s.addressLabel}</Text>
                    <Text variant="body">{item.deliveryAddress}</Text>
                  </>
                ) : null}
                <Text variant="body">
                  {strings.cart.total}: {formatCents(item.totalCents)} · {s.dispatchItems}: {item.itemCount}
                </Text>
                {isSelected && picking ? (
                  <>
                    <Text variant="heading">{s.dispatchAssignTitle}</Text>
                    {(staff ?? []).map((m) => (
                      <OptionRow
                        key={m.id}
                        label={m.name}
                        selected={m.id === chosenStaffId}
                        disabled={busy}
                        onPress={() => setChosenStaffId(m.id)}
                      />
                    ))}
                  </>
                ) : null}
                {isSelected ? <Text variant="label">{s.selected}</Text> : null}
              </Card>
            </Touchable>
          );
        }}
      />
    </ScreenLayout>
  );
}
