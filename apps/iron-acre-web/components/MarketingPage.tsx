import type { ReactNode } from "react";
import Image from "next/image";
import Seo from "./Seo";
import SiteHeader from "./SiteHeader";
import Footer from "./Footer";
import { Container } from "./ui/container";

type MarketingPageProps = {
  title: string;
  description: string;
  path: string;
  eyebrow: string;
  heading: string;
  intro: string;
  image?: string;
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
  children: ReactNode;
};

export default function MarketingPage({
  title,
  description,
  path,
  eyebrow,
  heading,
  intro,
  image = "/images/GymFrontView.jpeg",
  structuredData,
  children,
}: MarketingPageProps) {
  return (
    <>
      <Seo
        title={title}
        description={description}
        path={path}
        image={image}
        structuredData={structuredData}
      />
      <SiteHeader />
      <main className="min-h-screen bg-[#141a15] text-[#e8eae2]">
        <section className="relative isolate overflow-hidden border-b border-white/10">
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#101510]/95 via-[#101510]/80 to-[#101510]/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141a15] via-transparent to-[#141a15]/20" />
          <Container>
            <div className="relative py-20 sm:py-28">
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[#e98740]">
                {eyebrow}
              </p>
              <h1 className="max-w-4xl font-['Big_Shoulders_Display'] text-5xl font-black uppercase leading-[0.92] sm:text-7xl">
                {heading}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75 sm:text-xl">
                {intro}
              </p>
            </div>
          </Container>
        </section>
        {children}
      </main>
      <Footer />
    </>
  );
}
