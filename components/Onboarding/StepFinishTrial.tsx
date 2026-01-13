
type Props = {
  subscription_status: string | null | undefined;
  saving: boolean;
  startTrial: () => void;
  finish: () => void;
  ACCENT: string;
  isFirstStep: boolean;
  back: () => void;
};

import { useState } from "react";
import { useSession } from "next-auth/react";

export default function StepFinishTrial({
  subscription_status,
  saving,
  startTrial,
  finish,
  ACCENT,
  isFirstStep,
  back,
}: Props) {
  const showTrial =
    subscription_status !== "active" && subscription_status !== "trialing";

  // Iron Acre member code state (moved into Finish step)
  const { status, data } = useSession();
  const [memberCode, setMemberCode] = useState("");
  const [busyMember, setBusyMember] = useState(false);
  const [memberMsg, setMemberMsg] = useState<string | null>(null);

  async function verifyMemberCode() {
    setMemberMsg(null);
    setBusyMember(true);
    try {
      if (status !== "authenticated" || !data?.user?.email) {
        setMemberMsg("Please sign in first.");
        setBusyMember(false);
        return;
      }

      const res = await fetch("/api/membership/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: memberCode }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMemberMsg(j?.error || "Invalid code.");
        setBusyMember(false);
        return;
      }
      setMemberMsg("Membership applied. You now have Premium via Iron Acre Gym.");
      // Optional: you can call finish() here to exit immediately after success.
      // finish();
    } catch (e: any) {
      setMemberMsg("Failed to verify code. Please try again.");
    } finally {
      setBusyMember(false);
    }
  }

  return (
    <section
      className="futuristic-card p-4 mb-3 d-flex flex-column justify-content-between"
      style={{ minHeight: "65vh" }}
    >
      {/* Premium trial offer (single parent card only) */}
      {showTrial && (
        <div className="mb-3">
          <h5 className="mb-2">Try Premium Features — 14‑Day Free Trial</h5>
          <p className="text-dim">
            Unlock everything in BXKR Premium: advanced boxing & kettlebell
            programming, progress analytics, habit automation, nutrition
            insights, and priority updates.
          </p>
          <ul className="small text-dim mb-3" style={{ paddingLeft: "1.2rem" }}>
            <li>No card required today</li>
            <li>Cancel anytime</li>
            <li>Full premium access for 14 days</li>
          </ul>

          <div className="d-flex gap-2">
            <button
              className="btn btn-bxkr"
              onClick={startTrial}
              disabled={saving}
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                borderRadius: 24,
              }}
            >
              {saving ? "Starting…" : "Start Free Premium Trial"}
            </button>
          </div>
        </div>
      )}

      {/* Iron Acre membership code (inline in Finish step) */}
      <div className="mb-3">
        <h5 className="mb-2">Iron Acre Gym — Member Code</h5>
        <p className="text-dim mb-2">
          If you train in person at Iron Acre Gym, enter your member code to unlock Premium benefits immediately.
        </p>
        <div className="d-flex gap-2">
          <input
            type="text"
            className="form-control"
            placeholder="Enter code"
            value={memberCode}
            onChange={(e) => setMemberCode(e.target.value)}
            aria-label="Iron Acre member code"
          />
          <button
            className="bxkr-btn"
            onClick={verifyMemberCode}
            disabled={busyMember || !memberCode.trim()}
          >
            {busyMember ? "Checking…" : "Apply"}
          </button>
        </div>
        {memberMsg && (
          <div
            className={`mt-2 ${memberMsg.toLowerCase().includes("fail") || memberMsg.toLowerCase().includes("invalid")
              ? "alert alert-danger"
              : "pill-success"}`}
            role="status"
            aria-live="polite"
          >
            {memberMsg}
          </div>
        )}
      </div>

      {/* Completion message (single parent card) */}
      <div className="mb-3">
        <h5 className="mb-2">All Set on the Free Tier</h5>
        <p className="text-dim mb-0">
          Your onboarding details are saved. You’re on the <strong>free tier</strong>:
          core workout tracking and basic features. Upgrade to Premium anytime
          for full plans, deeper analytics, weekly coaching‑style nudges, and
          priority updates. If you’re an Iron Acre Gym member, apply your code above for full access.
        </p>
      </div>

      {/* Local navigation for this step */}
      <div className="d-flex justify-content-between">
        <button
          className="btn btn-bxkr-outline"
          onClick={back}
          disabled={isFirstStep || saving}
        >
          ← Back
        </button>
        <button
          className="btn btn-bxkr"
          onClick={finish}
          disabled={saving}
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
            borderRadius: 24,
          }}
        >
          Finish → Home
          {saving && <span className="inline-spinner ms-2" />}
        </button>
      </div>
    </section>
  );
}
