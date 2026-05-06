import { env } from "../../config/env.js";

import { MockEmailProvider } from "./mock.provider.js";
import { ResendEmailProvider } from "./resend.provider.js";
import type { EmailProvider } from "./types.js";

export function createEmailProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case "resend":
      return new ResendEmailProvider();
    case "mock":
    default:
      return new MockEmailProvider();
  }
}
