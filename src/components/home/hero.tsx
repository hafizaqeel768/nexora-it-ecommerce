"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import s from "./hero.module.css";

const slides = [
  {
    tag: "IT hardware & solutions",
    title: ["Power your business with ", "reliable", " IT hardware."],
    text: "PCs, tablets, monitors, IoT and network equipment, sourced and supported by a team focused on closing the digital divide.",
    cta: { label: "Browse hardware", href: "/shop" },
  },
  {
    tag: "Network equipment",
    title: ["Networking gear built for ", "speed", " and scale."],
    text: "Switches, routers, access points and firewalls from top brands at competitive prices, ready to deploy.",
    cta: { label: "View networking", href: "/shop?category=networking" },
  },
  {
    tag: "Regenerative IT",
    title: ["Smarter, ", "greener", " technology for every team."],
    text: "Refurbished options, responsible recycling and end-to-end support that help your business grow sustainably.",
    cta: { label: "Learn more", href: "/#faq" },
  },
];

const stats = [
  { n: 5000, suffix: "+", label: "Products in catalog" },
  { n: 40, suffix: "+", label: "Countries served" },
  { n: 24, suffix: "h", label: "Quote turnaround" },
];

export type HeroCard = { image: string | null; title: string; price: string; badge?: string };

const SLIDE_MS = 6000;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Hero({ cards }: { cards: HeroCard[] }) {
  const heroRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [counts, setCounts] = useState(stats.map((st) => st.n));

  const go = (n: number) => setActive((n + slides.length) % slides.length);

  // Autoplay; restarts whenever the slide changes (manual or automatic).
  useEffect(() => {
    const t = setTimeout(() => setActive((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [active]);

  // Count-up for the stats, as in the prototype (starts after 700ms, eases over 1.8s).
  useEffect(() => {
    if (reducedMotion()) return;
    setCounts(stats.map(() => 0));
    let raf = 0;
    let t0 = 0;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min((t - t0) / 1800, 1);
      setCounts(stats.map((st) => Math.round(st.n * (1 - Math.pow(1 - p, 3)))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const start = setTimeout(() => (raf = requestAnimationFrame(tick)), 700);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Particle network on the canvas, pointer lines, 3D tilt of the card stage, scroll parallax.
  useEffect(() => {
    const hero = heroRef.current;
    const cv = canvasRef.current;
    const cx = cv?.getContext("2d");
    if (!hero || !cv || !cx) return;

    const reduce = reducedMotion();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type Node = { x: number; y: number; vx: number; vy: number; r: number; red: boolean };
    let W = 0;
    let H = 0;
    let nodes: Node[] = [];
    let mx = -999;
    let my = -999;
    let visible = true;
    let raf = 0;

    const size = () => {
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes = Array.from({ length: Math.round((W * H) / 15000) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        r: Math.random() * 1.7 + 0.8,
        red: Math.random() < 0.22,
      }));
    };

    const frame = () => {
      cx.clearRect(0, 0, W, H);
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < 0 || a.x > W) a.vx *= -1;
        if (a.y < 0 || a.y > H) a.vy *= -1;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dd = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
          if (dd < 16000) {
            cx.strokeStyle = `rgba(210,31,43,${(1 - dd / 16000) * 0.5})`;
            cx.lineWidth = 0.8;
            cx.beginPath();
            cx.moveTo(a.x, a.y);
            cx.lineTo(b.x, b.y);
            cx.stroke();
          }
        }
        cx.fillStyle = a.red ? "#d21f2b" : "rgba(255,255,255,.7)";
        cx.beginPath();
        cx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        cx.fill();
        if (mx > -900) {
          const d = Math.hypot(a.x - mx, a.y - my);
          if (d < 180) {
            cx.strokeStyle = `rgba(255,255,255,${(1 - d / 180) * 0.55})`;
            cx.lineWidth = 0.8;
            cx.beginPath();
            cx.moveTo(a.x, a.y);
            cx.lineTo(mx, my);
            cx.stroke();
          }
        }
      }
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (visible) frame();
    };

    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      if (!reduce && stageRef.current) {
        const x = mx / r.width - 0.5;
        const y = my / r.height - 0.5;
        stageRef.current.style.transform = `rotateY(${x * 26}deg) rotateX(${-y * 18}deg)`;
      }
    };
    const onLeave = () => {
      mx = my = -999;
      if (stageRef.current) stageRef.current.style.transform = "";
    };
    const onScroll = () => {
      const y = Math.min(window.scrollY, 700);
      cv.style.transform = `translateY(${y * 0.25}px) scale(${1 + y * 0.0003})`;
    };
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));

    size();
    io.observe(hero);
    window.addEventListener("resize", size);
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    if (reduce) frame();
    else loop();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", size);
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Swipe between slides on touch devices.
  const touchX = useRef<number | null>(null);

  return (
    <div
      ref={heroRef}
      className={s.hero}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const d = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(d) > 50) go(d < 0 ? active + 1 : active - 1);
        touchX.current = null;
      }}
    >
      <canvas ref={canvasRef} className={s.canvas} />

      <div className={s.scene} aria-hidden="true">
        <div className={s.orb} />
        <div className={`${s.ring} ${s.ring1}`} />
        <div className={`${s.ring} ${s.ring2}`} />
        <div ref={stageRef} className={s.stage}>
          {cards.map((c, i) => (
            <div key={c.title} className={`${s.card} ${[s.g1, s.g2, s.g3][i]}`}>
              <div className={s.cardImage}>
                {c.image && <Image src={c.image} alt="" width={135} height={135} />}
              </div>
              <b>{c.title}</b>
              <small>{c.price}</small>
              {c.badge && <span className={s.pill}>{c.badge}</span>}
            </div>
          ))}
          <div className={`${s.card} ${s.chip} ${s.g4}`}>⚡ 10 Gbps Ready</div>
          <div className={`${s.card} ${s.chip} ${s.g5}`}>🛡️ Genuine Warranty</div>
        </div>
      </div>

      <div className={`wrap ${s.content}`}>
        <div className={s.slides}>
          {slides.map((sl, i) => (
            <div key={sl.tag} className={`${s.slide} ${i === active ? s.active : ""}`} aria-hidden={i !== active}>
              <span className={s.tag}>{sl.tag}</span>
              {/* One h1 per page: the first slide; the others are h2s styled identically. */}
              {(() => {
                const Heading = i === 0 ? "h1" : "h2";
                return (
                  <Heading className={s.title}>
                    {sl.title[0]}
                    <em>{sl.title[1]}</em>
                    {sl.title[2]}
                  </Heading>
                );
              })()}
              <p>{sl.text}</p>
              <Link href={sl.cta.href} className={`btn ${s.primary}`} tabIndex={i === active ? 0 : -1}>
                {sl.cta.label}
              </Link>
              <Link href="/#contact" className={`btn ${s.ghost}`} tabIndex={i === active ? 0 : -1}>
                Talk to sales
              </Link>
            </div>
          ))}
        </div>

        <div className={s.controls}>
          <button type="button" className={s.arrow} aria-label="Previous" onClick={() => go(active - 1)}>
            &#8592;
          </button>
          <div className={s.dots}>
            {slides.map((sl, i) => (
              <button
                key={sl.tag}
                type="button"
                aria-label={`Slide ${i + 1}`}
                aria-current={i === active}
                className={`${s.dot} ${i === active ? s.active : ""}`}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <button type="button" className={s.arrow} aria-label="Next" onClick={() => go(active + 1)}>
            &#8594;
          </button>
          <div className={s.progress}>
            <i key={active} />
          </div>
        </div>

        <div className={s.stats}>
          {stats.map((st, i) => (
            <div key={st.label}>
              <b>
                {counts[i].toLocaleString("en-US")}
                {st.suffix}
              </b>
              <small>{st.label}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
