// Scrolling brand strip (the prototype's .marq). Brands come from the catalog, most products first;
// the list is rendered twice so the -50% translate loops seamlessly.
export function BrandMarquee({ brands }: { brands: string[] }) {
  const loop = [...brands, ...brands];
  return (
    <div id="brands" className="overflow-hidden border-b border-[#2a2a2a] bg-black py-4" aria-label="Brands we carry">
      <div className="flex w-max animate-marquee gap-14">
        {loop.map((b, i) => (
          <span
            key={`${b}-${i}`}
            aria-hidden={i >= brands.length}
            className="text-15 font-extrabold tracking-[.14em] whitespace-nowrap text-white uppercase before:mr-14 before:align-middle before:text-[9px] before:text-accent before:content-['●']"
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}
