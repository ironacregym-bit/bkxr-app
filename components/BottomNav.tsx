import Link from "next/link";

export default function BottomNav() {
  return (
      <nav className="navbar fixed-bottom border-top" style={{ background: "rgba(14,13,16,0.95)" }}>
        <div className="container d-flex justify-content-around">
          <Link href="/" className="bxkr-bottomnav-link">
            <i className="fas fa-home fa-lg"></i>
            <div style={{ fontSize: "12px" }}>Home</div>
          </Link>
          <Link href="/workout/today" className="bxkr-bottomnav-link">
            <i className="fas fa-dumbbell fa-lg"></i>
            <div style={{ fontSize: "12px" }}>WoD</div>
          </Link>
          <Link href="/profile" className="bxkr-bottomnav-link">
            <i className="fas fa-user fa-lg"></i>
            <div style={{ fontSize: "12px" }}>Profile</div>
          </Link>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_TRAINER_PHONE || process.env.TRAINER_PHONE}?text=Hi%20Coach%20I%27m%20doing%20BXKR`}
            target="_blank"
            rel="noreferrer"
            className="bxkr-bottomnav-link"
          >
            <i className="fas fa-comments fa-lg"></i>
            <div style={{ fontSize: "12px" }}>Chat</div>
          </a>
        </div>
      </nav>
  );
}
