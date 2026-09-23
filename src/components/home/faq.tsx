"use client";

import { useState } from "react";

const faqs = [
  {
    q: "Do you serve government and public-sector buyers?",
    a: "Yes. We support agencies, schools, hospitals and businesses of every size with fast, compliant quotes.",
  },
  {
    q: "Which brands do you carry?",
    a: "TP-Link, Netgear, Ubiquiti, Linksys, Dell, HP, Lenovo, Cisco and many more, all genuine with manufacturer warranty.",
  },
  {
    q: "How quickly can I get a quote?",
    a: "Most quote requests are answered within 24 hours. Bulk and custom configurations may take slightly longer.",
  },
  {
    q: "Do you offer refurbished or eco-friendly options?",
    a: "Yes. We offer certified refurbished hardware and responsible recycling for equipment you are replacing.",
  },
  {
    q: "Can you help with deployment and support?",
    a: "Absolutely. We provide setup, ERP/CRM integration, and a help desk that stays with you after purchase.",
  },
];

// Accordion: one answer open at a time (the prototype's .fq).
export function Faq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="section-white text-center">
      <div className="wrap">
        <h2 className="section-title after:mx-auto">Frequently asked questions</h2>
        <p className="section-sub mx-auto">Quick answers to common questions about ordering and support.</p>
        <div className="mx-auto grid max-w-[800px] gap-3 text-left">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={f.q}
                className={`overflow-hidden rounded-14 border bg-[#f6f7f9] transition-[border-color,box-shadow] duration-250 ${
                  isOpen ? "border-accent shadow-[0_8px_28px_#d21f2b1f]" : "border-line"
                }`}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-4 px-[22px] py-[18px] text-left text-16 font-bold text-ink after:text-26 after:leading-none after:text-accent after:transition-transform after:duration-300 after:content-['+'] ${
                    isOpen ? "after:rotate-[135deg]" : ""
                  }`}
                >
                  {f.q}
                </button>
                <div
                  id={`faq-${i}`}
                  className={`grid transition-[grid-template-rows] duration-350 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <p
                    className={`overflow-hidden px-[22px] text-15 text-muted transition-[padding] duration-350 ${isOpen ? "pb-5" : ""}`}
                  >
                    {f.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
