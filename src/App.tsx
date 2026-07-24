import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
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

type BracketRoundColumn = {
  id: string
  name: string
  roundIndex: number
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
  const bracketScrollbarRef = useRef<HTMLDivElement>(null)
  const bracketViewportRef = useRef<HTMLDivElement>(null)

  const bracketAssignments = useMemo(
    () => getBracketAssignments(games),
    [games],
  )
  const bracketRounds = useMemo(
    () => buildBracketRounds(bracketAssignments),
    [bracketAssignments],
  )
  const matchById = useMemo(() => {
    const matches = new Map<string, BracketMatch>()

    bracketRounds.forEach((round) => {
      round.matches.forEach((match) => {
        matches.set(match.id, match)
      })
    })

    return matches
  }, [bracketRounds])
  const finalMatch = bracketRounds.at(-1)?.matches[0]
  const finalBranchMatchIds = useMemo(() => {
    function collectBranchMatches(
      entry: BracketEntry | undefined,
      matches: Set<string>,
    ) {
      if (!entry || entry.type !== 'match') {
        return
      }

      matches.add(entry.matchId)

      const match = matchById.get(entry.matchId)

      match?.participants.forEach((participant) => {
        collectBranchMatches(participant, matches)
      })
    }

    const left = new Set<string>()
    const right = new Set<string>()

    collectBranchMatches(finalMatch?.participants[0], left)
    collectBranchMatches(finalMatch?.participants[1], right)

    return { left, right }
  }, [finalMatch, matchById])
  const sideRoundColumns = useMemo(
    () =>
      bracketRounds.slice(0, -1).map((round, roundIndex) => ({
        left: {
          id: `${round.id}-left`,
          name: round.name,
          roundIndex,
          matches: round.matches.filter((match) =>
            finalBranchMatchIds.left.has(match.id),
          ),
        },
        right: {
          id: `${round.id}-right`,
          name: round.name,
          roundIndex,
          matches: round.matches.filter((match) =>
            finalBranchMatchIds.right.has(match.id),
          ),
        },
      })),
    [bracketRounds, finalBranchMatchIds],
  )
  const leftRoundColumns = sideRoundColumns
    .map((round) => round.left)
    .filter((round) => round.matches.length > 0)
  const rightRoundColumns = sideRoundColumns
    .map((round) => round.right)
    .filter((round) => round.matches.length > 0)
    .reverse()
  const finalRoundColumn = bracketRounds.at(-1)
    ? {
        ...bracketRounds.at(-1)!,
        roundIndex: bracketRounds.length - 1,
      }
    : undefined
  const bracketColumnCount =
    leftRoundColumns.length + rightRoundColumns.length +
    (finalRoundColumn ? 1 : 0)
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

  useEffect(() => {
    const scrollbar = bracketScrollbarRef.current
    const viewport = bracketViewportRef.current

    if (!scrollbar || !viewport || bracketColumnCount <= 1) {
      return
    }

    requestAnimationFrame(() => {
      const centeredScrollLeft =
        Math.max(0, viewport.scrollWidth - viewport.clientWidth) / 2

      viewport.scrollLeft = centeredScrollLeft
      scrollbar.scrollLeft = centeredScrollLeft
    })
  }, [bracketColumnCount, games.length])

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

  function syncBracketScroll(source: 'scrollbar' | 'viewport') {
    const scrollbar = bracketScrollbarRef.current
    const viewport = bracketViewportRef.current

    if (!scrollbar || !viewport) {
      return
    }

    if (source === 'scrollbar') {
      viewport.scrollLeft = scrollbar.scrollLeft
      return
    }

    scrollbar.scrollLeft = viewport.scrollLeft
  }

  function getRoundVisualStyle(depth: number) {
    const depthScale = 2 ** depth - 1

    return {
      '--round-gap': `${0.8 + depthScale * 8.3}rem`,
      '--round-pad': `${depthScale * 4.7}rem`,
    } as CSSProperties
  }

  function renderRoundColumn(
    round: BracketRoundColumn,
    side: 'left' | 'center' | 'right',
    depth = 0,
  ) {
    return (
      <section
        className={`bracket-round bracket-round-${side}`}
        key={round.id}
        style={side === 'center' ? undefined : getRoundVisualStyle(depth)}
      >
        <h3>{round.name}</h3>

        <div className="bracket-match-stack">
          {round.matches.map((match) => {
            const resolvedParticipants = match.participants.map(resolveEntry)
            const isReady = resolvedParticipants.every(Boolean)

            return (
              <article key={match.id}>
                <h4>{match.label}</h4>

                {match.participants.map((participant, index) => {
                  const game = resolvedParticipants[index]
                  const isSelected = game?.id === winnerByMatchId[match.id]
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
                        selectMatchWinner(round.roundIndex, match.id, game)
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
        </div>
      </section>
    )
  }

  return (
    <main className={bracketStarted ? 'playing-phase' : 'setup-phase'}>
      <header>
        <div className="brand-lockup">
          <svg
            aria-hidden="true"
            className="brand-mark"
            viewBox="0 0 64 64"
          >
            <path
              d="M14 15h12c6 0 10 4 10 10v14c0 6 4 10 10 10h4"
              className="brand-path brand-path-left"
            />
            <path
              d="M50 15H38c-6 0-10 4-10 10v14c0 6-4 10-10 10h-4"
              className="brand-path brand-path-right"
            />
            <circle cx="14" cy="15" r="5" className="brand-node" />
            <circle cx="50" cy="15" r="5" className="brand-node" />
            <circle cx="32" cy="32" r="6" className="brand-core" />
            <path d="m28 32 3 3 6-7" className="brand-check" />
          </svg>

          <h1>What2Pick</h1>
        </div>
        <p>Create a bracket. Make your choice.</p>
      </header>

      {!bracketStarted && (
        <section className="setup-panel">
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
        </section>
      )}

      <section className="bracket-panel">
        <div className="bracket-panel-header">
          <div>
            <h2>{bracketStarted ? 'Choose the winner' : 'Bracket preview'}</h2>

            {bracketStarted && (
              <p role="status">
                Bracket started. The setup is now locked.
              </p>
            )}
          </div>

          {bracketStarted && (
            <button type="button" onClick={toggleBracket}>
              Edit bracket setup
            </button>
          )}
        </div>

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

            <div
              className="bracket-scrollbar"
              aria-label="Scroll bracket rounds horizontally"
              ref={bracketScrollbarRef}
              onScroll={() => syncBracketScroll('scrollbar')}
            >
              <div
                className="bracket-scrollbar-content"
                style={{
                  width: `${bracketColumnCount * 19 - 1}rem`,
                }}
              />
            </div>

            <div
              className="bracket-viewport"
              aria-label="Bracket rounds"
              ref={bracketViewportRef}
              onScroll={() => syncBracketScroll('viewport')}
            >
              <div className="bracket-rounds bracket-arena">
                <div className="bracket-side bracket-side-left">
                  {leftRoundColumns.map((round, index) =>
                    renderRoundColumn(round, 'left', index),
                  )}
                </div>

                {finalRoundColumn && (
                  <div className="bracket-final-column">
                    {renderRoundColumn(finalRoundColumn, 'center')}
                  </div>
                )}

                <div className="bracket-side bracket-side-right">
                  {rightRoundColumns.map((round, index) =>
                    renderRoundColumn(
                      round,
                      'right',
                      rightRoundColumns.length - index - 1,
                    ),
                  )}
                </div>
              </div>
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
