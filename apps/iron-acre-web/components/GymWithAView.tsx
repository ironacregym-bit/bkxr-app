import Image from "next/image";
import { Container } from "./ui/container";

export default function GymWithAView() {
  return (
    <section className="bg-[#1b231c] py-16">

      <Container>

        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">

          <div>

            <div className="mb-3 uppercase tracking-[0.15em] text-[#cc5500] text-sm font-bold">
              A GYM WITH A VIEW
            </div>

            <h2
              className="
                mb-4
                font-['Big_Shoulders_Display']
                text-[clamp(2.5rem,5vw,4rem)]
                font-black
                uppercase
                leading-none
              "
            >
              Outdoor Strength Training
            </h2>

            <p className="mb-4 text-base text-white/80">
              Iron Acre Gym is an outdoor gym in
              Westerfield overlooking an open meadow.
            </p>

            <p className="text-base text-white/65">
              No mirrors. No waiting for machines.
              Just proper strength training.
            </p>

          </div>

          <div className="relative h-[320px]">

            <Image
              src="/images/GymFrontView.jpeg"
              alt="Outdoor training area at Iron Acre Gym in Westerfield, Ipswich"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="rounded-lg object-cover shadow-xl"
            />

          </div>

        </div>

      </Container>

    </section>
  );
}
