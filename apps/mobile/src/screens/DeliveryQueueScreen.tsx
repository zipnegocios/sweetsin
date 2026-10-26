import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, FlatList, Linking, RefreshControl, useWindowDimensions } from "react-native";
import * as Location from "expo-location";
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
import { rejectAfter, withTimeout } from "../hooks/with-timeout";
import { usePolling } from "../hooks/use-polling";
import { whatsappUrl } from "../contact/whatsapp";
import { formatCents } from "../format/money";
import { locale, strings } from "../i18n";
import { formatArrival, routeAgeMs, routeTiming } from "../maps/arrival-time";
import { formatEta } from "../maps/format-eta";
import { navigationUrl } from "../maps/navigation-url";
import { ROUTE_LOCATION_LOOKUP_TIMEOUT_MS, ROUTE_LOCATION_TIMEOUT_MS, ROUTE_REQUEST_TIMEOUT_MS } from "../maps/limits";
import { parseRouteInfo } from "../maps/parse-route-info";
import { RouteMap } from "../maps/RouteMap";
import type { RouteInfo } from "../maps/types";
import { loadAssigned, replaceAssigned, type AssignedOrder } from "../offline/assigned-cache";
import { captureEvidence, type CaptureResult } from "../evidence/capture-evidence";
import { evidenceDeps } from "../evidence/evidence-deps";
import { runEvidenceUpload } from "../evidence/evidence-upload";
import { enqueueDeliver, flushQueue } from "../offline/command-queue";
import { makeDeliverSender } from "../offline/deliver-sender";
import { sqliteCommandStore } from "../offline/sqlite-command-store";
import { endShift, hasShiftConsent, isShiftActive, resumeShift, saveShiftConsent, startShift } from "../tracking/shift";

const POLL_MS = 30_000;
const SIGN_OUT_END_SHIFT_MS = 8000; // endShift espera hasta 3 s por envíos en curso y luego hace el DELETE
// Cada ruta con tráfico por tramo (TRAFFIC_ON_POLYLINE) se factura como Compute Routes Enterprise: 120 s acota el
// costo con el mapa a la vista (el servidor además cachea 60 s por destino y origen redondeado).
const ROUTE_REFRESH_MS = 120_000;
// Volver a primer plano no recalcula una ruta más nueva que esto (evita una llamada paga por cada cambio de app).
const ROUTE_MIN_AGE_MS = 60_000;
const s = strings.staffApp;

const CHANNEL_LABEL = { web: s.channelWeb, whatsapp: s.channelWhatsapp } as const;
const PAYMENT_LABEL = {
  pending: s.paymentPending,
  paid: s.paymentPaid,
  failed: s.paymentFailed,
  refunded: s.paymentRefunded,
} as const;

type OrderDetail = AssignedOrder &
  Required<Pick<AssignedOrder, "items" | "subtotalCents" | "discountCents" | "deliveryFeeCents" | "totalCents">>;

/** Una fila de caché vieja no trae el detalle: sin él, la sección no aparece. */
function hasDetail(o: AssignedOrder): o is OrderDetail {
  return (
    Array.isArray(o.items) &&
    [o.subtotalCents, o.discountCents, o.deliveryFeeCents, o.totalCents].every((n) => typeof n === "number")
  );
}

const CLOCK_TICK_MS = 30_000;

type RouteState =
  | { orderId: string; status: "loading" }
  | { orderId: string; status: "ok"; route: RouteInfo }
  | { orderId: string; status: "unavailable" | "denied" };

/** Origen del repartidor. Con `ask` pide el permiso (solo al tocar "Ver ruta"); sin `ask` exige que ya esté concedido. */
async function readOrigin(ask: boolean): Promise<{ lat: number; lng: number } | "denied" | "unavailable"> {
  // El dialogo del sistema (request) queda sin plazo: el repartidor puede tardar en contestarlo. Solo el `get` no interactivo lo lleva.
  const permission = ask
    ? await Location.requestForegroundPermissionsAsync()
    : await rejectAfter(Location.getForegroundPermissionsAsync(), ROUTE_LOCATION_LOOKUP_TIMEOUT_MS);
  if (!permission.granted) return "denied";
  const pos = await rejectAfter(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    ROUTE_LOCATION_TIMEOUT_MS,
  ).catch(() => withTimeout(Location.getLastKnownPositionAsync(), ROUTE_LOCATION_LOOKUP_TIMEOUT_MS));
  return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : "unavailable";
}

export function DeliveryQueueScreen() {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const mapHeight = Math.round(windowHeight * theme.components.map.heightRatio);
  const { logout } = useAuth();
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [offline, setOffline] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [evidenceRequired, setEvidenceRequired] = useState(false);
  const [evidenceSentIds, setEvidenceSentIds] = useState<Set<string>>(new Set());
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [shiftOn, setShiftOn] = useState(false);
  const [shiftBusy, setShiftBusy] = useState(false);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const cancelled = useRef(false);
  const evidenceBusy = useRef(false);
  const [routeState, setRouteState] = useState<RouteState | null>(null);
  // El mapa se ve solo cuando hay ruta; esto guarda la orden en la que el repartidor lo ocultó a mano.
  const [mapHiddenId, setMapHiddenId] = useState<string | null>(null);
  const [detailOpenId, setDetailOpenId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date()); // reloj del ETA restante: solo avanza con el mapa a la vista
  const routeStateRef = useRef(routeState);
  routeStateRef.current = routeState;
  const routeSeq = useRef(0);
  const selectedIdRef = useRef<string | undefined>(undefined);

  // Cierra la sesión: corta el seguimiento (sin bloquear) y luego el `logout` único del contexto.
  const endSession = useCallback(async () => {
    cancelled.current = true; // la corrida en curso ya no escribe caché ni estado
    try {
      await withTimeout(endShift(), SIGN_OUT_END_SHIFT_MS).catch(() => undefined); // detiene el seguimiento y borra la posición
    } finally {
      await logout();
    }
  }, [logout]);

  const run = useCallback(async () => {
    if (cancelled.current) return;
    try {
      const report = await flushQueue(sqliteCommandStore, makeDeliverSender(apiFetch));
      for (const c of report.conflicts) {
        const address = ordersRef.current.find((o) => o.id === c.orderId)?.deliveryAddress ?? c.orderId;
        Alert.alert(s.conflictTitle, `${address}\n${c.reason}`);
      }
      // Sesión inválida (401): los comandos quedan en cola y se reenvían tras volver a ingresar el PIN.
      if (report.unauthorized) return void (await endSession());
      let nextNotice: string | null = null;
      try {
        const res = await apiFetch("/api/mobile/orders/assigned");
        if (res.status === 401) return void (await endSession());
        if (res.ok) {
          const data = (await res.json()) as { orders: AssignedOrder[]; deliveryEvidenceRequired?: boolean };
          if (cancelled.current) return;
          await replaceAssigned(data.orders);
          setOrders(data.orders);
          setEvidenceRequired(data.deliveryEvidenceRequired === true);
          setOffline(false);
        } else {
          nextNotice = s.serverError;
          setOffline(false); // cualquier respuesta HTTP prueba que hay red
          setOrders(await loadAssigned());
        }
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        setOrders(await loadAssigned());
        setOffline(true);
      }
      setPendingIds(new Set((await sqliteCommandStore.list()).map((c) => c.orderId)));
      setNotice(nextNotice);
      isShiftActive().then(setShiftOn, () => {}); // el turno puede haberse cortado en segundo plano (p. ej. 401)
    } catch {
      setNotice(s.serverError);
    } finally {
      setLoaded(true);
    }
  }, [endSession]);

  // Nunca dos corridas a la vez; un pedido durante una corrida agenda exactamente una repetición.
  const [runner] = useState(() => makeCoalescer(run));
  const refresh = runner.call;

  usePolling(refresh, POLL_MS);

  // Tras un reinicio con el turno activo, reanuda el seguimiento (sin pedir permisos).
  useEffect(() => {
    resumeShift().then(setShiftOn, () => {});
  }, []);

  // Nunca lanza. Una respuesta tardía de otra orden se descarta. Solo el pedido interactivo ("Ver ruta") muestra
  // "cargando"/"no disponible": un refresco silencioso que falla conserva lo que ya se veía (p. ej. la última ruta).
  const loadRoute = useCallback(async (orderId: string, ask: boolean): Promise<"denied" | undefined> => {
    const seq = ++routeSeq.current;
    const apply = (next: RouteState | null) => {
      if (!cancelled.current && seq === routeSeq.current && selectedIdRef.current === orderId) setRouteState(next);
    };
    const fail = () => {
      if (ask) apply({ orderId, status: "unavailable" });
    };
    try {
      if (ask) apply({ orderId, status: "loading" });
      const origin = await readOrigin(ask);
      if (origin === "denied") {
        // Sin permiso previo: sin ETA y sin error; un refresco no interactivo no pisa un aviso "denied" visible.
        const current = routeStateRef.current;
        if (ask) apply({ orderId, status: "denied" });
        else if (!(current?.orderId === orderId && current.status === "denied")) apply(null);
        return "denied";
      }
      if (origin === "unavailable") return void fail();
      const res = await rejectAfter(
        apiFetch(`/api/mobile/orders/${orderId}/route?lat=${origin.lat}&lng=${origin.lng}`),
        ROUTE_REQUEST_TIMEOUT_MS,
      );
      if (!res.ok) return void fail();
      const route = parseRouteInfo(await res.json());
      if (route) apply({ orderId, status: "ok", route });
      else fail();
    } catch {
      fail();
    }
  }, []);

  const currentSelectedId = (orders.find((o) => o.id === selectedId) ?? orders[0])?.id;
  selectedIdRef.current = currentSelectedId;

  // Ruta de la orden seleccionada al cambiar la selección, sin pedir permisos: con el permiso ya concedido el mapa
  // aparece solo; sin él no pasa nada hasta que el repartidor toque "Ver ruta".
  useEffect(() => {
    routeSeq.current++; // invalida cualquier respuesta en vuelo de la orden anterior
    setRouteState(null);
    setMapHiddenId(null);
    if (currentSelectedId) void loadRoute(currentSelectedId, false);
  }, [currentSelectedId, loadRoute]);

  // Refresco del ETA y del tráfico cada 120 s (y al volver a primer plano) solo mientras el mapa de la orden
  // seleccionada está a la vista y la app activa; una ruta de menos de 60 s no se recalcula.
  usePolling(() => {
    const id = currentSelectedId;
    const current = routeState;
    if (AppState.currentState !== "active" || !id || mapHiddenId === id) return;
    if (current?.orderId !== id || current.status !== "ok") return;
    const age = routeAgeMs(current.route.computedAt, new Date());
    if (age !== null && age < ROUTE_MIN_AGE_MS) return;
    void loadRoute(id, false);
  }, ROUTE_REFRESH_MS);

  const selectedMapVisible =
    routeState?.orderId === currentSelectedId && routeState?.status === "ok" && mapHiddenId !== currentSelectedId;
  useEffect(() => {
    if (!selectedMapVisible) return;
    setNow(new Date()); // también al llegar una ruta nueva
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [selectedMapVisible, routeState]);

  const pullToRefresh = async () => {
    setRefreshing(true);
    const id = selectedIdRef.current;
    const current = routeStateRef.current;
    // Un "Ver ruta" en curso no se pisa: invalidarlo dejaría "Cargando ruta..." si el refresco silencioso falla.
    if (id && !(current?.orderId === id && current.status === "loading")) void loadRoute(id, false);
    await refresh();
    setRefreshing(false);
  };

  // "Ver ruta" es lo único que pide el permiso de ubicación; con la ruta ya calculada solo vuelve a mostrar el mapa.
  const toggleRoute = async (orderId: string, mapVisible: boolean) => {
    if (mapVisible) {
      setMapHiddenId(orderId);
      return;
    }
    setMapHiddenId(null);
    const current = routeStateRef.current;
    if (current?.orderId === orderId && current.status === "ok") return;
    if ((await loadRoute(orderId, true)) === "denied") alertSettings(s.routeLocationDenied, s.routeShow);
  };

  const deliver = async (orderId: string) => {
    const order = ordersRef.current.find((o) => o.id === orderId);
    if (order && evidenceRequired && !order.deliveryEvidenceKey) {
      // PUNTO DE EXTENSIÓN: cuando se active la evidencia obligatoria, bloquear aquí (hoy no se bloquea).
    }
    try {
      await enqueueDeliver(sqliteCommandStore, orderId);
    } catch {
      setNotice(s.deliverFailed); // nada quedó en cola: el botón sigue habilitado para reintentar
      return;
    }
    setPendingIds((ids) => new Set(ids).add(orderId));
    await refresh();
  };

  const alertSettings = (message: string, title: string = s.evidenceAdd) =>
    Alert.alert(title, message, [
      { text: s.cancelLabel, style: "cancel" },
      { text: s.openSettings, onPress: () => void Linking.openSettings() },
    ]);

  // Opcional y no bloqueante: cualquier fallo solo avisa; "Marcar entregado" sigue disponible.
  const addEvidence = async (orderId: string) => {
    if (evidenceBusy.current) return;
    evidenceBusy.current = true;
    const proceed = await new Promise<boolean>((resolve) =>
      Alert.alert(s.evidenceAdd, s.evidenceWhy, [
        { text: s.cancelLabel, style: "cancel", onPress: () => resolve(false) },
        { text: s.continueLabel, onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) }),
    );
    if (!proceed) {
      evidenceBusy.current = false;
      return;
    }
    setUploadingId(orderId);
    try {
      let captured: CaptureResult;
      try {
        captured = await captureEvidence();
      } catch {
        captured = { ok: false, reason: "location-unavailable" };
      }
      if (!captured.ok) {
        if (captured.reason === "camera-denied") alertSettings(s.cameraDenied);
        else if (captured.reason === "location-denied") alertSettings(s.locationDenied);
        else if (captured.reason === "location-unavailable") Alert.alert(s.evidenceAdd, s.locationUnavailable);
        return; // "cancelled": el repartidor decidió no sacar la foto
      }
      const result = await runEvidenceUpload(evidenceDeps, { orderId, ...captured });
      if (result.ok) setEvidenceSentIds((ids) => new Set(ids).add(orderId));
      else Alert.alert(s.evidenceAdd, s.evidenceUploadFailed);
    } finally {
      evidenceBusy.current = false;
      setUploadingId(null);
    }
  };

  const confirmConsent = () =>
    new Promise<boolean>((resolve) =>
      Alert.alert(s.shiftConsentTitle, s.shiftConsentBody, [
        { text: s.cancelLabel, style: "cancel", onPress: () => resolve(false) },
        { text: s.shiftConsentAccept, onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) }),
    );

  const toggleShift = async () => {
    if (shiftBusy) return;
    setShiftBusy(true);
    try {
      if (shiftOn) {
        await withTimeout(endShift(), 10_000);
        setShiftOn(false);
        return;
      }
      // El consentimiento va antes de cualquier permiso y se pide una sola vez.
      if (!(await hasShiftConsent())) {
        if (!(await confirmConsent())) return;
        await saveShiftConsent();
      }
      const result = await startShift();
      if (result === "foreground-denied") {
        Alert.alert(s.shiftStart, s.shiftLocationDenied, [
          { text: s.cancelLabel, style: "cancel" },
          { text: s.openSettings, onPress: () => void Linking.openSettings() },
        ]);
      } else if (result === "failed") {
        setNotice(s.shiftFailed);
      } else {
        setShiftOn(true);
        if (result === "foreground-only") Alert.alert(s.shiftStart, s.shiftForegroundOnly);
      }
    } catch {
      setNotice(s.shiftFailed);
    } finally {
      setShiftBusy(false);
    }
  };

  const signOut = async () => {
    cancelled.current = true;
    await withTimeout(runner.idle(), 3000).catch(() => undefined); // sin red, la corrida podría no terminar nunca
    await endSession();
  };

  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setNotice(s.openFailed);
    }
  };

  const selected = orders.find((o) => o.id === selectedId) ?? orders[0];
  const selectedHasEvidence = !!selected && (!!selected.deliveryEvidenceKey || evidenceSentIds.has(selected.id));
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
          <Surface tone="background" style={{ paddingHorizontal: theme.components.layout.paddingH, paddingTop: theme.components.layout.paddingV, gap: theme.components.layout.gap }}>
            {shiftOn ? <StatusPill status="delivered" label={s.shiftOn} /> : null}
            <Button
              label={shiftOn ? s.shiftEnd : s.shiftStart}
              variant="secondary"
              loading={shiftBusy}
              onPress={() => void toggleShift()}
            />
          </Surface>
          <OfflineBanner visible={offline} message={s.offlineBanner} />
          {notice && !serverFailed ? <Banner glyph="!" message={notice} /> : null}
        </>
      }
      bottomBar={
        selected ? (
          <>
            {selectedHasEvidence ? null : (
              <Button
                label={uploadingId === selected.id ? s.evidenceUploading : s.evidenceAdd}
                variant="secondary"
                accessibilityHint={selected.customerName}
                loading={uploadingId === selected.id}
                disabled={uploadingId !== null && uploadingId !== selected.id}
                onPress={() => void addEvidence(selected.id)}
              />
            )}
            <Button
              label={strings.dispatch.markDeliveredButton}
              accessibilityHint={selected.customerName}
              disabled={pendingIds.has(selected.id)}
              onPress={() => void deliver(selected.id)}
            />
          </>
        ) : undefined
      }
    >
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        extraData={[selected?.id, pendingIds, evidenceSentIds, routeState, mapHiddenId, detailOpenId, mapHeight, now]}
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
          const route = isSelected && routeState?.orderId === item.id ? routeState : null;
          const mapVisible = route?.status === "ok" && mapHiddenId !== item.id;
          const detailOpen = detailOpenId === item.id;
          const wa = whatsappUrl(item.customerPhone);
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
                {item.deliveryEvidenceKey || evidenceSentIds.has(item.id) ? (
                  <StatusPill status="evidence_sent" label={s.evidenceSent} />
                ) : null}
                {isPending ? <Text variant="quiet">{s.pendingSyncNote}</Text> : null}
                {address ? (
                  <Touchable
                    accessibilityRole="link"
                    accessibilityLabel={`${s.navigate}: ${address}`}
                    onPress={() => void open(navigationUrl(route?.status === "ok" ? route.route.destination : null, address))}
                  >
                    <Text variant="quiet">{s.addressLabel}</Text>
                    <Text variant="title" color={theme.colors.link} style={{ textDecorationLine: "underline" }}>
                      {address}
                    </Text>
                  </Touchable>
                ) : (
                  <Text variant="title">{s.addressMissing}</Text>
                )}
                <Text variant="quiet">{s.phoneLabel}</Text>
                <Text variant="title">{item.customerPhone}</Text>
                <Surface tone="surface" style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.components.layout.barGap }}>
                  <Button
                    label={s.call}
                    variant="secondary"
                    accessibilityLabel={`${s.call}: ${item.customerName}`}
                    onPress={() => void open(`tel:${item.customerPhone}`)}
                  />
                  {wa ? (
                    <Button
                      label={s.whatsapp}
                      variant="secondary"
                      accessibilityLabel={`${s.whatsapp}: ${item.customerName}`}
                      onPress={() => void open(wa)}
                    />
                  ) : null}
                </Surface>
                {isSelected && hasDetail(item) ? (
                  <>
                    <Button
                      label={detailOpen ? s.orderDetailHide : s.orderDetailShow}
                      variant="ghost"
                      expanded={detailOpen}
                      accessibilityHint={item.customerName}
                      onPress={() => setDetailOpenId(detailOpen ? null : item.id)}
                    />
                    {detailOpen ? (
                      <>
                        {item.items.map((line, i) => (
                          <Text key={i} variant="body">
                            {line.quantity} × {line.name}
                          </Text>
                        ))}
                        <Text variant="body">
                          {strings.cart.subtotal}: {formatCents(item.subtotalCents)}
                        </Text>
                        <Text variant="body">
                          {s.detailDiscount}: {formatCents(-item.discountCents)}
                        </Text>
                        <Text variant="body">
                          {s.detailDeliveryFee}: {formatCents(item.deliveryFeeCents)}
                        </Text>
                        <Text variant="bodyStrong">
                          {strings.cart.total}: {formatCents(item.totalCents)}
                        </Text>
                        {item.channel ? (
                          <Text variant="body">
                            {strings.admin.columnChannel}: {CHANNEL_LABEL[item.channel]}
                          </Text>
                        ) : null}
                        {item.paymentStatus ? (
                          <Text variant="body">
                            {strings.admin.filterPaymentStatus}: {PAYMENT_LABEL[item.paymentStatus]}
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}
                {isSelected && item.deliveryNotes?.trim() ? (
                  <Banner glyph="✎" message={`${s.detailNotes}: ${item.deliveryNotes.trim()}`} />
                ) : null}
                {isSelected && address ? (
                  <Button
                    label={mapVisible ? s.routeHide : s.routeShow}
                    variant="ghost"
                    expanded={mapVisible}
                    accessibilityHint={item.customerName}
                    onPress={() => void toggleRoute(item.id, mapVisible)}
                  />
                ) : null}
                {isSelected && address && route?.status === "ok" && mapVisible ? (
                  <RouteMap
                    route={route.route}
                    height={mapHeight}
                    overlay={({ hasTraffic }) => {
                      const timing = routeTiming(route.route.etaSeconds, route.route.computedAt, now);
                      return (
                        <Surface
                          tone="surface"
                          accessible
                          style={{
                            borderRadius: theme.components.map.overlay.radius,
                            borderWidth: theme.components.map.overlay.borderWidth,
                            borderColor: theme.components.map.overlay.border,
                            padding: theme.components.map.overlay.padding,
                            gap: theme.components.map.overlay.gap,
                          }}
                        >
                          <Text variant="heading">
                            {s.etaLabel}: {formatEta(timing.remainingSeconds, route.route.distanceMeters, locale)}
                          </Text>
                          <Text variant="body">
                            {s.arrivalAt} {formatArrival(timing.remainingSeconds, now, locale)}
                          </Text>
                          {hasTraffic ? <Text variant="bodyStrong">{s.routeWithTraffic}</Text> : null}
                          {timing.stale ? <Text variant="bodyStrong">{s.routeStale}</Text> : null}
                        </Surface>
                      );
                    }}
                  />
                ) : null}
                {route?.status === "ok" && !mapVisible ? (
                  <Text variant="title">
                    {s.etaLabel}:{" "}
                    {formatEta(
                      routeTiming(route.route.etaSeconds, route.route.computedAt, new Date()).remainingSeconds,
                      route.route.distanceMeters,
                      locale,
                    )}
                  </Text>
                ) : null}
                {isSelected && address && route && route.status !== "ok" && mapHiddenId !== item.id ? (
                  <Text variant="quiet">
                    {route.status === "loading"
                      ? s.routeLoading
                      : route.status === "denied"
                        ? s.routeLocationDenied
                        : s.routeUnavailable}
                  </Text>
                ) : null}
                {isSelected && address ? (
                  <Button
                    label={s.navigateStart}
                    variant="secondary"
                    accessibilityHint={address}
                    onPress={() => void open(navigationUrl(route?.status === "ok" ? route.route.destination : null, address))}
                  />
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
