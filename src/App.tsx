import { useState, type FormEvent } from 'react'
import './App.css'

type Game = {
  id: string
  name: string
}

function App() {
  const [gameName, setGameName] = useState('')
  const [games, setGames] = useState<Game[]>([])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = gameName.trim()

    if (!trimmedName || games.length >= 4) {
      return
    }

    const newGame: Game = {
      id: crypto.randomUUID(),
      name: trimmedName,
    }

    setGames([...games, newGame])
    setGameName('')
  }

  function removeGame(gameId: string) {
    setGames(games.filter((game) => game.id !== gameId))
  }

  return (
    <main>
      <h1>What2Pick</h1>
      <p>Create a bracket. Make your choice.</p>

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
                <button type="button" onClick={() => removeGame(game.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App