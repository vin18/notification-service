import crypto from "node:crypto";

import { logger } from "../../lib/logger.js";

import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types.js";

export class MockEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
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
