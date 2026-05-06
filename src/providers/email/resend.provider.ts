import { env } from "../../config/env.js";

import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types.js";

type ResendResponse = {
  id?: string;
  message?: string;
};

export class ResendEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        html: input.html
      })
    });

    const payload = await response.json() as ResendResponse;

    if (!response.ok || !payload.id) {
      throw new Error(payload.message ?? "Resend request failed");
    }

    return {
      providerMessageId: payload.id
    };
  }
}
