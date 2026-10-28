import type { ComponentType, SVGProps } from "react";
import { getTranslations } from "next-intl/server";
import {
  ClockIcon,
  CheckIcon,
  ChefIcon,
  BoxIcon,
  TruckIcon,
  XIcon,
  UndoIcon,
} from "./admin-icons";

type Status =
  | "pending"
  | "received"
  | "in_prep"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "paid"
  | "failed"
  | "refunded";

// Color + icono + texto: el estado nunca depende solo del color.
const STYLES: Record<Status, { icon: ComponentType<SVGProps<SVGSVGElement>>; tone: string }> = {
  pending: { icon: ClockIcon, tone: "bg-gold/15 text-[#8A611C]" },
  received: { icon: BoxIcon, tone: "bg-navy-light/10 text-navy-light" },
  in_prep: { icon: ChefIcon, tone: "bg-gold-light/30 text-[#7A5410]" },
  ready_for_pickup: { icon: CheckIcon, tone: "bg-emerald-500/12 text-emerald-700" },
  out_for_delivery: { icon: TruckIcon, tone: "bg-navy-light/12 text-navy-light" },
  delivered: { icon: CheckIcon, tone: "bg-emerald-500/12 text-emerald-700" },
  cancelled: { icon: XIcon, tone: "bg-navy/8 text-navy/60" },
  paid: { icon: CheckIcon, tone: "bg-emerald-500/12 text-emerald-700" },
  failed: { icon: XIcon, tone: "bg-sin-red/12 text-sin-red-dark" },
  refunded: { icon: UndoIcon, tone: "bg-navy/8 text-navy/60" },
};

export async function StatusBadge({ status }: { status: Status }) {
  const t = await getTranslations("admin");
  const { icon: Icon, tone } = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${tone}`}>
      <Icon width={14} height={14} />
      {t(`status_${status}`)}
    </span>
  );
}
