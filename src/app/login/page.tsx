import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Activity } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign In" };

export default async function LoginPage() {
  // If already authenticated, redirect to dashboard
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(222,47%,11%)] px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-white">
              Marmelad CRM
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Sign in to your account
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-lg border border-white/[0.08] bg-[hsl(217,33%,13%)] p-6 shadow-lg">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
