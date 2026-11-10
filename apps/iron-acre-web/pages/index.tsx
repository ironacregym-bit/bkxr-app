import Hero from "../components/Hero";
import TrustBar from "../components/TrustBar";
import GymWithAView from "../components/GymWithAView";
import FarmStrength from "../components/FarmStrength";
import Community from "../components/Community";
import HowItWorks from "../components/HowItWorks";
import Coaching from "../components/Coaching";
import Testimonials from "../components/Testimonials";
import Faq from "../components/Faq";
import Location from "../components/Location";
import FreeProgram from "../components/FreeProgram";

export default function Home() {
  return (
    <>
  <div className="mx-auto max-w-[1800px] px-4 lg:px-8">
    <Hero />
  
    <TrustBar />
  
    <GymWithAView />
  
    <FarmStrength />
  
    <HowItWorks />
  
    <FreeProgram />
  
    <Community />
  
    <Coaching />
  
    <Testimonials />
  
    <Faq />
  
    <Location />
  <div/>
    </>
  );
}
