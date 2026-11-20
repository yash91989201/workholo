import { formOptions } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@workholo/ui/components/badge";
import { Button } from "@workholo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workholo/ui/components/dialog";
import { useAppForm } from "@workholo/ui/components/form/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workholo/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workholo/ui/components/table";
import { useState } from "react";
import { toast } from "sonner";

import { RegisterOutboundNumberFormSchema } from "@/lib/schemas/number";
import type { RegisterOutboundNumberFormType } from "@/lib/types";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/numbers")({
  component: NumbersPage,
});

const registerNumberFormOpts = formOptions({
  defaultValues: {
    number: "",
  } satisfies RegisterOutboundNumberFormType as RegisterOutboundNumberFormType,
});

function RegisterNumberForm({ onDone }: { onDone: () => void }) {
  const { queryClient } = Route.useRouteContext();
  const register = useMutation({
    ...orpc.platform.registerOutboundNumber.mutationOptions(),
    onSuccess: async (created) => {
      toast.success(`Registered ${created.number}`);
      onDone();
      await queryClient.invalidateQueries({
        queryKey: orpc.platform.key(),
      });
    },
    onError: (error) => toast.error(error.message),
  });
  const form = useAppForm({
    ...registerNumberFormOpts,
    validators: { onSubmit: RegisterOutboundNumberFormSchema },
    onSubmit: async ({ value }) => {
      try {
        await register.mutateAsync({ number: value.number });
        form.reset();
      } catch {
        // Rejection is surfaced by the mutation's onError.
      }
    },
  });

  return (
    <form.AppForm>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.AppField name="number">
          {(field) => <field.Input label="Number" placeholder="+14155550123" />}
        </form.AppField>
        <DialogFooter>
          <Button onClick={onDone} type="button" variant="outline">
            Cancel
          </Button>
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button disabled={!canSubmit || isSubmitting} type="submit">
                Register
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </form.AppForm>
  );
}

function AssignNumberDialog({
  number,
  onDone,
}: {
  number: { id: string; number: string };
  onDone: () => void;
}) {
  const { queryClient } = Route.useRouteContext();
  const [organizationId, setOrganizationId] = useState("");
  const organizations = useQuery(
    orpc.platform.listOrganizations.queryOptions({
      input: { page: 1, pageSize: 100 },
    })
  );
  const assign = useMutation({
    ...orpc.platform.assignOutboundNumber.mutationOptions(),
    onSuccess: async () => {
      toast.success(`Assigned ${number.number}`);
      onDone();
      await queryClient.invalidateQueries({
        queryKey: orpc.platform.key(),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <Select
        items={(organizations.data?.items ?? []).map((row) => ({
          label: row.name,
          value: row.id,
        }))}
        onValueChange={(value) => {
          if (typeof value === "string") {
            setOrganizationId(value);
          }
        }}
        value={organizationId}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select an organization" />
        </SelectTrigger>
        <SelectContent>
          {(organizations.data?.items ?? []).map((row) => (
            <SelectItem key={row.id} value={row.id}>
              {row.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DialogFooter>
        <Button onClick={onDone} type="button" variant="outline">
          Cancel
        </Button>
        <Button
          disabled={organizationId === "" || assign.isPending}
          onClick={() => {
            assign.mutate({ numberId: number.id, organizationId });
          }}
        >
          Assign
        </Button>
      </DialogFooter>
    </div>
  );
}

function NumbersPage() {
  const { queryClient } = Route.useRouteContext();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [assigning, setAssigning] = useState<{
    id: string;
    number: string;
  } | null>(null);

  const numbers = useQuery(orpc.platform.listOutboundNumbers.queryOptions());
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orpc.platform.key() });

  const setEnabled = useMutation({
    ...orpc.platform.setOutboundNumberEnabled.mutationOptions(),
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
  });
  const unassign = useMutation({
    ...orpc.platform.unassignOutboundNumber.mutationOptions(),
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="container mx-auto space-y-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl">Outbound numbers</h1>
          <p className="text-muted-foreground text-sm">
            Carrier-provisioned numbers platform staff assign to organizations.
          </p>
        </div>
        <Dialog onOpenChange={setRegisterOpen} open={registerOpen}>
          <DialogTrigger render={<Button />}>Register number</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register a number</DialogTitle>
              <DialogDescription>
                Add a carrier-provisioned E.164 number to the global inventory.
              </DialogDescription>
            </DialogHeader>
            <RegisterNumberForm onDone={() => setRegisterOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Outbound</TableHead>
            <TableHead>Assigned to</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {numbers.data?.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.number}</TableCell>
              <TableCell>
                <Badge variant={row.enabled ? "secondary" : "destructive"}>
                  {row.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </TableCell>
              <TableCell>
                {row.assignedOrganizationName ?? (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                {new Date(String(row.createdAt)).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    onClick={() => {
                      setEnabled.mutate({
                        numberId: row.id,
                        enabled: !row.enabled,
                      });
                    }}
                    size="xs"
                    variant="outline"
                  >
                    {row.enabled ? "Disable" : "Enable"}
                  </Button>
                  {row.assignedOrganizationId ? (
                    <Button
                      onClick={() => {
                        unassign.mutate({ numberId: row.id });
                      }}
                      size="xs"
                      variant="outline"
                    >
                      Unassign
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setAssigning({ id: row.id, number: row.number });
                      }}
                      size="xs"
                      variant="outline"
                    >
                      Assign
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {numbers.data?.length === 0 ? (
            <TableRow>
              <TableCell
                className="text-center text-muted-foreground"
                colSpan={5}
              >
                No numbers in inventory
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setAssigning(null);
          }
        }}
        open={assigning !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {assigning?.number}</DialogTitle>
            <DialogDescription>
              The number becomes eligible for outbound use by this organization.
            </DialogDescription>
          </DialogHeader>
          {assigning ? (
            <AssignNumberDialog
              number={assigning}
              onDone={() => setAssigning(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
