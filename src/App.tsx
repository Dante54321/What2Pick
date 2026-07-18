//npm run dev
//shift + alt + f correct indentation

import { useState, type FormEvent } from 'react'
import './App.css'

type FixedBracketPosition = 'A1' | 'A2' | 'B1' | 'B2'
type BracketPosition = 'random' | FixedBracketPosition

type Game = {
  id: string
  name: string
  position: BracketPosition
  randomOrder: number
}

const FIXED_BRACKET_POSITIONS: FixedBracketPosition[] = [
  'A1',
  'A2',
  'B1',
  'B2',
]

const BRACKET_POSITIONS: BracketPosition[] = [
  'random',
  ...FIXED_BRACKET_POSITIONS,
]

function getBracketAssignments(games: Game[]) {
  const assignments: Partial<
    Record<FixedBracketPosition, Game>
  > = {}

  games.forEach((game) => {
    if (game.position !== 'random') {
      assignments[game.position] = game
    }
  })

  const availablePositions = FIXED_BRACKET_POSITIONS.filter(
    (position) => !assignments[position],
  )

  const randomGames = games
    .filter((game) => game.position === 'random')
    .sort((firstGame, secondGame) =>
      firstGame.randomOrder - secondGame.randomOrder
    )

  randomGames.forEach((game, index) => {
    const availablePosition = availablePositions[index]

    if (availablePosition) {
      assignments[availablePosition] = game
    }
  })

  return assignments
}

function App() {
  const [gameName, setGameName] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [bracketStarted, setBracketStarted] = useState(false)
  const [matchAWinnerId, setMatchAWinnerId] = useState<string | null>(null)
  const [matchBWinnerId, setMatchBWinnerId] = useState<string | null>(null)
  const [championId, setChampionId] = useState<string | null>(null)

  const bracketAssignments = getBracketAssignments(games)

  const matchAWinner = games.find(
    (game) => game.id === matchAWinnerId,
  )

  const matchBWinner = games.find(
    (game) => game.id === matchBWinnerId,
  )

  const champion = games.find(
    (game) => game.id === championId,
  )

  const randomGamesCount = games.filter(
    (game) => game.position === 'random',
  ).length

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = gameName.trim()

    if (!trimmedName || games.length >= 4 || bracketStarted) {
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

  function selectSemifinalWinner(
    match: 'A' | 'B',
    game: Game | undefined,
  ) {
    if (!bracketStarted || !game) {
      return
    }

    setChampionId(null)

    if (match === 'A') {
      setMatchAWinnerId(game.id)
    } else {
      setMatchBWinnerId(game.id)
    }
  }

  function selectChampion(game: Game | undefined) {
    if (
      !bracketStarted ||
      !game ||
      !matchAWinner ||
      !matchBWinner
    ) {
      return
    }

    setChampionId(game.id)
  }

  function toggleBracket() {
    if (bracketStarted) {
      setBracketStarted(false)
      setMatchAWinnerId(null)
      setMatchBWinnerId(null)
      setChampionId(null)
      return
    }

    if (games.length === 4) {
      setMatchAWinnerId(null)
      setMatchBWinnerId(null)
      setBracketStarted(true)
      setChampionId(null)
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
        <p>{games.length} of 4 games added</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="game-name">Game name</label>

          <input
            id="game-name"
            type="text"
            placeholder="Example: Elden Ring"
            value={gameName}
            onChange={(event) => setGameName(event.target.value)}
            disabled={bracketStarted || games.length >= 4}
          />

          <button type="submit" disabled={bracketStarted || games.length >= 4}>
            Add game
          </button>
        </form>

        {games.length === 0 ? (
          <p>No games added yet.</p>
        ) : (
          <ul>
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
                  {BRACKET_POSITIONS.map((position) => {
                    const isOccupied =
                      position !== 'random' &&
                      games.some(
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
                        {position === 'random' ? 'Random' : position}
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
          disabled={!bracketStarted && games.length !== 4}
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

        <div>
          <h3>Semifinals</h3>

          <article>
            <h4>Match A</h4>

            <button
              type="button"
              className={
                matchAWinnerId === bracketAssignments.A1?.id
                  ? 'bracket-choice selected'
                  : 'bracket-choice'
              }
              onClick={() =>
                selectSemifinalWinner('A', bracketAssignments.A1)
              }
              disabled={!bracketStarted || !bracketAssignments.A1}
            >
              <strong>A1:</strong>
              <span>{bracketAssignments.A1?.name ?? 'Empty'}</span>
            </button>

            <button
              type="button"
              className={
                matchAWinnerId === bracketAssignments.A2?.id
                  ? 'bracket-choice selected'
                  : 'bracket-choice'
              }
              onClick={() =>
                selectSemifinalWinner('A', bracketAssignments.A2)
              }
              disabled={!bracketStarted || !bracketAssignments.A2}
            >
              <strong>A2:</strong>
              <span>{bracketAssignments.A2?.name ?? 'Empty'}</span>
            </button>
          </article>

          <article>
            <h4>Match B</h4>

            <button
              type="button"
              className={
                matchBWinnerId === bracketAssignments.B1?.id
                  ? 'bracket-choice selected'
                  : 'bracket-choice'
              }
              onClick={() =>
                selectSemifinalWinner('B', bracketAssignments.B1)
              }
              disabled={!bracketStarted || !bracketAssignments.B1}
            >
              <strong>B1:</strong>
              <span>{bracketAssignments.B1?.name ?? 'Empty'}</span>
            </button>

            <button
              type="button"
              className={
                matchBWinnerId === bracketAssignments.B2?.id
                  ? 'bracket-choice selected'
                  : 'bracket-choice'
              }
              onClick={() =>
                selectSemifinalWinner('B', bracketAssignments.B2)
              }
              disabled={!bracketStarted || !bracketAssignments.B2}
            >
              <strong>B2:</strong>
              <span>{bracketAssignments.B2?.name ?? 'Empty'}</span>
            </button>
          </article>
        </div>

        <div>
          <h3>Final</h3>

          <button
            type="button"
            className={
              championId === matchAWinner?.id
                ? 'final-choice selected'
                : 'final-choice'
            }
            onClick={() => selectChampion(matchAWinner)}
            disabled={!matchAWinner || !matchBWinner}
          >
            {matchAWinner?.name ?? 'Winner of Match A'}
          </button>

          <p>vs.</p>

          <button
            type="button"
            className={
              championId === matchBWinner?.id
                ? 'final-choice selected'
                : 'final-choice'
            }
            onClick={() => selectChampion(matchBWinner)}
            disabled={!matchAWinner || !matchBWinner}
          >
            {matchBWinner?.name ?? 'Winner of Match B'}
          </button>

          {champion && (
            <div className="champion-result" role="status">
              <p>Champion</p>
              <h3>{champion.name}</h3>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default App