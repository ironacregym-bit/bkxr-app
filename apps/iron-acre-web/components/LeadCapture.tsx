import { useState } from "react";

import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

type LeadCaptureProps = {
  source?: string;
  heading?: string;
  description?: string;
  buttonLabel?: string;
  successHeading?: string;
  successMessage?: string;
  successHref?: string;
  successLinkLabel?: string;
};

export default function LeadCapture({
  source = "hero",
  heading = "Start Free",
  description = "Claim your free class and get instant access to the 7 day program.",
  buttonLabel = "Get My Free Program",
  successHeading = "You're In.",
  successMessage = "Your details have been saved.",
  successHref,
  successLinkLabel,
}: LeadCaptureProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
    useState(false);

  const [confirmationEmailSent, setConfirmationEmailSent] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/leads/create",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            name,
            email,
            source,
          }),
        }
      );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ||
            "Failed to submit"
        );
      }

      setConfirmationEmailSent(
        json.confirmationEmailSent === true
      );
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.message ||
          "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card
        className="
          border
          border-[#cc5500]
          bg-[#1b231c]
          p-5
        "
      >
        <h3
          className="
            mb-3
            font-['Big_Shoulders_Display']
            text-3xl
            font-black
            uppercase
            text-[#cc5500]
          "
        >
          {successHeading}
        </h3>

        <p className="text-white/70">
          {successMessage}
        </p>

        {successHref && successLinkLabel && (
          <a
            href={successHref}
            className="mt-4 inline-flex font-semibold text-[#e98740] underline decoration-white/25 underline-offset-4 hover:text-white"
          >
            {successLinkLabel}
          </a>
        )}

        {!confirmationEmailSent && (
          <p
            className="mt-3 text-sm text-white/55"
            role="status"
          >
            Your signup is saved, but we couldn't send the confirmation email yet.
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card
      className="
        border-white/10
        bg-[#1b231c]
        p-5
      "
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-5">
          <h3
            className="
              mb-2
              font-['Big_Shoulders_Display']
              text-3xl
              font-black
              uppercase
              leading-none
            "
          >
            {heading}
          </h3>

          <p className="text-sm text-white/65">
            {description}
          </p>
        </div>

        <div className="space-y-3">
          <Input
            type="text"
            placeholder="First name"
            value={name}
            maxLength={100}
            autoComplete="given-name"
            onChange={(e) =>
              setName(
                e.target.value
              )
            }
            required
          />

          <Input
            type="email"
            placeholder="Email address"
            value={email}
            maxLength={254}
            autoComplete="email"
            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }
            required
          />

          <Button
            type="submit"
            className="
              h-11
              w-full
              bg-[#cc5500]
              hover:bg-[#db6712]
            "
            disabled={loading}
          >
            {loading
              ? "Submitting..."
              : buttonLabel}
          </Button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}
      </form>
    </Card>
  );
}
