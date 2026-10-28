const SIZES = { sm: "size-9 text-xs", md: "size-12 text-sm", xl: "size-32 text-3xl" } as const;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

// <img> plano: la URL es una firma temporal de R2 en otro dominio, no una imagen optimizable por next/image.
export function StaffAvatar({ name, photoUrl, size = "md" }: { name: string; photoUrl: string | null; size?: keyof typeof SIZES }) {
  return photoUrl ? (
    <img src={photoUrl} alt={name} className={`${SIZES[size]} shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm`} />
  ) : (
    <span
      aria-label={name}
      className={`${SIZES[size]} grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy to-navy-light font-semibold text-gold-light ring-2 ring-white shadow-sm`}
    >
      {initials(name)}
    </span>
  );
}
