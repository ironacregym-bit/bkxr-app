import { useState } from "react";

import { Input } from "./ui/input";
import { Button } from "./ui/button";

export default function CoachingLeadCapture() {
  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

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
      const response =
        await fetch(
          "/api/leads/coaching",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              name,
              email,
              source: "coaching",
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to submit"
        );
      }

      setConfirmationEmailSent(
        result.confirmationEmailSent === true
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
      <div className="text-white/70">
        Application received.
        We'll be in touch soon.
        {!confirmationEmailSent && (
          <p
            className="mt-3 text-sm text-white/55"
            role="status"
          >
            Your application is saved, but we couldn't send the confirmation email yet.
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3"
    >
      <Input
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
          ? "Applying..."
          : "Apply For Coaching"}
      </Button>

      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
