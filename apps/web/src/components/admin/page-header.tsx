export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="admin-enter flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <span className="block h-1 w-10 rounded-full bg-gradient-to-r from-sin-red to-gold mb-3" />
        <h1 className="font-serif font-bold text-navy text-3xl tracking-tight">{title}</h1>
      </div>
      {children}
    </div>
  );
}
