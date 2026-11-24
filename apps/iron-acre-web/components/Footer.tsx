export default function Footer() {
  return (
    <footer className="bg-[#0f1812] py-10">

      <div className="mx-auto max-w-6xl px-6">

        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

          <div
            className="
              font-['Big_Shoulders_Display']
              text-3xl
              font-black
              uppercase
            "
          >
            Iron Acre Gym
          </div>

          <div className="text-white/60">
            Westerfield, Ipswich
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70"
          >
            <a href="/winter-arc" className="hover:text-white">
              Winter Arc 2027
            </a>
            <a href="/#location" className="hover:text-white">
              Location
            </a>
          </nav>

        </div>

      </div>

    </footer>
  );
}
