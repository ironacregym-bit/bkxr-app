import { useState } from "react";

import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export default function LeadCapture() {
  const [name, setName] = useState("");

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
      <Card>

        <h3>
          You're In.
        </h3>

        <p>
          We've saved your details.
          We'll be in touch about your
          free class and next steps.
        </p>

        <p>
          Keep an eye on your inbox.
        </p>

      </Card>
    );
  }

  return (
    <Card>

      <form
        onSubmit={handleSubmit}
      >

        <h3>
          Start Your Free Week
        </h3>

        <p>
          Join the Iron Acre community,
          train outdoors and claim your
          free first class.
        </p>

        <Input
          type="text"
          placeholder="First name"
          value={name}
          onChange={(e) =>
            setName(
              e.target.value
            )
          }
          required
        />

        <div className="h-3" />

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

        <div className="h-4" />

        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading
            ? "Submitting..."
            : "Claim Free Class"}
        </Button>

        {error && (
          <p
            className="mt-4 text-red-400"
          >
            {error}
          </p>
        )}

      </form>

    </Card>
  );
}
