import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  authorizeIncomingInvite,
  authorizeInvite,
} from "./invite-authorization";

describe("authorizeInvite", () => {
  it("waits for the attempt when the INVITE arrives before Dial resolves", async () => {
    let reads = 0;
    const authorized = await authorizeInvite("call-1", async () => {
      reads += 1;
      return reads === 1 ? null : { id: "call-1", status: "agent_ringing" };
    });

    assert.equal(authorized, true);
    assert.equal(reads, 2);
  });

  it("refuses unmatched and terminal attempts", async () => {
    let wasRejected = false;
    assert.equal(
      await authorizeIncomingInvite(
        "unknown",
        async () => ({ id: "other", status: "queued" }),
        async () => {
          wasRejected = true;
        }
      ),
      false
    );
    assert.equal(wasRejected, true);
    assert.equal(
      await authorizeInvite("call-2", async () => ({
        id: "call-2",
        status: "ended",
      })),
      false
    );
  });
});
