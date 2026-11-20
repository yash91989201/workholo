import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workholo/ui/components/table";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/numbers")({
  component: NumbersPage,
});

function NumbersPage() {
  const { membership } = Route.useRouteContext();
  const numbers = useQuery(
    orpc.numbers.listEligibleOutboundNumbers.queryOptions({
      input: { organizationId: membership.organizationId },
    })
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-bold text-2xl">Outbound numbers</h1>
        <p className="text-muted-foreground text-sm">
          Numbers this organization can call from.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {numbers.data?.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.number}</TableCell>
            </TableRow>
          ))}
          {numbers.data?.length === 0 ? (
            <TableRow>
              <TableCell className="text-center text-muted-foreground">
                No outbound numbers assigned yet
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
