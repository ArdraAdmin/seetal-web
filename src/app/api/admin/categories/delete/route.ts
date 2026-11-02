import {
  deleteMasterCategory,
  deleteSubCategory,
  isDatabaseNotConfigured,
} from "@/lib/server/categories";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const body = (await req.json().catch(() => ({}))) as {
    masterCategoryId?: string;
    masterCategoryName?: string;
    catId?: string;
  };

  try {
    if (body.catId) {
      const result = await deleteSubCategory({ token, catId: body.catId });
      return Response.json(result);
    }
    const result = await deleteMasterCategory({
      token,
      masterCategoryId: body.masterCategoryId,
      masterCategoryName: body.masterCategoryName,
    });
    return Response.json(result);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      return new Response("Database is not configured", { status: 503 });
    }
    const message =
      error instanceof Error ? error.message : "Unable to delete category";
    const status =
      message === "Not signed in" || message === "Not allowed" ? 401 : 400;
    return new Response(message, { status });
  }
}
