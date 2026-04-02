"use client";

import Link from "next/link";

export default function BookingCancelPage() {
  return (
    <main className="container py-5" style={{ color: "#fff" }}>
      <h1>Payment cancelled</h1>

      <p className="mt-3">
        No payment was taken. You can try again or pay on the day.
      </p>

      <div className="mt-4 d-flex gap-2">
        <Link href="/schedule" className="btn btn-bxkr">
          Back to schedule
        </Link>
        <Link href="/" className="btn btn-bxkr-outline">
          Home
        </Link>
      </div>
    </main>
  );
}
