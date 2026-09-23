"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { saveProduct, type AdminFormState } from "@/app/actions/admin";
import { Field, FormMessage, fieldClass } from "@/components/account/field";
import { primaryButton, select } from "@/components/admin/ui";

export type ProductFormValues = {
  id: string | null;
  slug: string | null;
  name: string;
  brand: string;
  categoryId: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  sku: string;
  status: "ACTIVE" | "DRAFT";
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "BACKORDER";
  description: string;
  specs: string;
  images: string[];
};

type CategoryGroup = { name: string; id: string; children: { id: string; name: string }[] };

const label = "grid gap-1.5 text-13 text-muted";

// Add / edit product (the prototype's a_pform). Photos: reorder ("Make main"), remove, and upload new ones;
// the first photo is the main image. Variants and bulk tiers are not edited here yet.
export function ProductForm({ values, categories }: { values: ProductFormValues; categories: CategoryGroup[] }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(saveProduct, {});
  const f = state.fields ?? {};
  const [images, setImages] = useState(values.images);
  const [previews, setPreviews] = useState<string[]>([]);

  // After a save the server sends the stored photos back; show exactly those.
  const serverImages = values.images.join("|");
  const [synced, setSynced] = useState(serverImages);
  if (serverImages !== synced) {
    setSynced(serverImages);
    setImages(values.images);
  }
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const move = (i: number) => setImages((list) => [list[i], ...list.filter((_, k) => k !== i)]);
  const remove = (i: number) => setImages((list) => list.filter((_, k) => k !== i));

  return (
    <form
      action={action}
      className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1"
      onSubmit={() => setPreviews([])}
      noValidate
    >
      <input type="hidden" name="id" value={values.id ?? ""} />

      <fieldset className={`${label} col-span-full`}>
        <legend className="mb-1.5">Product photos</legend>
        <small className="text-12">The first photo is the main image. JPG, PNG or WebP, up to 4 MB each, 5 per save.</small>
        <div className="flex flex-wrap gap-2.5">
          {images.map((src, i) => (
            <div key={src} className="grid w-[112px] gap-1 text-center text-12">
              <input type="hidden" name="keepImage" value={src} />
              <span className={`relative grid size-[112px] place-items-center overflow-hidden rounded-12 border bg-[#f4f6f9] ${i === 0 ? "border-accent" : "border-line"}`}>
                <Image src={src} alt="" width={112} height={112} className="size-full object-contain mix-blend-multiply" />
                {i === 0 && <b className="absolute top-1.5 left-1.5 rounded-pill bg-accent px-2 py-0.5 text-11 text-white">Main</b>}
              </span>
              <span className="flex justify-center gap-2">
                {i > 0 && (
                  <button type="button" onClick={() => move(i)} className="cursor-pointer font-bold text-accent hover:underline">
                    Make main
                  </button>
                )}
                <button type="button" onClick={() => remove(i)} className="cursor-pointer text-muted hover:text-accent">
                  Remove
                </button>
              </span>
            </div>
          ))}
          {previews.map((src) => (
            <span key={src} className="grid size-[112px] place-items-center overflow-hidden rounded-12 border border-dashed border-accent bg-[#f4f6f9]" title="New, uploaded on save">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not optimisable */}
              <img src={src} alt="" className="size-full object-contain" />
            </span>
          ))}
        </div>
        <input
          type="file"
          name="photos"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setPreviews(Array.from(e.target.files ?? []).map((file) => URL.createObjectURL(file)))}
          className="mt-1 text-13 text-ink file:mr-3 file:cursor-pointer file:rounded-pill file:border-0 file:bg-ink file:px-4 file:py-2 file:text-white"
        />
        {images.length === 0 && previews.length === 0 && <small className="text-12">No photos: the store shows the category icon.</small>}
        {f.photos && <span className="text-accent">{f.photos}</span>}
      </fieldset>

      <div className="col-span-full">
        <Field label="Product name" name="name" required defaultValue={values.name} error={f.name} />
      </div>
      <Field label="Brand" name="brand" required defaultValue={values.brand} error={f.brand} />
      <label className={label}>
        <span>Category *</span>
        <select name="categoryId" defaultValue={values.categoryId} className={`${select} w-full py-3`} aria-invalid={!!f.categoryId}>
          <option value="">Choose…</option>
          {categories.map((c) => (
            <optgroup key={c.id} label={c.name}>
              <option value={c.id}>{c.name} (general)</option>
              {c.children.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {f.categoryId && <span className="text-accent">{f.categoryId}</span>}
      </label>
      <Field label="Price (USD)" name="price" type="number" min="0" step="0.01" required defaultValue={values.price} error={f.price} />
      <Field label="Compare-at price (optional, shown struck through)" name="compareAtPrice" type="number" min="0" step="0.01" defaultValue={values.compareAtPrice} error={f.compareAtPrice} />
      <Field label="Stock (empty = not tracked)" name="stock" type="number" min="0" step="1" defaultValue={values.stock} error={f.stock} />
      <Field label="SKU (optional)" name="sku" defaultValue={values.sku} error={f.sku} />
      <label className={label}>
        <span>Status</span>
        <select name="status" defaultValue={values.status} className={`${select} w-full py-3`}>
          <option value="ACTIVE">Active (visible in store)</option>
          <option value="DRAFT">Draft (hidden)</option>
        </select>
      </label>
      <label className={label}>
        <span>Availability</span>
        <select name="availability" defaultValue={values.availability} className={`${select} w-full py-3`}>
          <option value="IN_STOCK">In stock</option>
          <option value="BACKORDER">On backorder</option>
          <option value="OUT_OF_STOCK">Out of stock</option>
        </select>
      </label>
      <label className={`${label} col-span-full`}>
        <span>Description</span>
        <textarea name="description" rows={4} defaultValue={values.description} className={fieldClass} />
      </label>
      <label className={`${label} col-span-full`}>
        <span>Specifications (one per line, Label: value)</span>
        <textarea name="specs" rows={6} defaultValue={values.specs} className={`${fieldClass} font-mono text-13`} placeholder={"Ports: 24 × 1 GbE\nPoE budget: 370 W"} />
      </label>

      <div className="col-span-full grid gap-3">
        <FormMessage state={state} />
        <div className="flex flex-wrap items-center justify-end gap-4">
          {values.slug && values.status === "ACTIVE" && (
            <Link href={`/product/${values.slug}`} target="_blank" className="mr-auto text-13 font-bold text-accent hover:underline">
              View in store ↗
            </Link>
          )}
          <Link href="/admin/products" className="text-13 font-bold text-muted hover:text-ink">
            Cancel
          </Link>
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Saving…" : "Save product"}
          </button>
        </div>
      </div>
    </form>
  );
}
