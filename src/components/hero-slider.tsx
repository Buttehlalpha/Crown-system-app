import { useEffect, useState } from "react";
import hero1 from "@/assets/hero-1.jpg";
import hero2 from "@/assets/hero-2.jpg";
import hero3 from "@/assets/hero-3.jpg";
import hero4 from "@/assets/hero-4.jpg";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const slides = [
  {
    src: hero1,
    alt: "Delegates seated in a full conference hall in Bauchi",
    eyebrow: "Event Centre Management",
    title: "Run every event with total control",
    body: "Plan venues, publish events and track attendance across Bauchi State from one command centre.",
  },
  {
    src: hero2,
    alt: "Security officers scanning tickets at an event entrance gate",
    eyebrow: "Verified Entry",
    title: "QR ticket validation at the gate",
    body: "Officers scan, the system validates the ticket and capacity, then approves or rejects entry instantly.",
  },
  {
    src: hero3,
    alt: "Large outdoor festival crowd at golden hour",
    eyebrow: "Real-Time Crowd Control",
    title: "Know your occupancy every second",
    body: "Live counts, warning thresholds and critical alerts keep crowds safe and within capacity.",
  },
  {
    src: hero4,
    alt: "Elegant banquet hall set with round tables",
    eyebrow: "Trusted Venues",
    title: "Bauchi's finest event spaces",
    body: "Ahmadu Bello ICC, Zaranda Hotel, Dec Guest House and more — with verified capacities.",
  },
];

export function HeroSlider() {
  const [index, setIndex] = useState(0);
  const current = slides[index]!;

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative h-[78vh] min-h-[520px] w-full overflow-hidden bg-primary">
      {slides.map((slide, i) => (
        <img
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          width={1920}
          height={1080}
          loading={i === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-out ${
            i === index ? "scale-100 opacity-100" : "scale-105 opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/70 to-primary/20" />

      <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-center px-6">
        <div key={index} className="w-full max-w-3xl mx-auto text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="inline-flex items-center rounded-full border border-accent/50 bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            {current.eyebrow}
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-primary-foreground sm:text-6xl">
            {current.title}
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-lg text-primary-foreground/80">{current.body}</p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/auth" search={{ mode: "register" }}>
                Create an account
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link to="/auth" search={{ mode: "login" }}>
                Sign in
              </Link>
            </Button>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((s, i) => (
            <button
              key={s.src}
              aria-label={`Show slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-10 bg-accent" : "w-5 bg-primary-foreground/40"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}