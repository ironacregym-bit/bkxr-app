export function Container({
  children,
}: any) {
  return (
    <div
      className="
        mx-auto max-w-5xl px-5
      "
    >
      {children}
    </div>
  );
}
