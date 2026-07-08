import Link from "next/link";
import type { SetProfile, UsersDoc } from "./onboardingTypes";

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

export default function ParqBillingStep({
  profile,
  setProfile,
}: {
  profile: UsersDoc;
  setProfile: SetProfile;
}) {

  return (
    <>

      <section className="ia-tile ia-tile-pad mb-3">
        <div className="ia-kicker">
          <i className="fas fa-credit-card" />
          billing
        </div>

        <div className="ia-card-title-compact mt-2">Choose your billing setup</div>

        <div className="text-dim small mt-1">
          This sets how bookings and membership payments are handled.
        </div>

        <div className="d-grid gap-2 mt-3">
          {profile.user_type === "gym" ? (
            <>
              <ChoiceButton
                selected={
                  profile.billing_plan === "gym_monthly" &&
                  profile.payment_method_type === "direct_debit"
                }
                title="Gym monthly membership"
                subtitle="Use Direct Debit for monthly gym membership payments."
                onClick={() =>
                  setProfile((prev) => ({
                    ...prev,
                    billing_plan: "gym_monthly",
                    payment_method_type: "direct_debit",
                    direct_debit_status: prev.direct_debit_status || "not_started",
                    direct_debit_provider: prev.direct_debit_provider || "gocardless",
                  }))
                }
              />

              <ChoiceButton
                selected={
                  profile.billing_plan === "pay_as_you_go" &&
                  profile.payment_method_type === "cash"
                }
                title="Pay on the day"
                subtitle="Bookings can be paid for by cash when attending."
                onClick={() =>
                  setProfile((prev) => ({
                    ...prev,
                    billing_plan: "pay_as_you_go",
                    payment_method_type: "cash",
                    direct_debit_status: null,
                    direct_debit_provider: null,
                    direct_debit_setup_url: null,
                  }))
                }
              />

              <ChoiceButton
                selected={
                  profile.billing_plan === "pay_in_advance" &&
                  profile.payment_method_type === "advance"
                }
                title="Pay in advance"
                subtitle="Bookings are paid in advance rather than covered by monthly membership."
                onClick={() =>
                  setProfile((prev) => ({
                    ...prev,
                    billing_plan: "pay_in_advance",
                    payment_method_type: "advance",
                    direct_debit_status: null,
                    direct_debit_provider: null,
                    direct_debit_setup_url: null,
                  }))
                }
              />

              <ChoiceButton
                selected={profile.billing_plan === "founders"}
                title="Founders membership"
                subtitle="Founder member setup for launch offers or founding memberships."
                onClick={() =>
                  setProfile((prev) => ({
                    ...prev,
                    billing_plan: "founders",
                    payment_method_type: "direct_debit",
                    direct_debit_status: prev.direct_debit_status || "not_started",
                    direct_debit_provider: prev.direct_debit_provider || "gocardless",
                  }))
                }
              />
            </>
          ) : (
            <ChoiceButton
              selected={
                profile.billing_plan === "online_monthly" &&
                profile.payment_method_type === "stripe"
              }
              title="Online monthly membership"
              subtitle="Use Stripe billing for online training and app access."
              onClick={() =>
                setProfile((prev) => ({
                  ...prev,
                  billing_plan: "online_monthly",
                  payment_method_type: "stripe",
                  direct_debit_status: null,
                  direct_debit_provider: null,
                  direct_debit_setup_url: null,
                }))
              }
            />
          )}
        </div>
      </section>
    </>
  );
}
