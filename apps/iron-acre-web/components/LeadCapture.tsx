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
      <Card
        className="
          border-[#cc5500]
          bg-[#1b231c]
        "
      >
        <h3
          className="
            mb-4
            font-['Big_Shoulders_Display']
            text-5xl
            font-black
            uppercase
            text-[#cc5500]
          "
        >
          You're In.
        </h3>

        <p className="mb-4 text-white/80">
          We've saved your details
          and will be in touch shortly.
        </p>

        <p className="text-white/60">
          Keep an eye on your inbox.
        </p>
      </Card>
    );
  }

  return (
    <Card
      className="
        border-white/10
        bg-[#141a15]/80
        backdrop-blur-md
      "
    >
      <form onSubmit={handleSubmit}>

        <h3
          className="
            mb-2
            font-['Big_Shoulders_Display']
            text-4xl
            font-black
            uppercase
            leading-none
          "
        >
          Start Your
          <br />
          Free Week
        </h3>

        <p className="mb-6 text-white/70">
          Join the Iron Acre community,
          train outdoors and claim your
          first class free.
        </p>

        <div className="space-y-4">

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

        </div>

        <div className="mt-5">

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading
              ? "Claiming..."
              : "Claim Free Class"}
          </Button>

        </div>

        {error && (
          <p className="mt-4 text-red-400">
            {error}
          </p>
        )}

      </form>
    </Card>
  );
}
