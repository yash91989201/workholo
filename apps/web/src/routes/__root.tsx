import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@workholo/ui/components/sonner";
import { ThemeProvider } from "@workholo/ui/components/theme-provider";
import { TooltipProvider } from "@workholo/ui/components/tooltip";
import Header from "@/components/header";
import appCss from "@/index.css?url";

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "workholo",
      },
      {
        name: "description",
        content: "workholo is a web application",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
});

function RootComponent() {
  return (
    <html className="dark" lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          storageKey="vite-ui-theme"
        >
          <TooltipProvider>
            <div className="grid h-svh grid-rows-[auto_1fr]">
              <Header />
              <Outlet />
            </div>
            <Toaster richColors />
          </TooltipProvider>
        </ThemeProvider>
        <TanStackRouterDevtools position="bottom-left" />
        <Scripts />
      </body>
    </html>
  );
}
