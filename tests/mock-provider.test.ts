import test from "node:test";
import assert from "node:assert/strict";

import { MockEmailProvider } from "../src/providers/email/mock.provider.js";
import { EmailDeliveryError } from "../src/providers/email/errors.js";

test("mock provider sends successfully for normal recipients", async () => {
  const provider = new MockEmailProvider();
  const result = await provider.send({
    to: "ok@example.com",
    from: "notifications@example.com",
    subject: "hello",
    html: "<p>hello</p>"
  });

  assert.match(result.providerMessageId, /^mock_/);
});

test("mock provider throws non-retryable error for permfail addresses", async () => {
  const provider = new MockEmailProvider();

  await assert.rejects(
    () => provider.send({
      to: "permfail@example.com",
      from: "notifications@example.com",
      subject: "hello",
      html: "<p>hello</p>"
    }),
    (error: unknown) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.retryable, false);
      return true;
    }
  );
});

test("mock provider throws retryable error for tempfail addresses", async () => {
  const provider = new MockEmailProvider();

  await assert.rejects(
    () => provider.send({
      to: "tempfail@example.com",
      from: "notifications@example.com",
      subject: "hello",
      html: "<p>hello</p>"
    }),
    (error: unknown) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.retryable, true);
      return true;
    }
  );
});
