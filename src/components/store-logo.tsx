import Image from "next/image";
import type { StoreDetails } from "@/lib/config-shared";

// The store's logo from Settings → Store details: the uploaded image, or the wordmark (text + accent part).
export function StoreLogo({ store, className = "", imageClassName = "h-10 w-auto" }: { store: StoreDetails; className?: string; imageClassName?: string }) {
  if (store.logoUrl) {
    return <Image src={store.logoUrl} alt={store.name} width={200} height={56} className={`object-contain ${imageClassName}`} priority />;
  }
  return (
    <b className={`block leading-none font-black ${className}`}>
      {store.logoText}
      {store.logoAccent && <span className="text-accent">{store.logoAccent}</span>}
    </b>
  );
}
