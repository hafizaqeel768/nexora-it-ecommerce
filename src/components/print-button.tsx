"use client";

// "Print / Save as PDF" (browsers offer "Save as PDF" in the print dialog). Hidden on paper.
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn cursor-pointer border-0 text-14 print:hidden">
      Print / Save as PDF
    </button>
  );
}
