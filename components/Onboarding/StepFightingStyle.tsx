
// components/Onboarding/StepFightingStyle.tsx
import type { UsersDoc } from "./types";

type Props = {
  profile: UsersDoc;
  setProfile: (updater: (p: UsersDoc) => UsersDoc) => void;
  markDirty: () => void;
  availableHeight: number; // px
};

export default function StepFightingStyle({ profile, setProfile, markDirty, availableHeight }: Props) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minHeight: availableHeight,
      }}
    >
      <div className="px-3"><h5 className="mb-2">Fighting Style</h5></div>

      <div
        style={{
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {[
          { key: "boxing", src: "/boxing.jpg", title: "Boxing", sub: "Purely punch‑based. Master the sweet science of speed & precision." },
          { key: "kickboxing", src: "/kickboxing.jpg", title: "Kickboxing", sub: "Punches, kicks & knees. Total‑body power and athletic footwork." },
        ].map((opt) => {
          const selected = profile.fighting_style === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              style={{
                flex: "1 1 0",
                minHeight: 0,
                border: "none",
                padding: 0,
                backgroundImage: `url(${opt.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                position: "relative",
                cursor: "pointer",
              }}
              onClick={() =>
                setProfile((prev) => {
                  markDirty();
                  return { ...prev, fighting_style: opt.key as UsersDoc["fighting_style"] };
                })
              }
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "flex-end",
                  padding: "14px 16px",
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
                  color: "#fff",
                  opacity: selected ? 1 : 0,
                  transition: "opacity .18s ease",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{opt.title}</div>
                  <div className="text-dim">{opt.sub}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
       </section>
  );
}
