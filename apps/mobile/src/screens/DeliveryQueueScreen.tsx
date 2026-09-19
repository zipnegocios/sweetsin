import { useEffect, useState } from "react";
import { View, Text, Button, FlatList } from "react-native";
import { apiFetch } from "../api/client";

type AssignedOrder = { id: string; deliveryAddress: string | null };

export function DeliveryQueueScreen() {
  const [orders, setOrders] = useState<AssignedOrder[]>([]);

  async function loadAssigned() {
    const res = await apiFetch("/api/mobile/orders/assigned");
    if (res.ok) {
      const data = (await res.json()) as { orders: AssignedOrder[] };
      setOrders(data.orders);
    }
  }

  useEffect(() => {
    loadAssigned();
  }, []);

  async function deliver(orderId: string) {
    await apiFetch(`/api/mobile/orders/${orderId}/deliver`, { method: "PATCH" });
    loadAssigned();
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View>
          <Text>{item.deliveryAddress ?? "Direccion no especificada"}</Text>
          <Button title="Marcar entregado" onPress={() => deliver(item.id)} />
        </View>
      )}
    />
  );
}
