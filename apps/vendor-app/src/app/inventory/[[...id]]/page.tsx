// src/app/vendor/inventory/[[...id]]/page.tsx
import EditProductClient from "./EditProductClient";

interface PageProps {
  params: Promise<{ id?: string | string[] }>;
}

// Statically generates a single blank template shell for our client-side routing
export async function generateStaticParams() {
  return [{ id: [] }];
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;

  // Normalize the catch-all parameter into a clean ID string
  const cleanId = Array.isArray(resolvedParams.id)
    ? resolvedParams.id[0] || ""
    : resolvedParams.id || "";

  return <EditProductClient id={cleanId} />;
}
