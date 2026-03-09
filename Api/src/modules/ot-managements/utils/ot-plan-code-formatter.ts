/**
 * Format OT plan code as #OT-YYYY-NN
 */
export function formatOtPlanCode(id: number, createdAt: Date): string {
  const year = createdAt.getFullYear();
  const paddedId = String(id).padStart(2, '0');
  return `#OT-${year}-${paddedId}`;
}
