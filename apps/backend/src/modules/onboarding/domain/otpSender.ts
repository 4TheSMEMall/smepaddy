export interface OtpSender {
  send(recipient: string, code: string): Promise<void>;
}
