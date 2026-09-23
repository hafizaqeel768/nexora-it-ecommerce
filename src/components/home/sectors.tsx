import Link from "next/link";
import { ArrowRightIcon, SectorGlyph, type SectorIcon } from "@/components/icons";

const sectors: { name: string; icon: SectorIcon }[] = [
  { name: "Education", icon: "education" },
  { name: "Healthcare", icon: "healthcare" },
  { name: "Retail", icon: "retail" },
  { name: "Manufacturing", icon: "manufacturing" },
  { name: "Government", icon: "government" },
  { name: "Logistics", icon: "logistics" },
  { name: "Finance", icon: "finance" },
];

const tile =
  "group flex flex-col gap-4 rounded-18 border border-[#ffffff22] p-6 text-16 font-bold text-white transition duration-300 hover:-translate-y-[5px] hover:border-accent hover:bg-accent";
const glyph = "size-[34px] stroke-[#ff7b86] transition-colors duration-300 group-hover:stroke-white";

// Dark band (the prototype's .band #sectors).
export function Sectors() {
  return (
    <section id="sectors" className="border-t-[3px] border-accent bg-[#0a0a0a] py-16 text-white">
      <div className="wrap">
        <h2 className="section-title no-rule">Serving every sector</h2>
        <p className="section-sub text-[#ffd6da]">From classrooms to factory floors, we tailor hardware to the job.</p>
        <div className="mt-2 grid grid-cols-4 gap-4 max-xl:grid-cols-2">
          {sectors.map((s) => (
            <Link key={s.name} href="/shop" className={`${tile} bg-[#ffffff0a]`}>
              <SectorGlyph name={s.icon} className={glyph} />
              <span>{s.name}</span>
            </Link>
          ))}
          <Link href="/#contact" className={`${tile} border-dashed bg-[#ffffff14]`}>
            <ArrowRightIcon strokeWidth={1.6} className={glyph} />
            <span>Your industry? Talk to us</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
