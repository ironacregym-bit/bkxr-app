import type {
  GymOption,
  ProgramOption,
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
