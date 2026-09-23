// Header live search: GET /api/search?q=… → first matches + total count.
import { getSearchSuggestions } from "@/lib/catalog";

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return Response.json({ products: [], total: 0 });
  return Response.json(await getSearchSuggestions(q));
}
