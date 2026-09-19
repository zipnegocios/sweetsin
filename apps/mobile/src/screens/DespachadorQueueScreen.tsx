import { useEffect, useState } from "react";
import { View, Text, Button, FlatList, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/context";

type QueueOrder = { id: string; customerName: string; fulfillmentStatus: string };
type DeliveryStaff = { id: string; name: string };

export function DespachadorQueueScreen() {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [deliveryStaff, setDeliveryStaff] = useState<DeliveryStaff[]>([]);
  const navigation = useNavigation();
  const { logout } = useAuth();

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <Button title="Salir" onPress={logout} /> });
  }, [navigation, logout]);

  async function loadQueue() {
    const res = await apiFetch("/api/mobile/orders/queue");
    if (res.ok) {
      const data = (await res.json()) as { orders: QueueOrder[] };
      setOrders(data.orders);
    }
  }

  async function loadDeliveryStaff() {
    const res = await apiFetch("/api/mobile/delivery-staff");
    if (res.ok) {
      const data = (await res.json()) as { staff: DeliveryStaff[] };
      setDeliveryStaff(data.staff);
    }
  }

  useEffect(() => {
    loadQueue();
    loadDeliveryStaff();
  }, []);

  async function advance(orderId: string, status: "in_prep" | "ready_for_pickup") {
    await apiFetch(`/api/mobile/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    loadQueue();
  }

  async function assign(orderId: string, deliveryUserId: string) {
    await apiFetch(`/api/mobile/orders/${orderId}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ deliveryUserId }),
    });
    loadQueue();
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text>{item.customerName} — {item.fulfillmentStatus}</Text>
          {item.fulfillmentStatus === "received" && <Button title="Empezar preparacion" onPress={() => advance(item.id, "in_prep")} />}
          {item.fulfillmentStatus === "in_prep" && <Button title="Marcar listo" onPress={() => advance(item.id, "ready_for_pickup")} />}
          {item.fulfillmentStatus === "ready_for_pickup" && (
            <View>
              <Text style={styles.label}>Asignar repartidor:</Text>
              {deliveryStaff.length === 0 && <Text>No hay repartidores activos</Text>}
              {deliveryStaff.map((staffMember) => (
                <Button key={staffMember.id} title={staffMember.name} onPress={() => assign(item.id, staffMember.id)} />
              ))}
            </View>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { padding: 12, gap: 8 },
  label: { marginTop: 4, fontWeight: "bold" },
});
