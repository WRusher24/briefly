import { BottomNav, TopBar } from "@/components/nav";
import { requirePageUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser();
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 sm:pb-16">{children}</main>
      <BottomNav />
    </>
  );
}
