/**
 * Converts agent tool output into
 * AI-readable context.
 *
 * This means new tools can be added
 * without changing generate-workout.ts.
 */
export function buildContext(
  context: Record<string, any>
): string {
  const sections: string[] = [];

  for (const [key, value] of Object.entries(
    context
  )) {
    sections.push(`
=================================
${key.toUpperCase()}
=================================

${JSON.stringify(
  value,
  null,
  2
)}
`);
  }

  return sections.join("\n\n");
}
