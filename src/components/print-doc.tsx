import { StoreLogo } from "@/components/store-logo";
import type { StoreDetails } from "@/lib/config-shared";

// Shared frame for printable order documents: store header on the left, document title and meta on the right.
export function PrintDoc({
  store,
  title,
  meta,
  actions,
  children,
}: {
  store: StoreDetails;
  title: string;
  meta: [string, string][];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-[min(800px,100%-32px)]">
      <div className="mb-4 flex justify-end gap-3 print:hidden">{actions}</div>
      <article className="rounded-14 bg-white p-10 text-14 shadow-[0_10px_30px_#0000001a] print:rounded-none print:p-0 print:shadow-none">
        <header className="mb-8 flex flex-wrap justify-between gap-6">
          <div>
            <StoreLogo store={store} className="text-28 tracking-[-1px]" imageClassName="h-12 w-auto" />
            <p className="mt-2 text-13 whitespace-pre-line text-[#555]">
              {store.name}
              {store.address && `\n${store.address}`}
              {store.supportEmail && `\n${store.supportEmail}`}
              {store.phone && `\n${store.phone}`}
            </p>
          </div>
          <div className="text-right">
            <h1 className="text-28 font-black tracking-[-.5px] uppercase">{title}</h1>
            <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-0.5 text-13">
              {meta.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-[#777]">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </header>
        {children}
      </article>
    </div>
  );
}
