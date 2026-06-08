import { EmailClient } from "@azure/communication-email";

/**
 * Sends the sign-in one-time code via Azure Communication Services Email.
 * Reads ACS_CONNECTION_STRING / ACS_SENDER_ADDRESS from the environment.
 */

let emailClient: EmailClient | null = null;

export function emailConfigured(): boolean {
  return Boolean(process.env.ACS_CONNECTION_STRING && process.env.ACS_SENDER_ADDRESS);
}

function getClient(): EmailClient {
  if (!emailClient) {
    emailClient = new EmailClient(process.env.ACS_CONNECTION_STRING as string);
  }
  return emailClient;
}

export async function sendSignInCode(toAddress: string, code: string): Promise<void> {
  const sender = process.env.ACS_SENDER_ADDRESS as string;
  const client = getClient();
  const poller = await client.beginSend({
    senderAddress: sender,
    content: {
      subject: `Your Rippers code: ${code}`,
      plainText: `Your Rippers sign-in code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      html: `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <p style="font-size:15px;color:#222">Your Rippers sign-in code is</p>
        <p style="font-size:34px;font-weight:800;letter-spacing:6px;color:#E5471A;margin:8px 0">${code}</p>
        <p style="font-size:13px;color:#666">It expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>`,
    },
    recipients: { to: [{ address: toAddress }] },
  });
  await poller.pollUntilDone();
}
