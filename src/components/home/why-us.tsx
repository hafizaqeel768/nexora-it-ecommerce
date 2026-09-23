"use client";

import type { PointerEvent } from "react";
import { LeafIcon, ServicesIcon, ShieldCheckIcon } from "@/components/icons";

const reasons = [
  { icon: ShieldCheckIcon, title: "Value-added sourcing", text: "Competitive pricing on genuine, warrantied hardware." },
  { icon: LeafIcon, title: "Regenerative mindset", text: "Refurbished options and responsible recycling programs." },
  { icon: ServicesIcon, title: "End-to-end support", text: "Hardware, software and services from a single partner." },
];

// 3D tilt + moving highlight on pointer devices, as in the prototype's .card handler.
function tilt(e: PointerEvent<HTMLDivElement>) {
  if (e.pointerType !== "mouse") return;
  const el = e.currentTarget;
  const b = el.getBoundingClientRect();
  const x = (e.clientX - b.left) / b.width - 0.5;
  const y = (e.clientY - b.top) / b.height - 0.5;
  el.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
  el.style.setProperty("--my", `${(y + 0.5) * 100}%`);
  el.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(8px)`;
}

export function WhyUs() {
  return (
    <section id="why" className="section-grey">
      <div className="wrap">
        <h2 className="section-title">Why teams choose us</h2>
        <p className="section-sub">Simple buying, fair pricing and support that stays with you.</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 perspective-[900px]">
          {reasons.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              onPointerMove={tilt}
              onPointerLeave={(e) => (e.currentTarget.style.transform = "")}
              className="rounded-16 border border-line bg-[radial-gradient(320px_circle_at_var(--mx,50%)_var(--my,0%),#d21f2b18,transparent_60%),var(--surface)] p-[22px] shadow-[0_6px_22px_#0000000d] transition-[transform,border-color] duration-150 transform-3d hover:border-accent"
            >
              <div className="grid size-[60px] place-items-center rounded-16 bg-accent-soft text-accent">
                <Icon className="size-[30px]" />
              </div>
              <h3 className="mt-3.5 mb-1.5 text-17 font-bold">{title}</h3>
              <p className="text-14 text-muted">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
