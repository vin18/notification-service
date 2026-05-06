import crypto from "node:crypto";

import { logger } from "../../lib/logger.js";
import { EmailDeliveryError } from "./errors.js";

import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types.js";

export class MockEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (input.to.includes("permfail")) {
      throw new EmailDeliveryError("Mock permanent delivery failure", false);
    }

    if (input.to.includes("tempfail")) {
      throw new EmailDeliveryError("Mock transient delivery failure", true);
    }

    const providerMessageId = `mock_${crypto.randomUUID()}`;

    logger.info(
      {
        provider: "mock",
        providerMessageId,
        to: input.to,
        subject: input.subject
      },
      "Mock email sent"
    );

    return {
      providerMessageId
    };
  }
}
