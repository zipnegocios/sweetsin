import { motion } from "../tokens/motion";
import { radius } from "../tokens/radius";
import { space } from "../tokens/space";
import { touch } from "../tokens/touch";
import type { Theme, ThemeBase } from "./theme";

export type OrderStatus =
  | "received"
  | "in_prep"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "pending_sync"
  | "evidence_sent";
export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonState = "normal" | "pressed" | "disabled" | "loading";

type ButtonLook = { bg: string; fg: string; border: string | null; opacity: number; underline: boolean };
type PillLook = { glyph: string; bg: string; fg: string; border: string | null; borderWidth: number };

const NONE = "transparent";

function look(bg: string, fg: string, border: string | null = null, opacity = 1, underline = false): ButtonLook {
  return { bg, fg, border, opacity, underline };
}

function pill(glyph: string, bg: string, fg: string, border: string | null = null, borderWidth = 0): PillLook {
  return { glyph, bg, fg, border, borderWidth };
}

/** Tokens de componente: qué token semántico usa cada componente en cada estado (secciones 2.3 y 5). */
export function buildComponentTokens(t: ThemeBase) {
  const c = t.colors;

  const looks: Record<ButtonVariant, Record<ButtonState, ButtonLook>> = {
    primary: {
      normal: look(c.actionFill, c.actionLabel),
      pressed: look(c.actionFill, c.actionLabel, null, 0.85),
      disabled: look(c.tintPressed, c.textQuiet),
      loading: look(c.actionFill, c.actionLabel),
    },
    secondary: {
      normal: look(NONE, c.textPrimary, c.textPrimary),
      pressed: look(c.tintPressed, c.textPrimary, c.textPrimary),
      disabled: look(NONE, c.textQuiet, c.textQuiet),
      loading: look(NONE, c.textPrimary, c.textPrimary),
    },
    ghost: {
      normal: look(NONE, c.link, null, 1, true),
      pressed: look(c.tintPressed, c.link, null, 1, true),
      disabled: look(NONE, c.textQuiet),
      loading: look(NONE, c.link, null, 1, true),
    },
  };

  // Glifos Unicode (regla 2 del owner): ○ ◐ ● → ✓ ✕ ↻ ↑
  const status: Record<OrderStatus, PillLook> = {
    received: pill("○", c.surface, c.textPrimary, c.textPrimary, 1.5),
    in_prep: pill("◐", c.warning, c.textPrimary),
    ready_for_pickup: pill("●", c.warning, c.textPrimary),
    out_for_delivery: pill("→", c.textPrimary, c.actionLabel),
    delivered: pill("✓", c.success, c.actionLabel),
    cancelled: pill("✕", c.danger, c.actionLabel),
    // Borde dorado = refuerzo; el glifo y el texto son los portadores (regla 1 del owner).
    pending_sync: pill("↻", c.surface, c.textPrimary, c.warning, 2),
    evidence_sent: pill("↑", c.surface, c.success, c.success, 1.5),
  };

  return {
    space,
    button: {
      looks,
      radius: radius.pill,
      borderWidth: 2,
      gap: space.sm,
      minHeight: { primary: t.touch.primary, secondary: t.touch.min, ghost: t.touch.min },
      minWidth: t.touch.min,
      paddingH: { primary: space.xl, secondary: space.xl, ghost: space.md },
      pressedScale: motion.pressedScale,
      pressOutMs: motion.pressOutMs,
    },
    card: {
      bg: c.surface,
      border: c.border,
      borderWidth: 1,
      radius: radius.card,
      padding: space.lg,
      gap: space.md,
      enterOffset: motion.enterOffset,
      staggerCap: motion.staggerCap,
    },
    pill: { status, radius: radius.pill, paddingV: space.xs, paddingH: space.md, minHeight: touch.pill },
    banner: {
      bg: c.warning,
      fg: c.textPrimary,
      minHeight: t.touch.min,
      paddingV: space.md,
      paddingH: space.lg,
      gap: space.sm,
    },
    // Campo de texto de las pantallas: borde en textQuiet (llega a 3:1 sobre vanilla), foco en textPrimary.
    field: {
      bg: c.surface,
      border: c.textQuiet,
      borderFocus: c.textPrimary,
      borderWidth: 1,
      borderWidthFocus: 2,
      radius: radius.inner,
      minHeight: t.touch.primary,
      paddingH: space.lg,
      labelGap: space.xs,
      placeholder: c.textQuiet,
    },
    // Fila de elección única (p. ej. repartidor): glifo ●/○ + borde más grueso; el color solo refuerza.
    option: {
      bg: c.surface,
      bgPressed: c.tintPressed,
      border: c.textQuiet,
      borderSelected: c.textPrimary,
      borderWidth: 1,
      borderWidthSelected: 3,
      radius: radius.inner,
      paddingH: space.lg,
      gap: space.sm,
      glyphOn: "●",
      glyphOff: "○",
    },
    // Mapa de la ruta: tramos por velocidad (el texto "con tráfico" de la tarjeta es el portador, no el color).
    map: {
      traffic: { normal: c.actionFill, slow: c.warning, jam: c.danger },
      strokeWidth: 6,
      markerOrigin: c.info,
      markerDestination: c.actionFill,
      heightRatio: 0.4,
      radius: radius.card,
      overlay: { bg: c.surface, border: c.border, borderWidth: 1, radius: radius.inner, padding: space.md, gap: space.xs, inset: space.sm },
    },
    offlineBanner: { glyph: "⊘" }, // ⊘
    header: {
      bg: c.textPrimary,
      fg: c.actionLabel,
      minHeight: touch.header,
      paddingH: space.lg,
      paddingV: space.sm,
      gap: space.sm,
      mascotSize: 32,
      actionPaddingH: space.md,
      actionPressedOpacity: 0.7,
    },
    // Foto del staff: borde fijo y, sin foto (o si falla la descarga), iniciales sobre fondo sólido.
    avatar: {
      bg: c.tintPressed,
      fg: c.textPrimary,
      border: c.actionLabel,
      borderCard: c.textPrimary,
      borderWidth: 2,
      borderWidthCard: 4,
      sizes: { header: 40, card: 148 },
      transitionMs: motion.enterMs,
    },
    // Captura de la foto de perfil dentro de la app: fondo Tinta, círculo guía y disparador grande.
    capture: {
      bg: c.textPrimary,
      fg: c.actionLabel,
      guide: c.actionLabel,
      guideWidth: 4,
      guideFraction: 0.78, // diámetro del círculo guía respecto al lado del visor
      shutterSize: 72,
      shutterRing: 6,
      iconSize: 28,
      iconButtonSize: 56, // misma zona táctil que las acciones primarias
      padding: space.lg,
      gap: space.lg,
    },
    // Credencial: banda Tinta con la marca arriba y la foto que la cruza; el texto lleva la información, el color solo marca.
    credential: {
      bg: c.surface,
      border: c.textPrimary,
      borderWidth: 3,
      radius: radius.card,
      bandBg: c.textPrimary,
      bandFg: c.actionLabel,
      bandHeight: 96,
      bandPaddingH: space.lg,
      bandGap: space.sm,
      markSize: 40,
      bodyPaddingH: space.xl,
      bodyPaddingBottom: space.xxl,
      bodyGap: space.sm,
      avatarOverlap: 40, // la foto solo roza la banda: el nombre de la marca queda libre
      closeInset: space.xs,
      badgeSize: 44,
      badgeBg: c.textPrimary,
      badgeFg: c.actionLabel,
      badgeBorder: c.surface,
      codeBorder: c.textQuiet,
      codeRadius: radius.small,
      codePaddingH: space.md,
      codePaddingV: space.xs,
      maxWidth: 380,
    },
    emptyState: {
      title: c.textPrimary,
      message: c.textQuiet,
      padding: space.xl,
      markGap: space.lg,
      textGap: space.sm,
      markSize: 96,
      maxTextWidth: 320,
    },
    layout: {
      bg: c.background,
      headerBg: c.textPrimary,
      paddingH: space.lg,
      paddingV: space.lg,
      gap: space.md,
      barPadding: space.md,
      barGap: space.sm,
      barBorder: c.border,
    },
  };
}

export type ComponentTokens = ReturnType<typeof buildComponentTokens>;

export function createTheme(base: ThemeBase): Theme {
  return { ...base, components: buildComponentTokens(base) };
}
