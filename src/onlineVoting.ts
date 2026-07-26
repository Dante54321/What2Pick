export function getOnlineMatchWinnerFromVotes(
  votesForMatch: Record<string, string>,
  participantCount: number,
  random = Math.random,
) {
  if (
    participantCount <= 0 ||
    Object.keys(votesForMatch).length < participantCount
  ) {
    return undefined
  }

  const voteCounts = Object.values(votesForMatch).reduce<
    Record<string, number>
  >((counts, votedChoiceId) => {
    counts[votedChoiceId] = (counts[votedChoiceId] ?? 0) + 1
    return counts
  }, {})
  const sortedVoteCounts = Object.entries(voteCounts).sort(
    (firstVote, secondVote) => secondVote[1] - firstVote[1],
  )
  const topVoteCount = sortedVoteCounts[0]?.[1]

  if (!topVoteCount) {
    return undefined
  }

  const tiedTopChoiceIds = sortedVoteCounts
    .filter(([, voteCount]) => voteCount === topVoteCount)
    .map(([choiceId]) => choiceId)

  if (tiedTopChoiceIds.length === 1) {
    return tiedTopChoiceIds[0]
  }

  return tiedTopChoiceIds[Math.floor(random() * tiedTopChoiceIds.length)]
}
