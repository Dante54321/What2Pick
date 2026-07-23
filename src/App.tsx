import { useMemo, useState, type FormEvent } from 'react'
import { getReductionRoundPlan, getReductionRoundPlans } from './bracket'
import './App.css'

const MIN_BRACKET_ITEMS = 2
const MAX_BRACKET_ITEMS = 128

type FixedBracketPosition = `slot-${number}`
type BracketPosition = 'random' | FixedBracketPosition

type Game = {
  id: string
  name: string
  position: BracketPosition
  randomOrder: number
}

type BracketEntry =
  | {
      type: 'game'
      game: Game
    }
  | {
      type: 'match'
      matchId: string
    }

type BracketMatch = {
  id: string
  label: string
  participants: BracketEntry[]
}

type BracketRound = {
  id: string
  name: string
  matches: BracketMatch[]
}

function getRoundName(roundIndex: number, totalRounds: number) {
  const roundsRemaining = totalRounds - roundIndex

  if (roundsRemaining === 1) {
    return 'Final'
  }

  if (roundsRemaining === 2) {
    return 'Semifinals'
  }

  if (roundsRemaining === 3) {
    return 'Quarterfinals'
  }

  return `Round ${roundIndex + 1}`
}

function getBracketAssignments(games: Game[]) {
  const assignments: Array<Game | undefined> = Array.from({
    length: games.length,
  })

  games.forEach((game) => {
    if (game.position !== 'random') {
      const positionIndex = Number(game.position.replace('slot-', '')) - 1

      if (positionIndex >= 0 && positionIndex < assignments.length) {
        assignments[positionIndex] = game
      }
    }
  })

  const randomGames = games
    .filter((game) => game.position === 'random')
    .sort((firstGame, secondGame) =>
      firstGame.randomOrder - secondGame.randomOrder
    )

  let randomIndex = 0

  return assignments.map((assignedGame) => {
    if (assignedGame) {
      return assignedGame
    }

    const randomGame = randomGames[randomIndex]
    randomIndex += 1
    return randomGame
  })
}

function buildBracketRounds(orderedGames: Game[]) {
  const rounds: BracketRound[] = []
  let entries: BracketEntry[] = orderedGames.map((game) => ({
    type: 'game',
    game,
  }))

  if (entries.length < MIN_BRACKET_ITEMS) {
    return rounds
  }

  let reductionRoundPlan = getReductionRoundPlan(entries.length)

  while (reductionRoundPlan) {
    const roundNumber = rounds.length + 1
    const matches: BracketMatch[] = []
    const nextEntries: BracketEntry[] = []
    let entryIndex = 0

    for (let index = 0; index < reductionRoundPlan.pairMatchCount; index += 1) {
      const matchId = `r${roundNumber}-m${matches.length + 1}`

      matches.push({
        id: matchId,
        label: `Match ${matches.length + 1}`,
        participants: entries.slice(entryIndex, entryIndex + 2),
      })
      nextEntries.push({ type: 'match', matchId })
      entryIndex += 2
    }

    for (
      let index = 0;
      index < reductionRoundPlan.tripleMatchCount;
      index += 1
    ) {
      const matchId = `r${roundNumber}-m${matches.length + 1}`

      matches.push({
        id: matchId,
        label: `Match ${matches.length + 1}`,
        participants: entries.slice(entryIndex, entryIndex + 3),
      })
      nextEntries.push({ type: 'match', matchId })
      entryIndex += 3
    }

    rounds.push({
      id: `r${roundNumber}`,
      name: roundNumber === 1 ? 'Opening round' : `Reduction round ${roundNumber}`,
      matches,
    })
    entries = nextEntries
    reductionRoundPlan = getReductionRoundPlan(entries.length)
  }

  while (entries.length > 1) {
    const roundNumber = rounds.length + 1
    const matches: BracketMatch[] = []
    const nextEntries: BracketEntry[] = []

    for (let index = 0; index < entries.length; index += 2) {
      const matchId = `r${roundNumber}-m${matches.length + 1}`

      matches.push({
        id: matchId,
        label: `Match ${matches.length + 1}`,
        participants: entries.slice(index, index + 2),
      })
      nextEntries.push({ type: 'match', matchId })
    }

    rounds.push({
      id: `r${roundNumber}`,
      name: '',
      matches,
    })
    entries = nextEntries
  }

  return rounds.map((round, index) => ({
    ...round,
    name: round.name || getRoundName(index, rounds.length),
  }))
}

function App() {
  const [gameName, setGameName] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [bracketStarted, setBracketStarted] = useState(false)
  const [winnerByMatchId, setWinnerByMatchId] = useState<
    Record<string, string>
  >({})

  const bracketAssignments = useMemo(
    () => getBracketAssignments(games),
    [games],
  )
  const bracketRounds = useMemo(
    () => buildBracketRounds(bracketAssignments),
    [bracketAssignments],
  )
  const finalMatch = bracketRounds.at(-1)?.matches[0]
  const champion = finalMatch
    ? games.find((game) => game.id === winnerByMatchId[finalMatch.id])
    : undefined
  const randomGamesCount = games.filter(
    (game) => game.position === 'random',
  ).length
  const canStartBracket =
    games.length >= MIN_BRACKET_ITEMS && games.length <= MAX_BRACKET_ITEMS
  const positionOptions = Array.from(
    { length: games.length },
    (_, index) => `slot-${index + 1}` as FixedBracketPosition,
  )
  const reductionRoundPlans = getReductionRoundPlans(games.length)
  const reductionPairMatchesCount = reductionRoundPlans.reduce(
    (total, plan) => total + plan.pairMatchCount,
    0,
  )
  const reductionTripleMatchesCount = reductionRoundPlans.reduce(
    (total, plan) => total + plan.tripleMatchCount,
    0,
  )

  function findGame(gameId: string | undefined) {
    return games.find((game) => game.id === gameId)
  }

  function resolveEntry(entry: BracketEntry) {
    if (entry.type === 'game') {
      return entry.game
    }

    return findGame(winnerByMatchId[entry.matchId])
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = gameName.trim()

    if (!trimmedName || games.length >= MAX_BRACKET_ITEMS || bracketStarted) {
      return
    }

    const newGame: Game = {
      id: crypto.randomUUID(),
      name: trimmedName,
      position: 'random',
      randomOrder: Math.random(),
    }

    setGames([...games, newGame])
    setGameName('')
  }

  function removeGame(gameId: string) {
    setGames(games.filter((game) => game.id !== gameId))
  }

  function updateGamePosition(
    gameId: string,
    position: BracketPosition,
  ) {
    setGames(
      games.map((game) =>
        game.id === gameId ? { ...game, position } : game,
      ),
    )
  }

  function shuffleRandomGames() {
    setGames(
      games.map((game) =>
        game.position === 'random'
          ? { ...game, randomOrder: Math.random() }
          : game,
      ),
    )
  }

  function selectMatchWinner(
    roundIndex: number,
    matchId: string,
    game: Game | undefined,
  ) {
    if (!bracketStarted || !game) {
      return
    }

    setWinnerByMatchId((currentWinners) => {
      const nextWinners = { ...currentWinners, [matchId]: game.id }

      bracketRounds.slice(roundIndex + 1).forEach((round) => {
        round.matches.forEach((match) => {
          delete nextWinners[match.id]
        })
      })

      return nextWinners
    })
  }

  function toggleBracket() {
    if (bracketStarted) {
      setBracketStarted(false)
      setWinnerByMatchId({})
      return
    }

    if (canStartBracket) {
      setWinnerByMatchId({})
      setBracketStarted(true)
    }
  }

  return (
    <main>
      <header>
        <h1>What2Pick</h1>
        <p>Create a bracket. Make your choice.</p>
      </header>

      <section>
        <h2>Add your games</h2>
        <p>
          {games.length} of {MAX_BRACKET_ITEMS} games added. Start with at
          least {MIN_BRACKET_ITEMS}.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="game-name">Game name</label>

          <input
            id="game-name"
            type="text"
            placeholder="Example: Elden Ring"
            value={gameName}
            onChange={(event) => setGameName(event.target.value)}
            disabled={bracketStarted || games.length >= MAX_BRACKET_ITEMS}
          />

          <button
            type="submit"
            disabled={bracketStarted || games.length >= MAX_BRACKET_ITEMS}
          >
            Add game
          </button>
        </form>

        {games.length === 0 ? (
          <p>No games added yet.</p>
        ) : (
          <ul className="game-list">
            {games.map((game) => (
              <li key={game.id}>
                <span>{game.name}</span>

                <label htmlFor={`position-${game.id}`}>
                  Position
                </label>

                <select
                  id={`position-${game.id}`}
                  value={game.position}
                  onChange={(event) =>
                    updateGamePosition(
                      game.id,
                      event.target.value as BracketPosition,
                    )
                  }
                  disabled={bracketStarted}
                >
                  <option value="random">Random</option>

                  {positionOptions.map((position, index) => {
                    const isOccupied = games.some(
                      (otherGame) =>
                        otherGame.id !== game.id &&
                        otherGame.position === position,
                    )

                    return (
                      <option
                        key={position}
                        value={position}
                        disabled={isOccupied}
                      >
                        Slot {index + 1}
                      </option>
                    )
                  })}
                </select>

                <button
                  type="button"
                  onClick={() => removeGame(game.id)}
                  disabled={bracketStarted}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={shuffleRandomGames}
          disabled={bracketStarted || randomGamesCount < 2}
        >
          Shuffle random games
        </button>
        <button
          type="button"
          onClick={toggleBracket}
          disabled={!bracketStarted && !canStartBracket}
        >
          {bracketStarted ? 'Edit bracket setup' : 'Start bracket'}
        </button>

        {bracketStarted && (
          <p role="status">
            Bracket started. The setup is now locked.
          </p>
        )}
      </section>

      <section>
        <h2>Bracket preview</h2>

        {games.length < MIN_BRACKET_ITEMS ? (
          <p>Add at least {MIN_BRACKET_ITEMS} games to preview the bracket.</p>
        ) : (
          <>
            <p>
              {reductionRoundPlans.length > 0 ? (
                <>
                  Reducing over {reductionRoundPlans.length} round
                  {reductionRoundPlans.length === 1 ? '' : 's'} with{' '}
                  {reductionPairMatchesCount} two-player match
                  {reductionPairMatchesCount === 1 ? '' : 'es'} and{' '}
                  {reductionTripleMatchesCount} three-way match
                  {reductionTripleMatchesCount === 1 ? '' : 'es'}.
                </>
              ) : (
                'This bracket uses only two-player matches.'
              )}
            </p>

            <div className="bracket-rounds">
              {bracketRounds.map((round, roundIndex) => (
                <section className="bracket-round" key={round.id}>
                  <h3>{round.name}</h3>

                  {round.matches.map((match) => {
                    const resolvedParticipants =
                      match.participants.map(resolveEntry)
                    const isReady = resolvedParticipants.every(Boolean)

                    return (
                      <article key={match.id}>
                        <h4>{match.label}</h4>

                        {match.participants.map((participant, index) => {
                          const game = resolvedParticipants[index]
                          const isSelected =
                            game?.id === winnerByMatchId[match.id]
                          const placeholder =
                            participant.type === 'match'
                              ? `Winner of ${participant.matchId}`
                              : 'Empty'

                          return (
                            <button
                              type="button"
                              key={`${match.id}-${index}`}
                              className={
                                isSelected
                                  ? 'bracket-choice selected'
                                  : 'bracket-choice'
                              }
                              onClick={() =>
                                selectMatchWinner(roundIndex, match.id, game)
                              }
                              disabled={!bracketStarted || !isReady || !game}
                            >
                              <strong>Pick {index + 1}:</strong>
                              <span>{game?.name ?? placeholder}</span>
                            </button>
                          )
                        })}
                      </article>
                    )
                  })}
                </section>
              ))}
            </div>

            {champion && (
              <div className="champion-result" role="status">
                <p>Champion</p>
                <h3>{champion.name}</h3>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}

export default App
