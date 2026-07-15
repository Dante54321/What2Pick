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

  const bracketAssignments = getBracketAssignments(games)

  const randomGamesCount = games.filter(
    (game) => game.position === 'random',
  ).length

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = gameName.trim()

    if (!trimmedName || games.length >= 4) {
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
            disabled={games.length >= 4}
          />

          <button type="submit" disabled={games.length >= 4}>
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
          disabled={randomGamesCount < 2}
        >
          Shuffle random games
        </button>
      </section>

      <section>
        <h2>Bracket preview</h2>

        <div>
          <h3>Semifinals</h3>

          <article>
            <h4>Match A</h4>
            <p>A1: {bracketAssignments.A1?.name ?? 'Empty'}</p>
            <p>A2: {bracketAssignments.A2?.name ?? 'Empty'}</p>
          </article>

          <article>
            <h4>Match B</h4>
            <p>B1: {bracketAssignments.B1?.name ?? 'Empty'}</p>
            <p>B2: {bracketAssignments.B2?.name ?? 'Empty'}</p>
          </article>
        </div>

        <div>
          <h3>Final</h3>
          <p>Winner of Match A</p>
          <p>vs.</p>
          <p>Winner of Match B</p>
        </div>
      </section>
    </main>
  )
}

export default App