interface BackgroundSectionProps {
  image: string;
  children: React.ReactNode;
  className?: string;
}

export function BackgroundSection({
  image,
  children,
  className = "",
}: BackgroundSectionProps) {
  return (
    <section
      className={`
        relative
        overflow-hidden
        py-32
        ${className}
      `}
    >
      <div
        className="
          absolute
          inset-0
          bg-cover
          bg-center
        "
        style={{
          backgroundImage: `url(${image})`,
        }}
      />

      <div
        className="
          absolute
          inset-0
          bg-black/60
        "
      />

      <div
        className="
          relative
          z-10
        "
      >
        {children}
      </div>

    </section>
  );
}
