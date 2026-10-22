export interface DeliverCommand {
  orderId: string;
  createdAt: number;
}

export interface CommandStore {
  list(): Promise<DeliverCommand[]>; // ordenado por createdAt ascendente
  add(command: DeliverCommand): Promise<void>;
  remove(orderId: string): Promise<void>;
}

export type SendResult =
  | { kind: "ok" }
  | { kind: "retry" }
  | { kind: "unauthorized" }
  | { kind: "conflict"; reason: string };

export interface FlushReport {
  synced: string[];
  conflicts: { orderId: string; reason: string }[];
  remaining: number;
  unauthorized: boolean;
}

export async function enqueueDeliver(
  store: CommandStore,
  orderId: string,
  now: () => number = Date.now,
): Promise<DeliverCommand> {
  const existing = (await store.list()).find((c) => c.orderId === orderId);
  if (existing) return existing;
  const command = { orderId, createdAt: now() };
  await store.add(command);
  return command;
}

export async function flushQueue(
  store: CommandStore,
  send: (command: DeliverCommand) => Promise<SendResult>,
): Promise<FlushReport> {
  const report: FlushReport = { synced: [], conflicts: [], remaining: 0, unauthorized: false };
  const commands = await store.list();
  for (const [i, command] of commands.entries()) {
    const result = await send(command);
    if (result.kind === "retry" || result.kind === "unauthorized") {
      report.unauthorized = result.kind === "unauthorized";
      report.remaining = commands.length - i;
      return report;
    }
    await store.remove(command.orderId);
    if (result.kind === "ok") report.synced.push(command.orderId);
    else report.conflicts.push({ orderId: command.orderId, reason: result.reason });
  }
  return report;
}
