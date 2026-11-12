import { useState } from "react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

export default function CoachingLeadCapture() {
  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
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
          result.error
        );
      }

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
      <div className="text-white/80">
        Application received.
        We'll be in touch soon.
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
        onChange={(e) =>
          setName(
            e.target.value
          )
        }
      />

      <Input
        placeholder="Email address"
        value={email}
        onChange={(e) =>
          setEmail(
            e.target.value
          )
        }
      />

      <Button
        type="submit"
        className="
          h-11
          w-full
          bg-[#cc5500]
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
