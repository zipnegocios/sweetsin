import { useEffect, useState } from "react";
import { View, Text, Button, FlatList } from "react-native";
import { apiFetch } from "../api/client";

type QueueOrder = { id: string; customerName: string; fulfillmentStatus: string };

export function DespachadorQueueScreen() {
  const [orders, setOrders] = useState<QueueOrder[]>([]);

  async function loadQueue() {
    const res = await apiFetch("/api/mobile/orders/queue");
    if (res.ok) {
      const data = (await res.json()) as { orders: QueueOrder[] };
      setOrders(data.orders);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  async function advance(orderId: string, status: "in_prep" | "ready_for_pickup") {
    await apiFetch(`/api/mobile/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    loadQueue();
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View>
          <Text>{item.customerName} — {item.fulfillmentStatus}</Text>
          {item.fulfillmentStatus === "received" && <Button title="Empezar preparacion" onPress={() => advance(item.id, "in_prep")} />}
          {item.fulfillmentStatus === "in_prep" && <Button title="Marcar listo" onPress={() => advance(item.id, "ready_for_pickup")} />}
        </View>
      )}
    />
  );
}
