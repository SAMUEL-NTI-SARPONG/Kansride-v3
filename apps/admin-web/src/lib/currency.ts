export function formatGhsFromPesewas(
  pesewas: number | null | undefined,
): string {
  if (
    typeof pesewas !== 'number' ||
    !Number.isSafeInteger(pesewas) ||
    pesewas < 0
  ) {
    return '--';
  }

  return `GHS ${(pesewas / 100).toFixed(2)}`;
}
