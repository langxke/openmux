let nextId = 1;

export function createTerminalId(): string {
  return `term-${nextId++}`;
}
