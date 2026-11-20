import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@workholo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workholo/ui/components/dropdown-menu";
import { Skeleton } from "@workholo/ui/components/skeleton";

import { authClient } from "@/lib/auth-client";
import { unregisterAgentPhone } from "@/utils/agent-phone";
import { client } from "@/utils/orpc";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  const handleSignOut = async () => {
    const me = await client.organization.me().catch(() => null);
    if (me?.membership) {
      await client.preview
        .setWorkStatus({
          organizationId: me.membership.organizationId,
          status: "offline",
        })
        .catch(() => false);
    }
    await unregisterAgentPhone();
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate({ to: "/login" });
        },
      },
    });
  };

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Link to="/login">
        <Button variant="outline">Sign In</Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        {session.user.name}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{session.user.email}</DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut} variant="destructive">
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
