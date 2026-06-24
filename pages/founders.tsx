// pages/founders.tsx
"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

type FormState = {

  name: string;import Head from "next/head";
  email: string;
  phone: string;
  interested_classes: string[];
  preferred_times: string[];
  sessions_per_week: string;
  biggest_goal: string;
  referral_name: string;
  referral_contact: string;
  consent_to_contact: boolean;
};

const CLASS_OPTIONS = [
  "Hybrid Fit",
  "Kettlebells",
  "Farm Strength",
  "Boxing Conditioning",
] as const;

const TIME_OPTIONS = [
  "Early Morning",
  "Midday",
  "Evening",
  "Weekends",
] as const;

const SESSION_OPTIONS = ["1", "2", "3", "4+"] as const;

const GOAL_OPTIONS = [
  "Fitness",
  "Strength",
  "Weight Loss",
  "Confidence",
  "Community",
  "Something Different",
] as const;

const initialForm: FormState = {
  name: "",
  email: "",
  phone: "",
  interested_classes: [],
  preferred_times: [],
  sessions_per_week: "",
  biggest_goal: "",
  referral_name: "",
  referral_contact: "",
  consent_to_contact: true,
};

function toggleArrayValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function FoundersPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return Boolean(
      form.name.trim() &&
        form.email.trim() &&
        form.interested_classes.length > 0 &&
        form.preferred_times.length > 0 &&
        form.sessions_per_week &&
        form.biggest_goal &&
        form.consent_to_contact
    );
  }, [form]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitted(false);

    if (!canSubmit) {
      setError("Please complete the required fields before submitting.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch("/api/founders/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to submit form");
      }

      setSubmitted(true);
      setForm(initialForm);
    } catch (err: any) {
      setError(err?.message || "Something went wrong submitting the form.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Founding Members • Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3 iron-acre-home" style={{ paddingBottom: 32 }}>
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-kicker">
            <i className="fas fa-seedling" />
            founding members
          </div>

          <div className="ia-page-title mt-2">Founding Members</div>
          <div className="ia-page-subtitle mt-1">
            Help shape Iron Acre Gym before launch and tell us what sessions you’d actually want.
          </div>

          <div className="text-dim small mt-3">
            We’re building something different — outdoor training, strength work, kettlebells,
            boxing conditioning and a proper community feel.
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-card-title-compact">A few quick questions</div>
          <div className="text-dim small mt-1">
            Fill this in once and we’ll use it to shape the timetable and early member offer.
          </div>

          {submitted ? (
            <div className="ia-inline-note-success mt-3">
              Thanks — your response has been submitted.
            </div>
          ) : null}

          {error ? <div className="ia-inline-note-error mt-3">{error}</div> : null}

          <form onSubmit={handleSubmit} className="mt-3">
            <div className="mb-3">
              <label className="form-label text-white fw-semibold">Your name *</label>
              <input
                className="form-control"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Your name"
              />
            </div>

            <div className="mb-3">
              <label className="form-label text-white fw-semibold">Email *</label>
              <input
                type="email"
                className="form-control"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com"
              />
            </div>

            <div className="mb-4">
              <label className="form-label text-white fw-semibold">Phone (optional)</label>
              <input
                className="form-control"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="Phone number"
              />
            </div>

            <div className="mb-4">
              <div className="fw-semibold text-white mb-2">
                Which classes interest you most? *
              </div>
              <div className="d-flex flex-wrap gap-2">
                {CLASS_OPTIONS.map((option) => {
                  const active = form.interested_classes.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      className={active ? "ia-btn ia-btn-primary" : "ia-btn ia-btn-muted"}
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          interested_classes: toggleArrayValue(p.interested_classes, option),
                        }))
                      }
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <div className="fw-semibold text-white mb-2">What times would suit you best? *</div>
              <div className="d-flex flex-wrap gap-2">
                {TIME_OPTIONS.map((option) => {
                  const active = form.preferred_times.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      className={active ? "ia-btn ia-btn-primary" : "ia-btn ia-btn-muted"}
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          preferred_times: toggleArrayValue(p.preferred_times, option),
                        }))
                      }
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <div className="fw-semibold text-white mb-2">
                How many sessions per week would you realistically attend? *
              </div>
              <div className="d-flex flex-wrap gap-2">
                {SESSION_OPTIONS.map((option) => {
                  const active = form.sessions_per_week === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={active ? "ia-btn ia-btn-primary" : "ia-btn ia-btn-muted"}
                      onClick={() => setForm((p) => ({ ...p, sessions_per_week: option }))}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <div className="fw-semibold text-white mb-2">
                What&apos;s the biggest thing you&apos;re looking for from a gym? *
              </div>
              <div className="d-flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((option) => {
                  const active = form.biggest_goal === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={active ? "ia-btn ia-btn-primary" : "ia-btn ia-btn-muted"}
                      onClick={() => setForm((p) => ({ ...p, biggest_goal: option }))}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <hr className="border-light border-opacity-10 my-4" />

            <div className="ia-card-title-compact">Founding Member Referral Offer</div>
            <div className="text-dim small mt-2">
              As a thank you for supporting Iron Acre before launch, we’re introducing a Founding
              Member Referral Offer.
            </div>

            <ul className="text-dim small mt-3 mb-3">
              <li>You get your first 2 months at 50% off</li>
              <li>They get their first 2 months at 50% off</li>
            </ul>

            <div className="mb-3">
              <label className="form-label text-white fw-semibold">
                Friend&apos;s name (optional)
              </label>
              <input
                className="form-control"
                value={form.referral_name}
                onChange={(e) => setForm((p) => ({ ...p, referral_name: e.target.value }))}
                placeholder="Friend's name"
              />
            </div>

            <div className="mb-4">
              <label className="form-label text-white fw-semibold">
                Friend&apos;s email or phone (optional)
              </label>
              <input
                className="form-control"
                value={form.referral_contact}
                onChange={(e) => setForm((p) => ({ ...p, referral_contact: e.target.value }))}
                placeholder="Email or phone"
              />
            </div>

            <div className="form-check mb-4">
              <input
                id="consent_to_contact"
                type="checkbox"
                className="form-check-input"
                checked={form.consent_to_contact}
                onChange={(e) =>
                  setForm((p) => ({ ...p, consent_to_contact: e.target.checked }))
                }
              />
              <label htmlFor="consent_to_contact" className="form-check-label text-dim small">
                I&apos;m happy for Iron Acre Gym to contact me about classes, launch updates and the
                founding member offer.
              </label>
            </div>

            <button
              type="submit"
              className="ia-btn ia-btn-primary w-100"
              disabled={!canSubmit || submitting}
            >
              {submitting ? "Submitting..." : "Submit my interest"}
            </button>
          </form>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-center gap-2">
            <div>
              <div className="ia-card-title-compact">Want to see the main site?</div>
              <div className="text-dim small mt-1">
                View the main Iron Acre Gym home page and offer.
              </div>
            </div>

            <Link href="/iron-acre" className="ia-btn ia-btn-muted">
              Home
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

