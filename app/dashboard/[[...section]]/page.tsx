import { slugs } from "@/lib/types";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  if (section && (section.length !== 1 || !slugs.includes(section[0])))
    notFound();
  return null;
}
