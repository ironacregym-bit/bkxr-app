export function Container({
  children,
}: any) {
  return (
    <div
      className="
        mx-auto
        max-w-7xl
        px-6
      "
    >
      {children}
    </div>
  );
}
