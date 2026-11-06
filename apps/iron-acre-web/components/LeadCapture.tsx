import { useState } from "react";

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
      <div className="ia-lead-success">
        <h3>
          You're In.
        </h3>

        <p>
          We've saved your details.
          We'll be in touch about
          your free class and next
          steps.
        </p>

        <p className="ia-fine">
          Keep an eye on your inbox.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="ia-lead-form"
    >
      <h3>
        Claim Your Free Class
      </h3>

      <p>
        Join the Iron Acre
        community and book your
        first session free.
      </p>

      <input
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

      <input
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

      <button
        type="submit"
        className="ia-btn"
        disabled={loading}
      >
        {loading
          ? "Submitting..."
          : "Claim Free Class"}
      </button>

      {error && (
        <p className="ia-error">
          {error}
        </p>
      )}
    </form>
  );
}
