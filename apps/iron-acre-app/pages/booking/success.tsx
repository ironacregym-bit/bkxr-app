"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function BookingSuccessPage() {
  const params = useSearchParams();
  const bookingId = params.get("booking_id");

  return (
    <main className="container py-5" style={{ color: "#fff" }}>
      <h1>Booking confirmed ✅</h1>

      <p className="mt-3">
        Your place is reserved.
      </p>

      <p className="text-dim">
        {bookingId
          ? "You’ll receive a confirmation message shortly."
          : "If you don’t receive confirmation, please speak to the coach."}
      </p>

      <div className="mt-4">
        <Link href="/schedule" className="btn btn-bxkr">
          Back to schedule
        </Link>
      </div>
    </main>
  );
}
