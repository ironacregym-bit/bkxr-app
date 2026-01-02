
// components/Onboarding/StepWorkoutType.tsx
import type { UsersDoc } from "./types";

type Props = {
  profile: UsersDoc;
  setProfile: (updater: (p: UsersDoc) => UsersDoc) => void;
  markDirty: () => void;
  availableHeight: number; // px
};

export default function StepWorkoutType({ profile, setProfile, markDirty, availableHeight }: Props) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minHeight: availableHeight,
      }}
    >
      <div className="px-3"><h5 className="mb-2">Workout Type</h5></div>

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
          { key: "bodyweight", src: "/bodyweight.jpg", title: "Bodyweight", sub: "Train anywhere. Own your movement patterns and stability." },
          { key: "kettlebells", src: "/kettlebells.jpg", title: "Kettlebells", sub: "Explosive strength & conditioning. Flow, hinge and press." },
          { key: "dumbbells", src: "/dumbbells.jpg", title: "Dumbbells", sub: "Classic resistance, balanced loading, scalable progressions." },
        ].map((opt) => {
          const selected = profile.workout_type === opt.key;
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
                  return { ...prev, workout_type: opt.key as UsersDoc["workout_type"] };
                })
              }
            >
              {/* Overlay only when selected */}
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
