export function getImportableChoiceNames(
  bulkChoiceText: string,
  availableChoiceSlots: number,
) {
  const choiceNames = bulkChoiceText
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)

  const importableChoiceNames = choiceNames.slice(0, availableChoiceSlots)

  return {
    importableChoiceNames,
    skippedChoicesCount: choiceNames.length - importableChoiceNames.length,
  }
}
