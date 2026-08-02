export type OnlineParticipantIdentity = {
  id: string
  name: string
}

export function getOnlineParticipantsForJoin(
  participants: OnlineParticipantIdentity[],
  currentParticipantId: string,
  participantName: string,
  createParticipantId: () => string,
) {
  const existingParticipant = participants.find(
    (participant) => participant.id === currentParticipantId,
  )

  if (!existingParticipant) {
    return {
      participantId: currentParticipantId,
      participants: [
        ...participants,
        {
          id: currentParticipantId,
          name: participantName,
        },
      ],
    }
  }

  if (existingParticipant.name === participantName) {
    return {
      participantId: currentParticipantId,
      participants,
    }
  }

  const participantId = createParticipantId()

  return {
    participantId,
    participants: [
      ...participants,
      {
        id: participantId,
        name: participantName,
      },
    ],
  }
}
