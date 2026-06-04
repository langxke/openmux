export function createTerminalId(): string {
  return `term-${crypto.randomUUID()}`;
}
