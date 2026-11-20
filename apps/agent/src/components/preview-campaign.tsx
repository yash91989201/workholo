import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@workholo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workholo/ui/components/card";
import { useEffect, useRef, useState } from "react";
import { SessionState } from "sip.js";
import { client, orpc } from "@/utils/orpc";
import { useAgentPhone } from "@/utils/use-agent-phone";

const terminalCallStatuses = new Set(["ended", "rejected"]);
type Preview = NonNullable<
  Awaited<ReturnType<typeof client.preview.getState>>["preview"]
>;
type Attempt = NonNullable<
  Awaited<ReturnType<typeof client.preview.getState>>["attempt"]
>;
type Campaigns = Awaited<ReturnType<typeof client.preview.listCampaigns>>;

function useTerminalHistoryRefresh(
  attempt: Attempt | null | undefined,
  queryClient: ReturnType<typeof useQueryClient>
) {
  const lastAttemptRef = useRef<{ id: string; status: string } | null>(null);
  const attemptId = attempt?.id ?? null;
  const attemptStatus = attempt?.status ?? null;
  useEffect(() => {
    const previous = lastAttemptRef.current;
    const isNewTerminalAttempt =
      attemptId &&
      attemptStatus &&
      terminalCallStatuses.has(attemptStatus) &&
      (previous?.id !== attemptId ||
        !terminalCallStatuses.has(previous.status));
    if (isNewTerminalAttempt) {
      queryClient.invalidateQueries({ queryKey: orpc.calls.calls.key() });
    }
    lastAttemptRef.current =
      attemptId && attemptStatus
        ? { id: attemptId, status: attemptStatus }
        : null;
  }, [attemptId, attemptStatus, queryClient]);
}

function remainingTime(deadline: string | null): string | null {
  if (!deadline) {
    return null;
  }
  const seconds = Math.max(
    0,
    Math.ceil((Date.parse(deadline) - Date.now()) / 1000)
  );
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function phoneStatus(ready: boolean, connected: boolean): string {
  if (!ready) {
    return "Offline";
  }
  return connected
    ? "Ready · phone connected"
    : "Ready · phone disconnected. Go offline, then Ready to reconnect.";
}

function WorkControls({
  campaignId,
  campaigns,
  disabled,
  onCampaignChange,
  onOffline,
  onReady,
  phoneConnected,
  phoneBusy,
  phoneReady,
  serverPresence,
}: {
  campaignId: string;
  campaigns: Campaigns;
  disabled: boolean;
  onCampaignChange: (value: string) => void;
  onOffline: () => Promise<void>;
  onReady: () => Promise<void>;
  phoneConnected: boolean;
  phoneBusy: boolean;
  phoneReady: boolean;
  serverPresence: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid min-w-56 gap-1 text-sm">
        Campaign
        <select
          className="h-9 rounded-md border border-input bg-background px-3"
          disabled={disabled || phoneReady}
          onChange={(event) => onCampaignChange(event.currentTarget.value)}
          value={campaignId}
        >
          <option value="">Choose a campaign</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
      </label>
      {phoneReady ? (
        <Button disabled={phoneBusy} onClick={onOffline} variant="outline">
          Go offline
        </Button>
      ) : (
        <Button
          disabled={!campaignId || disabled || phoneBusy}
          onClick={onReady}
        >
          {phoneBusy ? "Registering phone…" : "Register phone and go ready"}
        </Button>
      )}
      <span className="text-muted-foreground text-sm" role="status">
        {phoneStatus(phoneReady, phoneConnected)} · service {serverPresence}
      </span>
    </div>
  );
}

function LeadPreviewCard({
  attemptIsActive,
  dialAllowed,
  dial,
  dialPending,
  onSkip,
  preview,
  skipPending,
}: {
  attemptIsActive: boolean;
  dialAllowed: boolean;
  dial: () => void;
  dialPending: boolean;
  onSkip: () => void;
  preview: Preview;
  skipPending: boolean;
}) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="font-semibold">Review lead</h3>
        <p className="text-lg">{preview.name ?? "Unnamed lead"}</p>
        <p className="text-muted-foreground">{preview.phone}</p>
        <p className="text-muted-foreground text-sm">
          Preview expires {new Date(preview.expiresAt).toLocaleTimeString()}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          disabled={!dialAllowed || dialPending || attemptIsActive}
          onClick={dial}
        >
          {dialPending ? "Starting call…" : "Dial"}
        </Button>
        <Button
          disabled={skipPending || attemptIsActive}
          onClick={onSkip}
          variant="outline"
        >
          Skip
        </Button>
      </div>
    </section>
  );
}

function CallStateCard({
  answer,
  attempt,
  dispositionId,
  hangup,
  incomingCallId,
  onDispositionChange,
  onSaveDisposition,
  savePending,
  sessionState,
}: {
  answer: () => Promise<void>;
  attempt: Attempt;
  dispositionId: string;
  hangup: () => Promise<void>;
  incomingCallId: string;
  onDispositionChange: (value: string) => void;
  onSaveDisposition: () => void;
  savePending: boolean;
  sessionState: SessionState | null;
}) {
  const wrapup = remainingTime(attempt.wrapupUntil);
  const hold = remainingTime(attempt.holdUntil);
  const { outcome } = attempt;
  const active = !terminalCallStatuses.has(attempt.status);
  const dispatchRemaining = remainingTime(attempt.dispatchExpiresAt);
  let dispatchMessage = "";
  if (attempt.status === "queued" && dispatchRemaining === "0:00") {
    dispatchMessage =
      "Dispatch is still being reconciled. This attempt remains reserved; do not dial again.";
  } else if (attempt.status === "queued" && dispatchRemaining) {
    dispatchMessage = `Dispatch pending · expires in ${dispatchRemaining}`;
  }

  return (
    <section aria-live="polite" className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="font-semibold">Call status</h3>
        <p className="capitalize">{attempt.status.replaceAll("_", " ")}</p>
        {outcome ? <p>Outcome: {outcome.replaceAll("_", " ")}</p> : null}
        {Boolean(attempt.disposition) && (
          <p>Disposition: {attempt.disposition?.label}</p>
        )}
        {attempt.hangupCause ? <p>Hangup: {attempt.hangupCause}</p> : null}
        {attempt.rejectReason ? <p>Dispatch: {attempt.rejectReason}</p> : null}
        {dispatchMessage ? (
          <p className="text-muted-foreground">{dispatchMessage}</p>
        ) : null}
        {hold && hold !== "0:00" && (
          <p className="text-muted-foreground">Next preview in {hold}</p>
        )}
      </div>
      {active && incomingCallId === attempt.id && (
        <div className="flex items-center gap-2">
          {sessionState === SessionState.Initial && (
            <Button onClick={answer}>Answer call</Button>
          )}
          <Button onClick={hangup} variant="destructive">
            Hang up
          </Button>
          <span className="text-muted-foreground text-sm">
            {sessionState === SessionState.Established
              ? "Connected"
              : "Ringing agent"}
          </span>
        </div>
      )}
      {wrapup &&
        wrapup !== "0:00" &&
        !attempt.disposition &&
        attempt.dispositionOptions.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-56 gap-1 text-sm">
              Disposition · {wrapup} left
              <select
                className="h-9 rounded-md border border-input bg-background px-3"
                onChange={(event) =>
                  onDispositionChange(event.currentTarget.value)
                }
                value={dispositionId}
              >
                <option value="">Choose a disposition</option>
                {attempt.dispositionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={!dispositionId || savePending}
              onClick={onSaveDisposition}
            >
              Save disposition
            </Button>
          </div>
        )}
    </section>
  );
}

export function PreviewCampaign({
  organizationId,
}: {
  organizationId: string;
}) {
  const queryClient = useQueryClient();
  const [campaignId, setCampaignId] = useState("");
  const [dispositionId, setDispositionId] = useState("");
  const [error, setError] = useState("");
  const phone = useAgentPhone(organizationId, campaignId);
  const campaigns = useQuery(
    orpc.preview.listCampaigns.queryOptions({ input: { organizationId } })
  );
  const agentState = useQuery(
    orpc.preview.getState.queryOptions({
      input: { organizationId },
      refetchInterval: 1500,
    })
  );
  const presence = useQuery(
    orpc.preview.getPresence.queryOptions({
      input: { organizationId },
      refetchInterval: 2000,
    })
  );
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: orpc.preview.getState.key() });
  const refreshHistory = () =>
    queryClient.invalidateQueries({ queryKey: orpc.calls.calls.key() });
  const claim = useMutation({
    mutationFn: (id: string) =>
      client.preview.claim({ campaignId: id, organizationId }),
    onSuccess: async (result) => {
      await refresh();
      setError(result ? "" : "No eligible lead is available in this campaign.");
    },
    onError: () =>
      setError("Could not claim a lead. Check your work status and try again."),
  });
  const skip = useMutation({
    mutationFn: (previewId: string) =>
      client.preview.skip({ organizationId, previewId }),
    onSuccess: async (skipped) => {
      await refresh();
      setError(
        skipped
          ? ""
          : "The preview expired or is no longer available; no call was placed."
      );
    },
    onError: () =>
      setError(
        "Could not skip this preview. Refresh the panel and check its status."
      ),
  });
  const dial = useMutation({
    mutationFn: (previewId: string) =>
      client.preview.dial({ organizationId, previewId }),
    onSuccess: refresh,
    onError: () =>
      setError(
        "Dial was not confirmed. Check this attempt's status before acting again."
      ),
  });
  const saveDisposition = useMutation({
    mutationFn: (callId: string) =>
      client.preview.submitDisposition({
        callId,
        dispositionId,
        organizationId,
      }),
    onSuccess: async (saved) => {
      await Promise.all([refresh(), refreshHistory()]);
      if (saved) {
        setDispositionId("");
        setError("");
      } else {
        setError("This disposition is no longer available for the call.");
      }
    },
    onError: () =>
      setError(
        "Could not save the disposition. Try again before wrap-up expires."
      ),
  });

  const preview = agentState.data?.preview;
  const attempt = agentState.data?.attempt;
  useTerminalHistoryRefresh(attempt, queryClient);
  const attemptIsActive = Boolean(
    attempt && !terminalCallStatuses.has(attempt.status)
  );
  const hold = remainingTime(attempt?.holdUntil ?? null);
  const canClaim =
    Boolean(agentState.data) &&
    !agentState.isError &&
    !(preview || attemptIsActive) &&
    (!hold || hold === "0:00");
  const handleSaveDisposition = () => {
    if (attempt && dispositionId) {
      saveDisposition.mutate(attempt.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview dialer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <WorkControls
          campaignId={campaignId}
          campaigns={campaigns.data ?? []}
          disabled={campaigns.isPending}
          onCampaignChange={setCampaignId}
          onOffline={phone.goOffline}
          onReady={phone.goReady}
          phoneBusy={phone.phoneBusy}
          phoneConnected={phone.phoneConnected}
          phoneReady={phone.phoneReady}
          serverPresence={presence.data?.presence ?? "offline"}
        />
        {phone.error || error ? (
          <p className="text-destructive text-sm" role="alert">
            {phone.error || error}
          </p>
        ) : null}
        {agentState.isError ? (
          <p className="text-muted-foreground text-sm" role="status">
            Call state is temporarily unavailable. No new preview will be
            offered until it can be checked.
          </p>
        ) : null}
        {campaigns.isError ? (
          <p className="text-destructive text-sm" role="alert">
            Could not load assigned campaigns.
          </p>
        ) : null}
        {preview ? (
          <LeadPreviewCard
            attemptIsActive={attemptIsActive}
            dial={() => dial.mutate(preview.id)}
            dialAllowed={phone.phoneReady && phone.phoneConnected}
            dialPending={dial.isPending}
            onSkip={() => skip.mutate(preview.id)}
            preview={preview}
            skipPending={skip.isPending}
          />
        ) : null}
        {attempt ? (
          <CallStateCard
            answer={phone.answer}
            attempt={attempt}
            dispositionId={dispositionId}
            hangup={phone.hangup}
            incomingCallId={phone.incomingCallId}
            onDispositionChange={setDispositionId}
            onSaveDisposition={handleSaveDisposition}
            savePending={saveDisposition.isPending}
            sessionState={phone.sessionState}
          />
        ) : null}
        {canClaim ? (
          <Button
            disabled={
              !(phone.phoneReady && phone.phoneConnected && campaignId) ||
              claim.isPending
            }
            onClick={() => claim.mutate(campaignId)}
          >
            {claim.isPending ? "Finding a lead…" : "Claim next lead"}
          </Button>
        ) : null}
        {/* The telephony service has no caption stream or transcription source. */}
        {/* biome-ignore lint/a11y/useMediaCaption: live SIP audio has no caption source */}
        <audio autoPlay className="hidden" ref={phone.audioRef} />
      </CardContent>
    </Card>
  );
}
