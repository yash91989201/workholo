import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workholo/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workholo/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workholo/ui/components/table";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/panel")({
  component: RouteComponent,
});

type CallRow = {
  id: string;
  direction: string;
  status: string;
  startedAt: string | Date | null;
};

type RecordingRow = {
  id: string;
  callId: string;
  url: string;
  createdAt: string | Date | null;
};

function CallsTable({ rows }: { rows: CallRow[] }) {
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No calls yet</EmptyTitle>
          <EmptyDescription>
            Your assigned calls will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Direction</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((call) => (
          <TableRow key={call.id}>
            <TableCell>{call.direction}</TableCell>
            <TableCell>{call.status}</TableCell>
            <TableCell>
              {call.startedAt ? new Date(call.startedAt).toLocaleString() : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RecordingsTable({ rows }: { rows: RecordingRow[] }) {
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No recordings yet</EmptyTitle>
          <EmptyDescription>
            Recordings from your calls will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Call</TableHead>
          <TableHead>Recorded</TableHead>
          <TableHead>Recording</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((recording) => (
          <TableRow key={recording.id}>
            <TableCell>{recording.callId}</TableCell>
            <TableCell>
              {recording.createdAt
                ? new Date(recording.createdAt).toLocaleString()
                : "—"}
            </TableCell>
            <TableCell>
              <a
                className="text-primary underline-offset-4 hover:underline"
                href={recording.url}
                rel="noreferrer"
                target="_blank"
              >
                Open recording
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RouteComponent() {
  const { me } = Route.useRouteContext();
  const organizationId = me.membership?.organizationId ?? "";

  const calls = useQuery(
    orpc.calls.calls.queryOptions({ input: { organizationId, limit: 50 } })
  );
  const recordings = useQuery(
    orpc.calls.recordings.queryOptions({ input: { organizationId, limit: 50 } })
  );

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="font-bold text-2xl">Agent Panel</h1>
        <p className="text-muted-foreground">
          {me.membership?.name} · {me.user?.email}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My calls</CardTitle>
        </CardHeader>
        <CardContent>
          {calls.isPending ? (
            <p className="text-muted-foreground">Loading calls…</p>
          ) : (
            <CallsTable rows={calls.data ?? []} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My recordings</CardTitle>
        </CardHeader>
        <CardContent>
          {recordings.isPending ? (
            <p className="text-muted-foreground">Loading recordings…</p>
          ) : (
            <RecordingsTable rows={recordings.data ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
