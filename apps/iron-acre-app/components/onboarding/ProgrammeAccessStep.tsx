import type {
  GymOption,
  ProgramOption,
  ProgramStartMode,
  SetProfile,
  UsersDoc,
} from "./onboardingTypes";

function ChoiceButton({
  selected,
  title,
  subtitle,
  onClick,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={selected ? "ia-onb-choice ia-onb-choice-selected" : "ia-onb-choice"}
      onClick={onClick}
    >
      <span className="ia-onb-choice-title">{title}</span>
      <span className="ia-onb-choice-subtitle">{subtitle}</span>
    </button>
  );
}

function formatGbDate(value: Date) {
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getNextMonday() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);

  const day = d.getDay();
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;

  d.setDate(d.getDate() + daysUntilMonday);
  return d;
}

function getToday() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

export default function ProgrammeAccessStep({
  profile,
  programs,
  gyms,
  programsLoading,
  gymsLoading,
  setProfile,
}: {
  profile: UsersDoc;
  programs: ProgramOption[];
  gyms: GymOption[];
  programsLoading: boolean;
  gymsLoading: boolean;
  setProfile: SetProfile;
}) {
  const selectedStartMode: ProgramStartMode = profile.program_start_mode || "next_monday";
  const todayText = formatGbDate(getToday());
  const nextMondayText = formatGbDate(getNextMonday());

  return (
    <>
      <section className="ia-tile ia-tile-pad mb-3">
        <div className="mb-3">
          <div className="ia-card-title-compact">Choose your programme</div>
          <div className="text-dim small mt-1">
            Programmes are pulled from Firestore.
          </div>
        </div>

        {programsLoading ? (
          <div className="text-dim small">Loading programmes…</div>
        ) : programs.length ? (
          <div className="d-grid gap-2">
            {programs.map((program) => {
              const selected =
                profile.program_id === program.program_id || profile.program_id === program.id;

              return (
                <ChoiceButton
                  key={program.id}
                  selected={selected}
                  title={program.title}
                  subtitle={program.subtitle}
                  onClick={() =>
                    setProfile((prev) => ({
                      ...prev,
                      program_id: program.program_id || program.id,
                      program_name: program.title,
                      workout_type: program.program_id || program.id,
                      program_start_mode: prev.program_start_mode || "next_monday",
                    }))
                  }
                />
              );
            })}
          </div>
        ) : (
          <div className="text-dim small">No programmes are available yet.</div>
        )}
      </section>

      <section className="ia-tile ia-tile-pad mb-3">
        <div className="mb-3">
          <div className="ia-card-title-compact">When should this programme start?</div>
          <div className="text-dim small mt-1">
            Default is next Monday so Week 1 starts cleanly. You can start today if you want
            immediate access.
          </div>
        </div>

        <div className="d-grid gap-2">
          <ChoiceButton
            selected={selectedStartMode === "next_monday"}
            title={`Start next Monday • ${nextMondayText}`}
            subtitle="Recommended. Week 1 begins on this date and stays Week 1 for the first 7 days."
            onClick={() =>
              setProfile((prev) => ({
                ...prev,
                program_start_mode: "next_monday",
              }))
            }
          />

          <ChoiceButton
            selected={selectedStartMode === "today"}
            title={`Start today • ${todayText}`}
            subtitle="Use this if the member needs access to Week 1 immediately."
            onClick={() =>
              setProfile((prev) => ({
                ...prev,
                program_start_mode: "today",
              }))
            }
          />
        </div>
      </section>

      <section className="ia-tile ia-tile-pad mb-3">
        <div className="mb-3">
          <div className="ia-card-title-compact">How will you use Iron Acre?</div>
          <div className="text-dim small mt-1">
            Gym locations are pulled from Firestore.
          </div>
        </div>

        <div className="d-grid gap-2">
          {gymsLoading ? <div className="text-dim small">Loading gyms…</div> : null}

          {gyms.map((gym) => {
            const selected = profile.user_type === "gym" && profile.gym_id === gym.id;

            return (
              <ChoiceButton
                key={gym.id}
                selected={selected}
                title={gym.title}
                subtitle={gym.subtitle}
                onClick={() =>
                  setProfile((prev) => ({
                    ...prev,
                    user_type: "gym",
                    membership_status: "gym_member",
                    gym_id: gym.id,
                    gym_name: gym.title,
                    parq_status: prev.parq_status || "not_started",
                  }))
                }
              />
            );
          })}

          <ChoiceButton
            selected={profile.user_type === "online"}
            title="Online user"
            subtitle="Use Iron Acre for digital coaching, workouts and nutrition without gym class updates."
            onClick={() =>
              setProfile((prev) => ({
                ...prev,
                user_type: "online",
                membership_status: "online_user",
                gym_id: null,
                gym_name: null,
                parq_status: null,
                parq_completed_at: null,
              }))
            }
          />
        </div>
      </section>
    </>
  );
}
