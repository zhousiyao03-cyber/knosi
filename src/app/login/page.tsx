import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-stone-950">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-stone-200 bg-white p-8 shadow-lg dark:border-stone-800 dark:bg-stone-900">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-stone-200 text-lg font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-200">
            S
          </div>
          <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
            Second Brain
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            登录以访问你的知识库
          </p>
        </div>

        <div className="space-y-3">
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 dark:border-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
            >
              使用 GitHub 登录
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              使用 Google 登录
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
