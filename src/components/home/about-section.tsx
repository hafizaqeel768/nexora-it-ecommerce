import Image from "next/image";
import Link from "next/link";
import { siteImages } from "@/lib/media";

const points = [
  "Genuine products with manufacturer warranty",
  "Compliant quotes for government buyers",
  "Deployment and help desk support",
];

export function AboutSection() {
  const img = siteImages.about;
  return (
    <section id="about" className="section-white">
      <div className="wrap grid grid-cols-[1.1fr_.9fr] items-center gap-12 max-[701px]:grid-cols-1">
        <div>
          <span className="eyebrow">About us</span>
          <h2 className="section-title">A trusted IT partner for public and private sectors</h2>
          <p className="section-sub max-w-none">
            From federal agencies and schools to hospitals and growing businesses, we supply
            dependable hardware at competitive prices, backed by people who know the products.
          </p>
          <ul className="mb-[26px] grid gap-2.5">
            {points.map((p) => (
              <li key={p} className="before:mr-2.5 before:font-extrabold before:text-accent before:content-['✓']">
                {p}
              </li>
            ))}
          </ul>
          <Link href="/#contact" className="btn">
            Talk to an expert
          </Link>
        </div>
        <div>
          <Image
            src={img.src}
            width={img.width}
            height={img.height}
            alt="Serving customers across the USA"
            sizes="(max-width: 700px) 100vw, 480px"
            className="h-auto w-full animate-bob"
          />
        </div>
      </div>
    </section>
  );
}
