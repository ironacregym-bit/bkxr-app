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
          "/api/capture",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              formId:
                "coachingLead",

              payload: {
                name,
                email,

                source:
                  "coaching",

                applicationEmailSent:
                  false,

                reviewed:
                  false,
              },
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
        required
      />

      <Input
        type="email"
        placeholder="Email address"
        value={email}
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
