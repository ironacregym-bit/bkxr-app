
import Link from "next/link";

export default function BottomNav() {
  return (
    <nav
      className="bxkr-bottomnav"
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(31,30,35,0.85)",
        backdropFilter: "blur(8px)",
        borderRadius: "30px",
        padding: "10px 20px",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        width: "90%",
        maxWidth: "400px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        zIndex: 1000,
      }}
    >
      {[
        { href: "/", icon: "fa-home", label: "Home" },
        { href: "/workout/today", icon: "fa-dumbbell", label: "Workout" },
        { href: "/nutrition", icon: "fa-utensils", label: "Nutrition" },
        { href: "/more", icon: "fa-ellipsis-h", label: "More" },
      ].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="bxkr-bottomnav-link"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textDecoration: "none",
            color: "#fff",
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              transition: "all 0.3s ease",
            }}
            className="nav-icon"
          >
            <i className={`fas ${item.icon}`} style={{ fontSize: "20px" }}></i>
          </div>
          <div style={{ fontSize: "11px", marginTop: 4 }}>{item.label}</div>
        </Link>
      ))}
    </nav>
  );
}
