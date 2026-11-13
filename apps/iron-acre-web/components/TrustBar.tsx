import { Container } from "./ui/container";

export default function TrustBar() {
  return (
    <section className="border-y border-white/10">

      <Container>

        <div
          className="
            flex
            items-center
            justify-center
            gap-4
            overflow-x-auto
            py-5

            text-xs
            uppercase
            tracking-[0.15em]
            whitespace-nowrap
            text-white/60
          "
        >
          <span>Outdoor Gym</span>
          <span>•</span>

          <span>First Class Free</span>
          <span>•</span>

          <span>Mon & Wed 6:30pm</span>
          <span>•</span>

          <span>Coached Sessions</span>
        </div>

      </Container>

    </section>
  );
}
