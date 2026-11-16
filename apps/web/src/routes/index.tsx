import { createFileRoute } from "@tanstack/react-router";
import { buttonVariants } from "@workholo/ui/components/button";
import { ENV } from "@/env";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <main className="container mx-auto flex max-w-3xl flex-col items-start gap-6 px-4 py-16">
      <h1 className="font-semibold text-4xl tracking-tight">workholo</h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        A shared workspace where your team and its agents get work done — one
        console for everything.
      </p>
      <a className={buttonVariants({ size: "lg" })} href={ENV.VITE_CONSOLE_URL}>
        Open console
      </a>
    </main>
  );
}
