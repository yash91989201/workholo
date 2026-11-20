import { useEffect, useRef, useState } from "react";
import { type Invitation, SessionState, Web } from "sip.js";
import { registerAgentPhone, unregisterAgentPhone } from "@/utils/agent-phone";
import { authorizeIncomingInvite } from "@/utils/invite-authorization";
import { client } from "@/utils/orpc";

function bindInvitation(
  invitation: Invitation,
  audio: HTMLAudioElement | null,
  onStateChange: (state: SessionState) => void
): void {
  invitation.delegate = {
    onSessionDescriptionHandler: (handler) => {
      if (handler instanceof Web.SessionDescriptionHandler && audio) {
        audio.srcObject = handler.remoteMediaStream;
      }
    },
  };
  invitation.stateChange.addListener((state) => {
    onStateChange(state);
    if (
      state === SessionState.Established &&
      invitation.sessionDescriptionHandler instanceof
        Web.SessionDescriptionHandler &&
      audio
    ) {
      audio.srcObject = invitation.sessionDescriptionHandler.remoteMediaStream;
      audio.play().catch(() => undefined);
    }
  });
}

export function useAgentPhone(organizationId: string, campaignId: string) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const invitationRef = useRef<Invitation | null>(null);
  const operationRef = useRef(0);
  const readyPendingRef = useRef<boolean>(false);
  const [phoneReady, setPhoneReady] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [incomingCallId, setIncomingCallId] = useState("");
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      operationRef.current += 1;
      unregisterAgentPhone().catch(() => undefined);
    },
    []
  );

  const receiveInvite = async (callId: string, invitation: Invitation) => {
    try {
      const authorized = await authorizeIncomingInvite(
        callId,
        async () => {
          const state = await client.preview.getState({ organizationId });
          return state.attempt
            ? { id: state.attempt.id, status: state.attempt.status }
            : null;
        },
        () => invitation.reject()
      );
      if (!authorized) {
        return;
      }
      invitationRef.current = invitation;
      setIncomingCallId(callId);
      setSessionState(invitation.state);
      bindInvitation(invitation, audioRef.current, setSessionState);
    } catch {
      await invitation.reject().catch(() => undefined);
    }
  };

  const goReady = async () => {
    if (readyPendingRef.current) {
      return;
    }
    if (!campaignId) {
      setError("Choose a campaign before going ready.");
      return;
    }
    readyPendingRef.current = true;
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    setPhoneBusy(true);
    setError("");
    try {
      const credentials = await client.preview.preparePhone({
        campaignId,
        organizationId,
      });
      if (operationRef.current !== operation) {
        return;
      }
      await registerAgentPhone(credentials, receiveInvite, setPhoneConnected);
      if (operationRef.current !== operation) {
        await unregisterAgentPhone();
        return;
      }
      const ready = await client.preview.setWorkStatus({
        campaignId,
        organizationId,
        status: "ready",
      });
      if (!ready) {
        throw new Error("Ready status was not accepted");
      }
      if (operationRef.current !== operation) {
        await client.preview
          .setWorkStatus({ organizationId, status: "offline" })
          .catch(() => false);
        await unregisterAgentPhone();
        return;
      }
      setPhoneReady(true);
    } catch {
      if (operationRef.current !== operation) {
        return;
      }
      await unregisterAgentPhone();
      await client.preview
        .setWorkStatus({ organizationId, status: "offline" })
        .catch(() => undefined);
      setPhoneConnected(false);
      setError(
        "Could not register the phone or go ready. Check microphone access and try again."
      );
    } finally {
      if (operationRef.current === operation) {
        readyPendingRef.current = false;
        setPhoneBusy(false);
      }
    }
  };

  const goOffline = async () => {
    operationRef.current += 1;
    readyPendingRef.current = false;
    setPhoneBusy(true);
    setError("");
    try {
      await client.preview.setWorkStatus({ organizationId, status: "offline" });
    } catch {
      setError(
        "Could not update work status. The phone is being disconnected."
      );
    }
    await unregisterAgentPhone();
    invitationRef.current = null;
    setIncomingCallId("");
    setSessionState(null);
    setPhoneReady(false);
    setPhoneConnected(false);
    setPhoneBusy(false);
  };

  const answer = async () => {
    const invitation = invitationRef.current;
    if (!invitation) {
      return;
    }
    try {
      await invitation.accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
        },
      });
      setSessionState(invitation.state);
    } catch {
      setError("The call could not be answered. Check microphone access.");
    }
  };

  const hangup = async () => {
    const invitation = invitationRef.current;
    if (!invitation) {
      return;
    }
    try {
      if (invitation.state === SessionState.Established) {
        await invitation.bye();
      } else {
        await invitation.reject();
      }
    } catch {
      setError(
        "Could not end the call. Wait for the service to update call state."
      );
    }
  };

  return {
    answer,
    audioRef,
    error,
    goOffline,
    goReady,
    hangup,
    incomingCallId,
    phoneBusy,
    phoneConnected,
    phoneReady,
    sessionState,
  };
}
