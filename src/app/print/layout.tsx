// Printable documents (invoice, packing slip): no store chrome, A4/Letter friendly.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f4f4f5] py-8 text-[#111] print:bg-white print:py-0">{children}</div>;
}
