// components/ui/container.tsx

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function Container({
  children,
  className = "",
}: ContainerProps) {
  return (
    <div
      className={`
        mx-auto
        max-w-5xl
        px-5
        ${className}
      `}
    >
      {children}
    </div>
  );
}
