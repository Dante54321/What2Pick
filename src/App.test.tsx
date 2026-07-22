import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
})

async function addGame(name: string) {
  const user = userEvent.setup()

  await user.type(screen.getByLabelText(/game name/i), name)
  await user.click(screen.getByRole('button', { name: /add game/i }))
}

async function addGames(names: string[]) {
  for (const name of names) {
    await addGame(name)
  }
}

describe('App', () => {
  it('adds up to four games and only starts the bracket when full', async () => {
    const user = userEvent.setup()

    render(<App />)

    const startButton = screen.getByRole('button', { name: /start bracket/i })

    expect(startButton).toBeDisabled()
    expect(screen.getByText(/0 of 4 games added/i)).toBeInTheDocument()

    await addGames(['Elden Ring', 'Hades', 'Celeste', 'Balatro'])

    expect(screen.getByText(/4 of 4 games added/i)).toBeInTheDocument()
    expect(screen.getAllByText('Elden Ring')).toHaveLength(2)
    expect(screen.getAllByText('Hades')).toHaveLength(2)
    expect(screen.getAllByText('Celeste')).toHaveLength(2)
    expect(screen.getAllByText('Balatro')).toHaveLength(2)
    expect(screen.getByLabelText(/game name/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /add game/i })).toBeDisabled()
    expect(startButton).toBeEnabled()

    await user.click(startButton)

    expect(screen.getByRole('status')).toHaveTextContent(/bracket started/i)
  })

  it('prevents duplicate fixed bracket positions', async () => {
    const user = userEvent.setup()

    render(<App />)

    await addGames(['Elden Ring', 'Hades'])

    const positionSelects = screen.getAllByLabelText(/position/i)

    await user.selectOptions(positionSelects[0], 'A1')

    expect(
      within(positionSelects[1]).getByRole('option', { name: 'A1' }),
    ).toBeDisabled()
    expect(
      within(positionSelects[1]).getByRole('option', { name: 'A2' }),
    ).toBeEnabled()
  })

  it('advances semifinal winners into the final and selects a champion', async () => {
    const user = userEvent.setup()

    render(<App />)

    await addGames(['Elden Ring', 'Hades', 'Celeste', 'Balatro'])

    const positionSelects = screen.getAllByLabelText(/position/i)

    await user.selectOptions(positionSelects[0], 'A1')
    await user.selectOptions(positionSelects[1], 'A2')
    await user.selectOptions(positionSelects[2], 'B1')
    await user.selectOptions(positionSelects[3], 'B2')
    await user.click(screen.getByRole('button', { name: /start bracket/i }))

    await user.click(
      screen.getByRole('button', { name: /a1:\s*elden ring/i }),
    )
    await user.click(
      screen.getByRole('button', { name: /b2:\s*balatro/i }),
    )

    const finalEldenRing = screen.getByRole('button', { name: 'Elden Ring' })
    const finalBalatro = screen.getByRole('button', { name: 'Balatro' })

    expect(finalEldenRing).toBeEnabled()
    expect(finalBalatro).toBeEnabled()

    await user.click(finalEldenRing)

    expect(screen.getByText('Champion')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Elden Ring' })).toBeInTheDocument()
  })

  it('clears the champion when a semifinal winner changes', async () => {
    const user = userEvent.setup()

    render(<App />)

    await addGames(['Elden Ring', 'Hades', 'Celeste', 'Balatro'])

    const positionSelects = screen.getAllByLabelText(/position/i)

    await user.selectOptions(positionSelects[0], 'A1')
    await user.selectOptions(positionSelects[1], 'A2')
    await user.selectOptions(positionSelects[2], 'B1')
    await user.selectOptions(positionSelects[3], 'B2')
    await user.click(screen.getByRole('button', { name: /start bracket/i }))
    await user.click(
      screen.getByRole('button', { name: /a1:\s*elden ring/i }),
    )
    await user.click(
      screen.getByRole('button', { name: /b1:\s*celeste/i }),
    )
    await user.click(screen.getByRole('button', { name: 'Elden Ring' }))

    expect(screen.getByText('Champion')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /a2:\s*hades/i }))

    expect(screen.queryByText('Champion')).not.toBeInTheDocument()
  })
})
