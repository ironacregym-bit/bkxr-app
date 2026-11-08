import Hero from "../components/Hero";
import TrustBar from "../components/TrustBar";
import MeetRob from "../components/MeetRob";
import FarmStrength from "../components/FarmStrength";
import GymWithAView from "../components/GymWithAView";
import Community from "../components/Community";

export default function Home() {
  return (
    <>
      <Hero />

      <TrustBar />

      <GymWithAView />

      <MeetRob />

      <FarmStrength />

      <Community />

      <Testimonials />

      <Faq />
    </>
  );
}
