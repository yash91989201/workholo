import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@workholo/ui/components/button";
import { ModeToggle } from "@workholo/ui/components/mode-toggle";
import { ENV } from "@/env";

export default function Header() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          <Link to="/">Home</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <a className={buttonVariants()} href={ENV.VITE_CONSOLE_URL}>
            Open console
          </a>
        </div>
      </div>
      <hr />
    </div>
  );
}
