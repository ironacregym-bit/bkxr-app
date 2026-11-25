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
import MeetRob from "../components/MeetRob";
import Footer from "../components/Footer";
import Seo from "../components/Seo";
import { getCanonicalUrl } from "../lib/site-url";

const businessSchema = {
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  "@id": getCanonicalUrl("/") || undefined,
  name: "Iron Acre Gym",
  description:
    "Outdoor strength and conditioning gym in Westerfield, Ipswich, Suffolk.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Westerfield, Ipswich",
    addressRegion: "Suffolk",
    addressCountry: "GB",
  },
  areaServed: "Ipswich, Suffolk",
};

export default function Home() {
  return (
    <>
      <Seo
        title="Iron Acre Gym | Outdoor Strength Training in Ipswich"
        description="Train outdoors at Iron Acre Gym in Westerfield, Ipswich. Coached strength and conditioning, small-group training and online coaching for real people."
        path="/"
        structuredData={businessSchema}
      />
      <main>
        <Hero />
        <TrustBar />
        <MeetRob />
        <GymWithAView />
        <FarmStrength />
        <HowItWorks />
        <FreeProgram />
        <Community />
        <Coaching />
        <Testimonials />
        <Faq />
        <Location />
      </main>
      <Footer />
    </>
  );
}
