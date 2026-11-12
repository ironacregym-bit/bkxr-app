import { Container } from "./ui/container";

export default function TrustBar() {
  return (
    <section className="border-y border-white/10">

      <Container>

        <div
          className="
            flex
            flex-wrap
            items-center
            justify-center
            gap-x-8
            gap-y-3
            py-6

            text-sm
            uppercase
            tracking-[0.15em]
            text-white/60
          "
        >
          <span>Outdoor Gym</span>

          <span className="hidden md:block">•</span>

          <span>First Class Free</span>

          <span className="hidden md:block">•</span>

          <span>Mon & Wed 6:30pm</span>

          <span className="hidden md:block">•</span>

          <span>Coached Sessions</span>
        </div>

      </Container>

    </section>
  );
}
