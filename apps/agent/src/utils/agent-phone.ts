import {
  type Invitation,
  Registerer,
  RegistererState,
  UserAgent,
} from "sip.js";

async function waitForRegistererState(
  registerer: Registerer,
  expected: RegistererState,
  request: () => Promise<unknown>
): Promise<void> {
  if (registerer.state === expected) {
    return;
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let removeListener: () => void = () => undefined;
  const statePromise = new Promise<void>((resolve, reject) => {
    const onStateChange = (state: RegistererState) => {
      if (state === expected) {
        resolve();
      }
      if (
        state !== expected &&
        (state === RegistererState.Unregistered ||
          state === RegistererState.Terminated)
      ) {
        reject(new Error("SIP registration ended before it was confirmed"));
      }
    };
    registerer.stateChange.addListener(onStateChange);
    removeListener = () => registerer.stateChange.removeListener(onStateChange);
    timeout = setTimeout(
      () => reject(new Error("SIP registration response timed out")),
      10_000
    );
  });

  try {
    await Promise.all([request(), statePromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
    removeListener();
  }
}

export type PhoneCredentials = {
  sipUsername: string;
  sipPassword: string;
  sipDomain: string;
  wssUrl: string;
};

let unregisterCurrentPhone: (() => Promise<void>) | undefined;

export async function registerAgentPhone(
  credentials: PhoneCredentials,
  onInvite: (callId: string, invitation: Invitation) => void,
  onConnectionChange: (connected: boolean) => void
): Promise<() => Promise<void>> {
  await unregisterAgentPhone();
  const uri = UserAgent.makeURI(
    `sip:${credentials.sipUsername}@${credentials.sipDomain}`
  );
  if (!uri) {
    throw new Error("Phone account is invalid");
  }

  const userAgent = new UserAgent({
    authorizationPassword: credentials.sipPassword,
    authorizationUsername: credentials.sipUsername,
    delegate: {
      onConnect: () => onConnectionChange(true),
      onDisconnect: () => onConnectionChange(false),
      onInvite: (invitation) => {
        onInvite(invitation.request.getHeader("X-Call-Id") ?? "", invitation);
      },
    },
    logBuiltinEnabled: false,
    logConfiguration: false,
    uri,
    transportOptions: { server: credentials.wssUrl },
  });
  const registerer = new Registerer(userAgent);
  let cancelled = false;
  let stopPromise: Promise<void> | undefined;
  const stop = () => {
    cancelled = true;
    stopPromise ??= (async () => {
      if (registerer.state === RegistererState.Registered) {
        await waitForRegistererState(
          registerer,
          RegistererState.Unregistered,
          () => registerer.unregister()
        ).catch(() => undefined);
      }
      await userAgent.stop().catch(() => undefined);
    })();
    return stopPromise;
  };
  unregisterCurrentPhone = stop;

  try {
    await userAgent.start();
    await waitForRegistererState(registerer, RegistererState.Registered, () =>
      registerer.register()
    );
    if (cancelled) {
      throw new Error("Phone registration was cancelled");
    }
  } catch (error: unknown) {
    await stop();
    if (unregisterCurrentPhone === stop) {
      unregisterCurrentPhone = undefined;
    }
    throw new Error("Could not register the browser phone", { cause: error });
  }

  return stop;
}

export async function unregisterAgentPhone(): Promise<void> {
  const stop = unregisterCurrentPhone;
  unregisterCurrentPhone = undefined;
  await stop?.();
}
