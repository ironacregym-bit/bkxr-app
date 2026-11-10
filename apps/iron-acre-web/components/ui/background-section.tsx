interface BackgroundSectionProps {
  image: string;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
}

export function BackgroundSection({
  image,
  children,
  className = "",
  overlayClassName = `
    bg-gradient-to-b
    from-black/70
    via-black/55
    to-black/80
  `,
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
          bg-no-repeat
          scale-105
        "
        style={{
          backgroundImage: `url(${image})`,
        }}
      />

      <div
        className={`
          absolute
          inset-0
          ${overlayClassName}
        `}
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
