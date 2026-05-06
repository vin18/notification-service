export type SendEmailInput = {
  to: string;
  from: string;
  subject: string;
  html: string;
};

export type SendEmailResult = {
  providerMessageId: string;
};

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
