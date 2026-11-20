import { IconArrowLeft } from "@tabler/icons-react";
import { formOptions } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ApiClient } from "@workholo/api-client";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workholo/ui/components/alert";
import { Badge } from "@workholo/ui/components/badge";
import { Button } from "@workholo/ui/components/button";
import { Checkbox } from "@workholo/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workholo/ui/components/dialog";
import { useAppForm } from "@workholo/ui/components/form/hooks";
import { SelectItem } from "@workholo/ui/components/select";
import { useState } from "react";
import { toast } from "sonner";

import { CampaignFormSchema } from "@/lib/schemas/campaign";
import type { CampaignFormType } from "@/lib/types";
import {
  type CampaignFieldErrors,
  campaignErrorMessage,
  campaignFieldErrors,
  parseCampaignAssignee,
} from "@/utils/campaign";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/campaigns/$campaignId")({
  component: CampaignEditorPage,
});

type CampaignDetail = Awaited<
  ReturnType<ApiClient["client"]["campaigns"]["getCampaign"]>
>;

const FIELD_LABELS: Record<string, string> = {
  assignee: "Assignment",
  callerIdMode: "Caller ID mode",
  dialStatuses: "Dial statuses",
  dispositionListId: "Disposition list",
  leadListIds: "Lead lists",
  name: "Campaign name",
  numberIds: "Caller IDs",
  previewSeconds: "Preview duration",
  retryCount: "Retry count",
  retryIntervalMinutes: "Retry interval",
  ringTimeoutSeconds: "Customer ring timeout",
  wrapUpSeconds: "Wrap-up seconds",
  afterCallWorkSeconds: "After-call work",
};

const statusBadges: Record<
  CampaignDetail["status"],
  { label: string; variant: "outline" | "secondary" }
> = {
  active: { label: "Active", variant: "secondary" },
  archived: { label: "Archived", variant: "outline" },
  draft: { label: "Draft", variant: "outline" },
  paused: { label: "Paused", variant: "outline" },
};

type CampaignLeadListChoice = {
  archived: boolean;
  id: string;
  name: string;
};

type CampaignNumberChoice = {
  disabled: boolean;
  id: string;
  number: string;
};

type CampaignChoice = { label: string; value: string };

function buildLeadListChoices(
  leadLists: { id: string; name: string }[],
  campaign: CampaignDetail
): CampaignLeadListChoice[] {
  const activeIds = new Set(leadLists.map((list) => list.id));
  return [
    ...leadLists.map((list) => ({
      archived: false,
      id: list.id,
      name: list.name,
    })),
    ...campaign.leadLists
      .filter((list) => !activeIds.has(list.id))
      .map((list) => ({
        archived: list.archivedAt !== null,
        id: list.id,
        name: list.name,
      })),
  ];
}

function buildDispositionChoices(
  lists: { id: string; name: string }[],
  current: CampaignDetail["dispositionList"]
): CampaignChoice[] {
  const choices: CampaignChoice[] = [
    { label: "No disposition list", value: "" },
    ...lists.map((list) => ({ label: list.name, value: list.id })),
  ];
  if (current && !lists.some((list) => list.id === current.id)) {
    choices.push({
      label: current.archivedAt ? `${current.name} (archived)` : current.name,
      value: current.id,
    });
  }
  return choices;
}

function buildNumberChoices(
  numbers: { id: string; number: string }[],
  current: CampaignDetail["numbers"]
): CampaignNumberChoice[] {
  const eligible = new Set(numbers.map((number) => number.id));
  return [
    ...numbers.map((number) => ({ ...number, disabled: false })),
    ...current
      .filter((number) => !eligible.has(number.id))
      .map((number) => ({
        disabled: !number.enabled,
        id: number.id,
        number: number.number,
      })),
  ];
}

function buildAssigneeChoices(
  teams: { id: string; name: string }[],
  directory: { userId: string; name: string; role: string }[],
  current: string
): CampaignChoice[] {
  const choices: CampaignChoice[] = [
    { label: "Unassigned", value: "" },
    ...teams.map((team) => ({
      label: `Team · ${team.name}`,
      value: `team:${team.id}`,
    })),
    ...directory
      .filter((member) => member.role === "agent")
      .map((member) => ({
        label: `Agent · ${member.name}`,
        value: `agent:${member.userId}`,
      })),
  ];
  if (current && !choices.some((choice) => choice.value === current)) {
    choices.push({ label: `${current} (not in roster)`, value: current });
  }
  return choices;
}

const campaignFormOpts = formOptions({
  defaultValues: {
    afterCallWorkSeconds: "",
    assignee: "",
    callerIdMode: "",
    description: "",
    dialStatuses: [],
    dispositionListId: "",
    leadListIds: [],
    name: "",
    numberIds: [],
    previewSeconds: "",
    retryCount: "",
    retryIntervalMinutes: "",
    ringTimeoutSeconds: "",
    wrapUpSeconds: "",
  } satisfies CampaignFormType as CampaignFormType,
});

function CheckboxOption({
  checked,
  description,
  id,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description?: string;
  id: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        checked={checked}
        id={id}
        onCheckedChange={(state) => onCheckedChange(state === true)}
      />
      <label className="text-sm leading-4" htmlFor={id}>
        {label}
        {description ? (
          <span className="text-muted-foreground"> {description}</span>
        ) : null}
      </label>
    </div>
  );
}

function CampaignEditorForm({
  campaign,
  campaignId,
  leadLists,
  dispositionLists,
  numbers,
  teams,
  directory,
  onFieldErrors,
}: {
  campaign: CampaignDetail;
  campaignId: string;
  leadLists: { id: string; name: string }[];
  dispositionLists: { id: string; name: string }[];
  numbers: { id: string; number: string }[];
  teams: { id: string; name: string }[];
  directory: { userId: string; name: string; role: string }[];
  onFieldErrors: (errors: CampaignFieldErrors | null) => void;
}) {
  const { membership, queryClient } = Route.useRouteContext();
  const { organizationId } = membership;
  const locked = campaign.status === "active" || campaign.status === "archived";
  const currentAssignee =
    campaign.assigneeType && campaign.assigneeId
      ? `${campaign.assigneeType}:${campaign.assigneeId}`
      : "";

  const updateCampaign = useMutation(
    orpc.campaigns.updateCampaign.mutationOptions()
  );
  const form = useAppForm({
    ...campaignFormOpts,
    defaultValues: {
      name: campaign.name,
      description: campaign.description ?? "",
      leadListIds: campaign.leadLists.map((list) => list.id),
      dispositionListId: campaign.dispositionList?.id ?? "",
      callerIdMode: campaign.callerIdMode ?? "",
      numberIds: campaign.numbers.map((number) => number.id),
      assignee: currentAssignee,
      previewSeconds: campaign.previewSeconds?.toString() ?? "",
      ringTimeoutSeconds: campaign.ringTimeoutSeconds?.toString() ?? "",
      wrapUpSeconds: campaign.wrapUpSeconds?.toString() ?? "",
      afterCallWorkSeconds: campaign.afterCallWorkSeconds?.toString() ?? "",
      retryCount: campaign.retryCount?.toString() ?? "",
      retryIntervalMinutes: campaign.retryIntervalMinutes?.toString() ?? "",
      dialStatuses: campaign.dialStatuses,
    } satisfies CampaignFormType as CampaignFormType,
    validators: {
      onSubmit: CampaignFormSchema,
    },
    onSubmit: async ({ value }) => {
      const assignee = parseCampaignAssignee(value.assignee);
      const numeric = (input: string) => (input === "" ? null : Number(input));
      try {
        await updateCampaign.mutateAsync({
          organizationId,
          campaignId,
          name: value.name.trim(),
          description: value.description.trim() || null,
          leadListIds: value.leadListIds,
          dispositionListId: value.dispositionListId || null,
          callerIdMode: value.callerIdMode || null,
          numberIds: value.numberIds,
          assigneeType: assignee?.type ?? null,
          assigneeId: assignee?.id ?? null,
          previewSeconds: numeric(value.previewSeconds),
          ringTimeoutSeconds: numeric(value.ringTimeoutSeconds),
          wrapUpSeconds: numeric(value.wrapUpSeconds),
          afterCallWorkSeconds: numeric(value.afterCallWorkSeconds),
          retryCount: numeric(value.retryCount),
          retryIntervalMinutes: numeric(value.retryIntervalMinutes),
          dialStatuses: value.dialStatuses,
        });
      } catch (error) {
        const fieldErrors = campaignFieldErrors(error);
        if (fieldErrors) {
          onFieldErrors(fieldErrors);
          return;
        }
        toast.error(campaignErrorMessage(error, "Could not save the campaign"));
        return;
      }
      onFieldErrors(null);
      toast.success("Campaign saved");
      await queryClient.invalidateQueries({
        queryKey: orpc.campaigns.key(),
      });
    },
  });

  const leadListOptions = buildLeadListChoices(leadLists, campaign);
  const dispositionItems = buildDispositionChoices(
    dispositionLists,
    campaign.dispositionList
  );
  const numberOptions = buildNumberChoices(numbers, campaign.numbers);
  const assigneeItems = buildAssigneeChoices(teams, directory, currentAssignee);

  return (
    <form.AppForm>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <fieldset className="space-y-6" disabled={locked}>
          <section className="space-y-4">
            <h2 className="font-medium text-lg">Basics</h2>
            <form.AppField name="name">
              {(field) => (
                <field.Input
                  label="Campaign name"
                  placeholder="November outreach"
                />
              )}
            </form.AppField>
            <form.AppField name="description">
              {(field) => <field.Textarea label="Description" />}
            </form.AppField>
          </section>

          <section className="space-y-4">
            <h2 className="font-medium text-lg">Resources</h2>

            <div className="space-y-2">
              <p className="font-medium text-sm">Lead lists</p>
              {leadListOptions.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No lead lists exist yet.
                </p>
              ) : null}
              <form.Field name="leadListIds">
                {(field) => (
                  <div className="space-y-2">
                    {leadListOptions.map((list) => (
                      <CheckboxOption
                        checked={field.state.value.includes(list.id)}
                        description={list.archived ? "(archived)" : undefined}
                        id={`lead-list-${list.id}`}
                        key={list.id}
                        label={list.name}
                        onCheckedChange={(checked) =>
                          field.handleChange(
                            checked
                              ? [...field.state.value, list.id]
                              : field.state.value.filter((id) => id !== list.id)
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </form.Field>
            </div>

            <form.AppField name="dispositionListId">
              {(field) => (
                <field.Select
                  items={dispositionItems}
                  label="Disposition list"
                  placeholder="No disposition list"
                >
                  {dispositionItems.map((item) => (
                    <SelectItem key={item.value || "none"} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            </form.AppField>

            <form.AppField
              listeners={{
                onChange: ({ value }) => {
                  if (value === "fixed") {
                    form.setFieldValue(
                      "numberIds",
                      form.getFieldValue("numberIds").slice(0, 1)
                    );
                  }
                },
              }}
              name="callerIdMode"
            >
              {(field) => (
                <field.Select
                  items={[
                    { label: "Not set", value: "" },
                    { label: "Fixed", value: "fixed" },
                    { label: "Random", value: "random" },
                  ]}
                  label="Caller ID mode"
                  placeholder="Not set"
                >
                  <SelectItem value="">Not set</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                </field.Select>
              )}
            </form.AppField>

            <div className="space-y-2">
              <p className="font-medium text-sm">Caller IDs</p>
              {numberOptions.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No eligible outbound numbers yet.
                </p>
              ) : null}
              <form.Subscribe selector={(state) => state.values.callerIdMode}>
                {(mode) => (
                  <form.Field name="numberIds">
                    {(field) => (
                      <div className="space-y-2">
                        {numberOptions.map((number) => (
                          <CheckboxOption
                            checked={field.state.value.includes(number.id)}
                            description={
                              number.disabled ? "(disabled)" : undefined
                            }
                            id={`caller-id-${number.id}`}
                            key={number.id}
                            label={number.number}
                            onCheckedChange={(checked) => {
                              if (!checked) {
                                field.handleChange(
                                  field.state.value.filter(
                                    (id) => id !== number.id
                                  )
                                );
                                return;
                              }
                              field.handleChange(
                                mode === "fixed"
                                  ? [number.id]
                                  : [...field.state.value, number.id]
                              );
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </form.Field>
                )}
              </form.Subscribe>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-medium text-lg">Assignment</h2>
            <form.AppField name="assignee">
              {(field) => (
                <field.Select
                  items={assigneeItems}
                  label="Assignee"
                  placeholder="Unassigned"
                >
                  {assigneeItems.map((item) => (
                    <SelectItem key={item.value || "none"} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            </form.AppField>
          </section>

          <section className="space-y-4">
            <h2 className="font-medium text-lg">Timers and policy</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.AppField name="previewSeconds">
                {(field) => (
                  <field.Input
                    label="Preview duration seconds"
                    min={1}
                    type="number"
                  />
                )}
              </form.AppField>
              <form.AppField name="ringTimeoutSeconds">
                {(field) => (
                  <field.Input
                    label="Customer ring timeout"
                    max={120}
                    min={1}
                    type="number"
                  />
                )}
              </form.AppField>
              <form.AppField name="wrapUpSeconds">
                {(field) => (
                  <field.Input label="Wrap-up seconds" min={0} type="number" />
                )}
              </form.AppField>
              <form.AppField name="afterCallWorkSeconds">
                {(field) => (
                  <field.Input
                    label="After-call work seconds"
                    min={0}
                    type="number"
                  />
                )}
              </form.AppField>
              <form.AppField name="retryCount">
                {(field) => (
                  <field.Input label="Retry count" min={0} type="number" />
                )}
              </form.AppField>
              <form.AppField name="retryIntervalMinutes">
                {(field) => (
                  <field.Input
                    label="Retry interval minutes"
                    min={1}
                    type="number"
                  />
                )}
              </form.AppField>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-sm">Dial statuses</p>
              <form.Field name="dialStatuses">
                {(field) => (
                  <div className="space-y-2">
                    <CheckboxOption
                      checked={field.state.value.includes("new")}
                      id="dial-status-new"
                      label="New"
                      onCheckedChange={(checked) =>
                        field.handleChange(
                          checked
                            ? [...field.state.value, "new"]
                            : field.state.value.filter(
                                (status) => status !== "new"
                              )
                        )
                      }
                    />
                    <CheckboxOption
                      checked={field.state.value.includes("not_answered")}
                      id="dial-status-not-answered"
                      label="Not answered"
                      onCheckedChange={(checked) =>
                        field.handleChange(
                          checked
                            ? [...field.state.value, "not_answered"]
                            : field.state.value.filter(
                                (status) => status !== "not_answered"
                              )
                        )
                      }
                    />
                  </div>
                )}
              </form.Field>
            </div>
          </section>
        </fieldset>

        {locked ? null : (
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button disabled={!canSubmit || isSubmitting} type="submit">
                {isSubmitting ? "Saving..." : "Save campaign"}
              </Button>
            )}
          </form.Subscribe>
        )}
      </form>
    </form.AppForm>
  );
}

function CampaignEditorPage() {
  const { membership, queryClient } = Route.useRouteContext();
  const { organizationId, slug } = membership;
  const { campaignId } = Route.useParams();
  const [fieldErrors, setFieldErrors] = useState<CampaignFieldErrors | null>(
    null
  );
  const [archiving, setArchiving] = useState(false);

  const campaign = useQuery(
    orpc.campaigns.getCampaign.queryOptions({
      input: { organizationId, campaignId },
    })
  );
  const leadLists = useQuery(
    orpc.leads.listActiveLeadLists.queryOptions({ input: { organizationId } })
  );
  const dispositionLists = useQuery(
    orpc.dispositions.listActiveDispositionLists.queryOptions({
      input: { organizationId },
    })
  );
  const numbers = useQuery(
    orpc.numbers.listEligibleOutboundNumbers.queryOptions({
      input: { organizationId },
    })
  );
  const teams = useQuery(
    orpc.organization.teams.queryOptions({ input: { organizationId } })
  );
  const directory = useQuery(
    orpc.organization.directory.queryOptions({ input: { organizationId } })
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orpc.campaigns.key() });

  const reportError = (error: unknown) => {
    const errors = campaignFieldErrors(error);
    if (errors) {
      setFieldErrors(errors);
      return;
    }
    toast.error(campaignErrorMessage(error, "Campaign update failed"));
  };

  const activateCampaign = useMutation({
    ...orpc.campaigns.activateCampaign.mutationOptions(),
    onError: reportError,
    onSuccess: async () => {
      setFieldErrors(null);
      toast.success("Campaign activated");
      await invalidate();
    },
  });

  const pauseCampaign = useMutation({
    ...orpc.campaigns.pauseCampaign.mutationOptions(),
    onError: reportError,
    onSuccess: async () => {
      setFieldErrors(null);
      toast.success("Campaign paused");
      await invalidate();
    },
  });

  const archiveCampaign = useMutation({
    ...orpc.campaigns.archiveCampaign.mutationOptions(),
    onError: reportError,
    onSuccess: async () => {
      setArchiving(false);
      toast.success("Campaign archived");
      await invalidate();
    },
  });

  const detail = campaign.data;

  return (
    <div className="space-y-4">
      <Button
        render={<Link params={{ orgSlug: slug }} to="/$orgSlug/campaigns" />}
        size="sm"
        type="button"
        variant="ghost"
      >
        <IconArrowLeft /> All campaigns
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-2xl">{detail?.name ?? "Campaign"}</h1>
            {detail ? (
              <Badge variant={statusBadges[detail.status].variant}>
                {statusBadges[detail.status].label}
              </Badge>
            ) : null}
          </div>
          {detail?.description ? (
            <p className="text-muted-foreground text-sm">
              {detail.description}
            </p>
          ) : null}
        </div>
        {detail ? (
          <div className="flex items-center gap-2">
            {detail.status === "draft" || detail.status === "paused" ? (
              <Button
                disabled={activateCampaign.isPending}
                onClick={() =>
                  activateCampaign.mutate({
                    organizationId,
                    campaignId,
                    expectedRevision: detail.revision,
                  })
                }
                type="button"
                variant="outline"
              >
                Activate
              </Button>
            ) : null}
            {detail.status === "active" ? (
              <Button
                disabled={pauseCampaign.isPending}
                onClick={() =>
                  pauseCampaign.mutate({
                    organizationId,
                    campaignId,
                    expectedRevision: detail.revision,
                  })
                }
                type="button"
                variant="outline"
              >
                Pause
              </Button>
            ) : null}
            {detail.status === "draft" || detail.status === "paused" ? (
              <Button
                onClick={() => setArchiving(true)}
                type="button"
                variant="destructive"
              >
                Archive
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {detail?.status === "active" ? (
        <p className="text-muted-foreground text-sm">
          Pause the campaign before editing.
        </p>
      ) : null}
      {detail?.status === "archived" ? (
        <p className="text-muted-foreground text-sm">
          Archived campaigns cannot be edited.
        </p>
      ) : null}

      {fieldErrors ? (
        <Alert variant="destructive">
          <AlertTitle>Campaign settings need attention</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {Object.entries(fieldErrors).map(([key, message]) => (
                <li key={key}>
                  {FIELD_LABELS[key] ?? key}: {message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {detail &&
      leadLists.data &&
      dispositionLists.data &&
      numbers.data &&
      teams.data &&
      directory.data ? (
        <CampaignEditorForm
          campaign={detail}
          campaignId={campaignId}
          directory={directory.data}
          dispositionLists={dispositionLists.data}
          leadLists={leadLists.data}
          numbers={numbers.data}
          onFieldErrors={setFieldErrors}
          teams={teams.data}
        />
      ) : null}

      <Dialog onOpenChange={setArchiving} open={archiving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {detail?.name}?</DialogTitle>
            <DialogDescription>
              The campaign is kept for history but can no longer dial. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              disabled={archiveCampaign.isPending}
              onClick={() => {
                if (detail) {
                  archiveCampaign.mutate({
                    organizationId,
                    campaignId,
                    expectedRevision: detail.revision,
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
