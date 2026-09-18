# Fase 6 — Notificaciones nativas (bilingüe + log de envíos)

## Objetivo

`packages/notifications` deja de ser un esqueleto vacío: adaptador SMTP
propio (nodemailer) para confirmaciones de orden y recibos de cotización de
evento, con contenido bilingüe (inglés/español) según la preferencia real
del destinatario. Se agrega una preferencia de idioma persistida en la
cuenta del cliente, una página de configuración de cuenta, y un log
persistido de cada intento de envío, visible en el panel admin. Scaffold de
Expo push queda listo sin consumidor real (Fase 7).

Sin credenciales SMTP reales disponibles al escribir esta spec: el
adaptador se construye completo y listo para conectar, señalando el bloqueo
explícitamente — nunca simula un envío exitoso (mismo patrón congelado para
Stripe en Fase 3).

## Alcance

### 1. Preferencia de idioma del usuario (`packages/domain/src/users`)

- `entities.ts`: se agrega `preferredLocale: Locale` a `User` (tipo
  `Locale` reusado de `packages/i18n`, no duplicado).
- `ports.ts`: se agrega `update(id: string, data: Partial<Pick<User,
  "preferredLocale">>): Promise<User>` a `UserRepository`. Acotado a lo que
  hace falta hoy — no un update genérico abierto a todos los campos.
- `use-cases.ts` (+ test): nuevo caso de uso `updateUserPreferredLocale(repo,
  userId, locale)`.
- `registerCustomer` (ya existente): recibe `preferredLocale` como
  parámetro nuevo y lo persiste al crear el usuario — la Server Action de
  registro lo completa con el locale de la página en el momento del
  registro (`useLocale()` de next-intl).

### 2. DB (`packages/db`)

- Migración: columna `preferred_locale` (`text`, `not null`, `default
  'en'`) en `users`, aplicada vía `pnpm --filter @workspace/db run push`.
- `DrizzleUserRepository.update()` implementado + test de integración.
- `packages/db/src/seed.ts`: el admin sembrado (`ADMIN_SEED_EMAIL`) recibe
  `preferredLocale: "en"` explícito — no cambia el comportamiento actual
  del seed para nada más.

### 3. Sesión de Auth.js

- `apps/web/src/types/next-auth.d.ts`: `Session.user.preferredLocale` y
  `JWT.preferredLocale`, mismo patrón que `role`.
- `apps/web/src/auth.ts`: callbacks `jwt`/`session` populan
  `preferredLocale` desde la fila de `users` (igual que ya hacen con
  `role`/`isActive`).

### 4. Cuenta de cliente — layout compartido + configuración

- `apps/web/src/app/[locale]/account/layout.tsx` (nuevo): guard de sesión
  centralizado (hoy vive duplicado si hubiera más de una página bajo
  `account/`), con nav simple entre "Mis pedidos" y "Configuración".
- `apps/web/src/app/[locale]/account/orders/page.tsx`: pierde su propio
  guard de sesión — ya lo cubre el layout. Sin cambios de contenido.
- `apps/web/src/app/[locale]/account/settings/page.tsx` (nuevo): Server
  Component que lee la sesión y renderiza `<AccountSettingsForm
  currentLocale={session.user.preferredLocale} />`.
- `apps/web/src/components/account/account-settings-form.tsx` (nuevo):
  radio `en`/`es`, llama `updatePreferredLocaleAction`. Tras guardar, usa
  `update()` del hook de sesión de Auth.js v5 (client-side) para refrescar
  el JWT sin forzar un re-login.
- `apps/web/src/app/actions/account-settings.ts` (nuevo):
  `updatePreferredLocaleAction` — requiere sesión activa, valida el locale
  (`"en" | "es"`), llama `updateUserPreferredLocale`.

### 5. Log de emails enviados (nuevo subdominio en `notifications`)

- `packages/domain/src/notifications/entities.ts` (nuevo):
  ```ts
  export type EmailLogType = "order_confirmation" | "event_quote_receipt";
  export type EmailLogStatus = "sent" | "failed" | "blocked";

  export interface EmailLog {
    id: string;
    to: string;
    type: EmailLogType;
    locale: Locale;
    status: EmailLogStatus;
    errorMessage: string | null;
    createdAt: Date;
  }
  ```
- `packages/domain/src/notifications/ports.ts`: se agrega
  `EmailLogRepository` con `create(entry: Omit<EmailLog, "id" |
  "createdAt">): Promise<EmailLog>` y `listAll(): Promise<EmailLog[]>`.
  `NotificationPort` gana un parámetro `locale: Locale` en cada método
  existente:
  ```ts
  export interface NotificationPort {
    sendOrderConfirmation(order: { customerEmail: string; totalCents: number; id: string }, locale: Locale): Promise<void>;
    sendEventQuoteRequestReceipt(booking: { clientEmail: string; id: string }, locale: Locale): Promise<void>;
  }
  ```
- **Quién escribe el log:** la capa de wiring (`apps/web/src/app/actions/{checkout,event-bookings}.ts`),
  no el adaptador SMTP — mantiene `packages/notifications` sin dependencia
  de DB, consistente con la arquitectura hexagonal ya establecida (el
  adaptador solo sabe enviar; el registro del intento es responsabilidad de
  quien orquesta el caso de uso). Patrón en cada wiring:
  ```ts
  const emailLogs = new DrizzleEmailLogRepository();
  try {
    await notificationAdapter.sendOrderConfirmation(order, locale);
    await emailLogs.create({ to: order.customerEmail, type: "order_confirmation", locale, status: "sent", errorMessage: null });
  } catch (err) {
    await emailLogs.create({
      to: order.customerEmail,
      type: "order_confirmation",
      locale,
      status: err instanceof SmtpNotConfiguredError ? "blocked" : "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
  ```
  Este `try/catch` nunca propaga — la orden/cotización ya persistió antes
  de llegar a este punto y su resultado no debe verse afectado por un
  problema de notificaciones.
- `packages/notifications/src/smtp/errors.ts` (nuevo): `SmtpNotConfiguredError`
  — clase de error dedicada para que el wiring distinga "bloqueado por
  falta de credenciales" de "falló el envío real" sin parsear mensajes.

### 6. DB — tabla `email_logs`

- `packages/db/src/schema/email-logs.ts` (nuevo): columnas `id` (uuid, pk),
  `to` (text), `type` (text), `locale` (text), `status` (text),
  `error_message` (text, nullable), `created_at` (timestamp, default now).
- `packages/db/src/repositories/email-log-repository.ts` (nuevo) + test de
  integración.

### 7. Panel admin — log de emails

- `apps/web/src/app/[locale]/admin/email-logs/page.tsx` (nuevo): tabla de
  solo lectura (destinatario, tipo, locale, estado, fecha), sin filtros
  (alcance mínimo para esta fase).
- `apps/web/src/app/actions/admin-email-logs.ts` (nuevo):
  `listEmailLogsAction`, protegida con `requireAdmin()` (`apps/web/src/lib/require-admin.ts`,
  ya existente desde Fase 5).
- `apps/web/src/app/[locale]/admin/layout.tsx`: se agrega el link a
  "Email logs" en el nav ya existente — puramente aditivo, mismo patrón que
  la nav agregada en Fase 5.

### 8. Adaptadores de notificación

- `packages/notifications/src/smtp/smtp-notification-adapter.ts` (nuevo):
  `SmtpNotificationAdapter implements NotificationPort`, usando
  `nodemailer.createTransport({...})`. Validación **lazy** de
  `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM` — recién
  al invocar un método, nunca en el constructor ni a nivel de módulo (mismo
  patrón que evitó el incidente de build-time de Stripe, Fase 3 Intento
  fallido #13). Si faltan, lanza `SmtpNotConfiguredError` explícito.
- Contenido de los emails: texto plano, dos plantillas por método (EN/ES),
  sin motor de templates nuevo — funciones puras
  `renderOrderConfirmation(order, locale)` /
  `renderEventQuoteReceipt(booking, locale)` que devuelven `{ subject, text }`.
- `packages/notifications/src/expo/expo-notification-adapter.ts` (nuevo):
  `ExpoNotificationAdapter implements NotificationPort` — cada método lanza
  `"Not implemented until Phase 7"`. No se instancia en ningún wiring real
  de esta fase; existe solo para que Fase 7 tenga la clase lista.

### 9. Resolución del locale en el wiring

- `apps/web/src/app/actions/checkout.ts` (`placeOrderAction`):
  - `PlaceOrderInput` gana un campo `locale: Locale`, leído en
    `CheckoutModal` vía `useLocale()` de next-intl y enviado junto al resto
    del payload.
  - Dentro de la Server Action: `const session = await auth(); const
    locale = session?.user?.preferredLocale ?? input.locale;` — si hay
    sesión activa, su preferencia guardada gana; si es invitado, se usa el
    locale de la página. (El pedido sigue sin asociarse a `customerId` —
    esto es solo para elegir el idioma del email, sin tocar la decisión ya
    congelada del carrito 100% de invitado.)
- `apps/web/src/app/actions/event-bookings.ts` (`requestEventQuoteAction`):
  mismo criterio. El locale de página se manda como campo oculto del
  `<form>` (`<input type="hidden" name="locale" value={locale} />` en el
  componente cliente que renderiza el formulario), ya que la Server Action
  no tiene acceso directo a `params.locale` de la ruta.
  - **Nota:** `requestEventQuote` hoy no devuelve el `booking` creado desde
    el caso de uso — se ajusta para devolverlo, y `requestEventQuoteAction`
    captura ese retorno (`const booking = await requestEventQuote(...)`)
    para tener `booking.id` al llamar `sendEventQuoteRequestReceipt`.

## Fuera de alcance (explícito)

- Cualquier bandeja de entrada, IMAP/POP, o webhook de email entrante — el
  sistema sigue siendo 100% saliente. "Log de emails" se refiere únicamente
  a los envíos que el propio sistema origina.
- Filtros, búsqueda o paginación en `/admin/email-logs` — listado simple de
  solo lectura.
- Conexión real de Expo push — scaffold sin consumidor hasta Fase 7.
- Asociar el pedido de checkout a `customerId` cuando hay sesión — decisión
  ya congelada fuera de esta fase; el uso de la sesión aquí es únicamente
  para resolver el idioma del email.
- Envío real de emails con credenciales SMTP conectadas — depende de que
  el owner las provea; hasta entonces cada intento queda logueado con
  `status: "blocked"`.

## Testing

- `packages/domain/src/users`: test de `updateUserPreferredLocale`.
- `packages/domain/src/notifications`: si `EmailLogRepository` no
  encapsula ninguna regla de negocio propia (igual que `settings`), no
  necesita `use-cases.ts` — se documenta esa decisión igual que ya está
  documentada para `settings` en `CLAUDE.md`.
- `packages/db`: tests de integración para `DrizzleUserRepository.update` y
  `DrizzleEmailLogRepository` (`create`/`listAll`).
- `packages/notifications`: primer `vitest.config.ts` del paquete (no
  existía suite hasta ahora). Tests del adaptador SMTP:
  - sin env vars configuradas → lanza `SmtpNotConfiguredError` (nunca
    simula éxito).
  - `renderOrderConfirmation`/`renderEventQuoteReceipt` devuelven el
    contenido correcto para `"en"` y para `"es"`.
- Sin credenciales reales, no hay test de integración de envío SMTP real en
  esta fase.

## Criterios de aceptación

- Un cliente puede cambiar su idioma preferido en `/account/settings` y ese
  valor persiste (verificado tras logout/login).
- Una orden creada por un invitado en `/es` recibe (o loguea como
  bloqueado) un email en español; la misma orden creada en `/` (inglés)
  loguea en inglés.
- Una orden creada por un cliente logueado usa su `preferredLocale`
  guardado, sin importar en qué locale de página estaba parado al hacer el
  checkout.
- Cada intento de envío (orden y cotización de evento) deja una fila en
  `email_logs`, visible en `/admin/email-logs`.
- Sin credenciales SMTP: el checkout y la cotización de evento completan
  normalmente: la orden/booking se persiste, y el log muestra
  `status: "blocked"` con el mensaje explícito — nunca un "enviado" falso.
- `pnpm run typecheck`, `pnpm run test` y `pnpm run build` en verde.

## Archivos nuevos/tocados (resumen)

- `packages/domain/src/users/{entities,ports,use-cases,use-cases.test}.ts`
- `packages/domain/src/notifications/{entities,ports}.ts` (`entities.ts` es
  nuevo)
- `packages/domain/src/event-bookings/{ports,use-cases}.ts` (retorno de
  `requestEventQuote`)
- `packages/db/src/schema/{users,email-logs}.ts`
- `packages/db/src/repositories/{user-repository,email-log-repository}.ts`
  (+ tests)
- `packages/db/src/seed.ts`
- `packages/notifications/src/smtp/{smtp-notification-adapter,errors,templates}.ts`
- `packages/notifications/src/expo/expo-notification-adapter.ts`
- `packages/notifications/vitest.config.ts` (nuevo)
- `apps/web/src/app/[locale]/account/layout.tsx` (nuevo)
- `apps/web/src/app/[locale]/account/orders/page.tsx` (quita guard propio)
- `apps/web/src/app/[locale]/account/settings/page.tsx` (nuevo)
- `apps/web/src/components/account/account-settings-form.tsx` (nuevo)
- `apps/web/src/app/[locale]/admin/email-logs/page.tsx` (nuevo)
- `apps/web/src/app/[locale]/admin/layout.tsx` (link nuevo al nav)
- `apps/web/src/app/actions/{checkout,event-bookings,account-settings,admin-email-logs,register}.ts`
- `apps/web/src/auth.ts`, `apps/web/src/types/next-auth.d.ts`
- `apps/web/src/components/cart/checkout-modal.tsx` (agrega `locale` al
  payload)
- `apps/web/.env.local` (gitignored) — `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `packages/i18n` — namespaces `account` (nuevo o ampliado) y `admin`
  (ampliado) en EN/ES
- `CLAUDE.md` — Run & Operate (env vars SMTP pendientes), Architecture
  decisions (preferencia de idioma, log de emails), Where things live
  (`packages/notifications` deja de estar vacío)
