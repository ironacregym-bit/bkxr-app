export default function Community() {
  return (
    <section
      id="community"
      className="py-24"
    >
      <div className="mx-auto max-w-7xl px-6">

        <div className="max-w-3xl mb-12">

          <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
            COMMUNITY
          </div>

          <h2 className="mb-6 font-['Big_Shoulders_Display'] text-[clamp(3rem,8vw,5rem)] font-black uppercase leading-none">
            Nobody Trains
            <br />
            Alone Here.
          </h2>

          <p className="text-xl text-white/90">
            The Iron Acre community is free
            from day one.
          </p>

        </div>

        <div className="grid gap-10 md:grid-cols-3">

          <div className="border-l-4 border-[#cc5500] pl-4">

            <h3 className="mb-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
              Daily Check Ins
            </h3>

            <p className="text-[#a3ad9f]">
              Stay accountable and support
              each other.
            </p>

          </div>

          <div className="border-l-4 border-[#cc5500] pl-4">

            <h3 className="mb-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
              Coach Access
            </h3>

            <p className="text-[#a3ad9f]">
              Get answers and guidance
              from a real coach.
            </p>

          </div>

          <div className="border-l-4 border-[#cc5500] pl-4">

            <h3 className="mb-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
              Challenges
            </h3>

            <p className="text-[#a3ad9f]">
              Monthly events and goals to
              keep progressing.
            </p>

          </div>

        </div>

      </div>
    </section>
  );
}
