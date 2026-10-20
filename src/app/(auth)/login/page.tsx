import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-5 text-lg font-semibold">Sign in</h1>
      <AuthForm mode="login" />
    </>
  );
}
