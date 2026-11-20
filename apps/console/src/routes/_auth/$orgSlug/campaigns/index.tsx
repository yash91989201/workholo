import { IconDots } from "@tabler/icons-react";
import { formOptions } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { CampaignRowSummary } from "@workholo/api-client";
import { Badge } from "@workholo/ui/components/badge";
import { Button } from "@workholo/ui/components/button";
import { DataTable } from "@workholo/ui/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workholo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workholo/ui/components/dropdown-menu";
import { useAppForm } from "@workholo/ui/components/form/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { CreateCampaignFormSchema } from "@/lib/schemas/campaign";
import type { CreateCampaignFormType } from "@/lib/types";
import { campaignErrorMessage } from "@/utils/campaign";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/campaigns/")({
  component: CampaignsPage,
});

const statusBadges: Record<
  CampaignRowSummary["status"],
  { label: string; variant: "outline" | "secondary" }
> = {
  active: { label: "Active", variant: "secondary" },
  archived: { label: "Archived", variant: "outline" },
  draft: { label: "Draft", variant: "outline" },
  paused: { label: "Paused", variant: "outline" },
};

const createCampaignFormOpts = formOptions({
  defaultValues: {
    name: "",
    description: "",
  } satisfies CreateCampaignFormType as CreateCampaignFormType,
});

function CreateCampaignForm({
  onDone,
  organizationId,
  slug,
}: {
  onDone: () => void;
  organizationId: string;
  slug: string;
}) {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const createCampaign = useMutation(
    orpc.campaigns.createCampaign.mutationOptions()
  );
  const form = useAppForm({
    ...createCampaignFormOpts,
    validators: {
      onSubmit: CreateCampaignFormSchema,
    },
    onSubmit: async ({ value }) => {
      let campaignId: string;
      try {
        const result = await createCampaign.mutateAsync({
          organizationId,
          name: value.name.trim(),
          method: "preview",
          description: value.description.trim() || undefined,
        });
        campaignId = result.id;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not create campaign"
        );
        return;
      }
      onDone();
      await queryClient.invalidateQueries({
        queryKey: orpc.campaigns.key(),
      });
      await navigate({
        to: "/$orgSlug/campaigns/$campaignId",
        params: { orgSlug: slug, campaignId },
      });
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
        <form.AppField name="name">
          {(field) => (
            <field.Input
              label="Campaign name"
              placeholder="November outreach"
            />
          )}
        </form.AppField>
        <form.AppField name="description">
          {(field) => (
            <field.Textarea
              description="Optional. Shown next to the campaign name."
              label="Description"
            />
          )}
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
                Create campaign
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </form.AppForm>
  );
}

function CampaignsPage() {
  const { membership, queryClient } = Route.useRouteContext();
  const { organizationId, slug } = membership;
  const campaigns = useQuery(
    orpc.campaigns.listCampaigns.queryOptions({ input: { organizationId } })
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [archiving, setArchiving] = useState<CampaignRowSummary | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orpc.campaigns.key() });

  const reportError = (error: unknown) =>
    toast.error(campaignErrorMessage(error, "Campaign update failed"));

  const activateCampaign = useMutation({
    ...orpc.campaigns.activateCampaign.mutationOptions(),
    onError: reportError,
    onSuccess: async () => {
      toast.success("Campaign activated");
      await invalidate();
    },
  });

  const pauseCampaign = useMutation({
    ...orpc.campaigns.pauseCampaign.mutationOptions(),
    onError: reportError,
    onSuccess: async () => {
      toast.success("Campaign paused");
      await invalidate();
    },
  });

  const archiveCampaign = useMutation({
    ...orpc.campaigns.archiveCampaign.mutationOptions(),
    onError: reportError,
    onSuccess: async () => {
      setArchiving(null);
      toast.success("Campaign archived");
      await invalidate();
    },
  });

  const columns: ColumnDef<CampaignRowSummary>[] = [
    { accessorKey: "name", header: "Name" },
    {
      cell: ({ row }) => {
        const badge = statusBadges[row.original.status];
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      },
      header: "Status",
      id: "status",
    },
    { accessorKey: "leadListCount", header: "Lead lists" },
    { accessorKey: "numberCount", header: "Caller IDs" },
    {
      accessorKey: "updatedAt",
      cell: ({ row }) => new Date(row.original.updatedAt).toLocaleDateString(),
      header: "Updated",
    },
    {
      cell: ({ row }) => {
        const campaign = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="icon-sm" type="button" variant="ghost" />}
            >
              <IconDots />
              <span className="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                render={
                  <Link
                    params={{ orgSlug: slug, campaignId: campaign.id }}
                    to="/$orgSlug/campaigns/$campaignId"
                  />
                }
              >
                Open
              </DropdownMenuItem>
              {campaign.status === "draft" || campaign.status === "paused" ? (
                <DropdownMenuItem
                  onClick={() =>
                    activateCampaign.mutate({
                      organizationId,
                      campaignId: campaign.id,
                      expectedRevision: campaign.revision,
                    })
                  }
                >
                  Activate
                </DropdownMenuItem>
              ) : null}
              {campaign.status === "active" ? (
                <DropdownMenuItem
                  onClick={() =>
                    pauseCampaign.mutate({
                      organizationId,
                      campaignId: campaign.id,
                      expectedRevision: campaign.revision,
                    })
                  }
                >
                  Pause
                </DropdownMenuItem>
              ) : null}
              {campaign.status === "draft" || campaign.status === "paused" ? (
                <DropdownMenuItem
                  onClick={() => setArchiving(campaign)}
                  variant="destructive"
                >
                  Archive
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      header: "",
      id: "actions",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">Campaigns</h1>
          <p className="text-muted-foreground text-sm">
            Preview campaigns dial one lead at a time for an agent.
          </p>
        </div>
        <Dialog onOpenChange={setCreateOpen} open={createOpen}>
          <DialogTrigger render={<Button type="button" />}>
            New campaign
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a campaign</DialogTitle>
              <DialogDescription>
                The campaign starts as a draft. Add lead lists, caller IDs and
                timers before activating it.
              </DialogDescription>
            </DialogHeader>
            <CreateCampaignForm
              onDone={() => setCreateOpen(false)}
              organizationId={organizationId}
              slug={slug}
            />
          </DialogContent>
        </Dialog>
      </div>

      <DataTable columns={columns} data={campaigns.data} />

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setArchiving(null);
          }
        }}
        open={archiving !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {archiving?.name}?</DialogTitle>
            <DialogDescription>
              The campaign is kept for history but can no longer dial. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              disabled={archiveCampaign.isPending}
              onClick={() => {
                if (archiving) {
                  archiveCampaign.mutate({
                    organizationId,
                    campaignId: archiving.id,
                    expectedRevision: archiving.revision,
                  });
                }
              }}
              type="button"
              variant="destructive"
            >
              Archive campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
