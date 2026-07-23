import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { getReductionRoundPlan, getReductionRoundPlans } from './bracket'

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
  it('starts a bracket with the minimum of two games', async () => {
    const user = userEvent.setup()

    render(<App />)

    const startButton = screen.getByRole('button', { name: /start bracket/i })

    expect(startButton).toBeDisabled()
    expect(screen.getByText(/0 of 128 games added/i)).toBeInTheDocument()

    await addGames(['Elden Ring', 'Hades'])

    expect(screen.getByText(/2 of 128 games added/i)).toBeInTheDocument()
    expect(startButton).toBeEnabled()

    await user.click(startButton)

    expect(screen.getByText(/bracket started/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /final/i })).toBeInTheDocument()
  })

  it('prevents duplicate fixed bracket slots', async () => {
    const user = userEvent.setup()

    render(<App />)

    await addGames(['Elden Ring', 'Hades'])

    const positionSelects = screen.getAllByLabelText(/position/i)

    await user.selectOptions(positionSelects[0], 'slot-1')

    expect(
      within(positionSelects[1]).getByRole('option', { name: 'Slot 1' }),
    ).toBeDisabled()
    expect(
      within(positionSelects[1]).getByRole('option', { name: 'Slot 2' }),
    ).toBeEnabled()
  })

  it('advances winners through a four-game bracket and selects a champion', async () => {
    const user = userEvent.setup()

    render(<App />)

    await addGames(['Elden Ring', 'Hades', 'Celeste', 'Balatro'])

    const positionSelects = screen.getAllByLabelText(/position/i)

    await user.selectOptions(positionSelects[0], 'slot-1')
    await user.selectOptions(positionSelects[1], 'slot-2')
    await user.selectOptions(positionSelects[2], 'slot-3')
    await user.selectOptions(positionSelects[3], 'slot-4')
    await user.click(screen.getByRole('button', { name: /start bracket/i }))

    await user.click(
      screen.getByRole('button', { name: /pick 1:\s*elden ring/i }),
    )
    await user.click(
      screen.getByRole('button', { name: /pick 2:\s*balatro/i }),
    )

    const finalEldenRing = screen.getAllByRole('button', {
      name: /elden ring/i,
    }).at(-1)

    expect(finalEldenRing).toBeEnabled()

    await user.click(finalEldenRing!)

    expect(screen.getByText('Champion')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Elden Ring' })).toBeInTheDocument()
  })

  it('clears later winners when an earlier winner changes', async () => {
    const user = userEvent.setup()

    render(<App />)

    await addGames(['Elden Ring', 'Hades', 'Celeste', 'Balatro'])

    const positionSelects = screen.getAllByLabelText(/position/i)

    await user.selectOptions(positionSelects[0], 'slot-1')
    await user.selectOptions(positionSelects[1], 'slot-2')
    await user.selectOptions(positionSelects[2], 'slot-3')
    await user.selectOptions(positionSelects[3], 'slot-4')
    await user.click(screen.getByRole('button', { name: /start bracket/i }))
    await user.click(
      screen.getByRole('button', { name: /pick 1:\s*elden ring/i }),
    )
    await user.click(
      screen.getByRole('button', { name: /pick 1:\s*celeste/i }),
    )
    await user.click(screen.getAllByRole('button', { name: /elden ring/i }).at(-1)!)

    expect(screen.getByText('Champion')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /pick 2:\s*hades/i }))

    expect(screen.queryByText('Champion')).not.toBeInTheDocument()
  })

  it('uses pairs and a three-way opening match when nine games need four winners', async () => {
    const user = userEvent.setup()

    render(<App />)

    await addGames([
      'Elden Ring',
      'Hades',
      'Celeste',
      'Balatro',
      'Inside',
      'Portal',
      'Disco Elysium',
      'Hollow Knight',
      'Tunic',
    ])

    const positionSelects = screen.getAllByLabelText(/position/i)

    for (let index = 0; index < positionSelects.length; index += 1) {
      await user.selectOptions(positionSelects[index], `slot-${index + 1}`)
    }

    expect(
      screen.getByText(
        /reducing over 1 round with 3 two-player matches and 1 three-way match/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /pick 3:\s*tunic/i }),
    ).toBeInTheDocument()
  })

  it('plans repeated reduction rounds without automatic advances', () => {
    expect(getReductionRoundPlan(9)).toEqual({
      targetSize: 4,
      pairMatchCount: 3,
      tripleMatchCount: 1,
    })

    expect(getReductionRoundPlans(100)).toEqual([
      {
        targetSize: 50,
        pairMatchCount: 50,
        tripleMatchCount: 0,
      },
      {
        targetSize: 25,
        pairMatchCount: 25,
        tripleMatchCount: 0,
      },
      {
        targetSize: 12,
        pairMatchCount: 11,
        tripleMatchCount: 1,
      },
      {
        targetSize: 4,
        pairMatchCount: 0,
        tripleMatchCount: 4,
      },
    ])
  })

  it('returns no reduction plan for a power-of-two count', () => {
    expect(getReductionRoundPlan(128)).toBeNull()
    expect(getReductionRoundPlans(128)).toEqual([])
  })
})
