import Dashboard from "@/components/dashboard";
import { identity } from "@/lib/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Agency workspace",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await identity();
  if (!user) redirect("/auth/login");

  return (
    <>
      <Dashboard />
      {children}
    </>
  );
}
