import {
  useState,
} from "react";

export default function LeadCapture() {
  const [
    email,
    setEmail,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    success,
    setSuccess,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

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
              email,
            }),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.error
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
          You're in.
        </h3>

        <p>
          Check your email for the
          next steps.
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
        Start Your Free Week
      </h3>

      <input
        type="email"
        value={email}
        placeholder="Your email"
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
          : "Start Free"}
      </button>

      {error && (
        <p
          style={{
            color:
              "#ff6b6b",
          }}
        >
          {error}
        </p>
      )}

    </form>
  );
}
