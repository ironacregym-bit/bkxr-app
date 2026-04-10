import { useRouter } from "next/router";
import IronAcreTaskCard from "./IronAcreTaskCard";

export default function IronAcreTasks() {
  const router = useRouter();

  return (
    <div className="mb-3">
      <IronAcreTaskCard
        title="How are you feeling?"
        subtitle="Quick readiness check before training"
        ctaLabel="Check in"
        onCta={() => router.push("/checkin")}
      />

      <IronAcreTaskCard
        title="Today’s gym session"
        subtitle="Start your programmed strength session"
        ctaLabel="Start"
        onCta={() => router.push("/iron-acre/session")}
        rightMeta="Gym"
      />

      <IronAcreTaskCard
        title="Update your 1RMs"
        subtitle="Keep your maxes current so % loads stay accurate"
        ctaLabel="1RMs"
        onCta={() => router.push("/iron-acre/strength")}
      />
    </div>
  );
}
