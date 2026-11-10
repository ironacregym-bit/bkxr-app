interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: SectionHeadingProps) {
  return (
    <div className="mb-12">

      <div
        className="
          mb-4
          uppercase
          tracking-[0.15em]
          text-[#cc5500]
          font-bold
        "
      >
        {eyebrow}
      </div>

      <h2
        className="
          mb-6
          font-['Big_Shoulders_Display']
          text-[clamp(3rem,8vw,5rem)]
          font-black
          uppercase
          leading-none
        "
      >
        {title}
      </h2>

      {description && (
        <p className="max-w-3xl text-xl text-white/90">
          {description}
        </p>
      )}

    </div>
  );
}
