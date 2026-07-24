import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getReductionRoundPlan, getReductionRoundPlans } from './bracket'
import { getImportableChoiceNames } from './importChoices'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

async function addChoice(name: string) {
  const user = userEvent.setup()

  await user.type(screen.getByLabelText(/choice name/i), name)
  await user.click(screen.getByRole('button', { name: /add choice/i }))
}

async function addChoices(names: string[]) {
  for (const name of names) {
    await addChoice(name)
  }
}

describe('App', () => {
  it('starts a bracket with the minimum of two choices', async () => {
    const user = userEvent.setup()

    render(<App />)

    const startButton = screen.getByRole('button', { name: /start bracket/i })

    expect(startButton).toBeDisabled()
    expect(screen.getByText(/0 of 128 choices added/i)).toBeInTheDocument()

    await addChoices(['Elden Ring', 'Hades'])

    expect(screen.getByText(/2 of 128 choices added/i)).toBeInTheDocument()
    expect(startButton).toBeEnabled()

    await user.click(startButton)

    expect(screen.getByText(/bracket started/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/choice name/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /edit bracket setup/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /final/i })).toBeInTheDocument()
  })

  it('prevents duplicate fixed bracket slots', async () => {
    const user = userEvent.setup()

    render(<App />)

    await addChoices(['Elden Ring', 'Hades'])

    const positionSelects = screen.getAllByLabelText(/position/i)

    await user.selectOptions(positionSelects[0], 'slot-1')

    expect(
      within(positionSelects[1]).getByRole('option', { name: 'Slot 1' }),
    ).toBeDisabled()
    expect(
      within(positionSelects[1]).getByRole('option', { name: 'Slot 2' }),
    ).toBeEnabled()
  })

  it('imports bulk choices while ignoring empty lines', async () => {
    const user = userEvent.setup()

    render(<App />)

    fireEvent.change(screen.getByLabelText(/bulk choices/i), {
      target: { value: 'Pizza\n\nSushi\n  Tacos  ' },
    })

    expect(screen.getByText(/3 ready\. 128 slots available/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /add list/i }))

    const list = screen.getByRole('list')

    expect(screen.getByText(/3 of 128 choices added/i)).toBeInTheDocument()
    expect(within(list).getByText('Pizza')).toBeInTheDocument()
    expect(within(list).getByText('Sushi')).toBeInTheDocument()
    expect(within(list).getByText('Tacos')).toBeInTheDocument()
    expect(screen.getByLabelText(/bulk choices/i)).toHaveValue('')
  })

  it('limits bulk imports to the remaining choice slots', () => {
    expect(getImportableChoiceNames('Extra 1\nExtra 2\nExtra 3', 2)).toEqual({
      importableChoiceNames: ['Extra 1', 'Extra 2'],
      skippedChoicesCount: 1,
    })
  })

  it('persists choices and fixed positions across reloads', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await addChoices(['Elden Ring', 'Hades'])

    const positionSelects = screen.getAllByLabelText(/position/i)

    await user.selectOptions(positionSelects[0], 'slot-1')
    await user.selectOptions(positionSelects[1], 'slot-2')

    unmount()
    render(<App />)

    expect(screen.getByText(/2 of 128 choices added/i)).toBeInTheDocument()
    const restoredList = screen.getByRole('list')

    expect(within(restoredList).getByText('Elden Ring')).toBeInTheDocument()
    expect(within(restoredList).getByText('Hades')).toBeInTheDocument()

    const restoredPositionSelects = screen.getAllByLabelText(/position/i)

    expect(restoredPositionSelects[0]).toHaveValue('slot-1')
    expect(restoredPositionSelects[1]).toHaveValue('slot-2')
  })

  it('restores legacy saved games as choices', () => {
    localStorage.setItem(
      'what2pick.bracket.v1',
      JSON.stringify({
        games: [
          {
            id: 'legacy-1',
            name: 'Elden Ring',
            position: 'slot-1',
            randomOrder: 0.1,
          },
          {
            id: 'legacy-2',
            name: 'Hades',
            position: 'slot-2',
            randomOrder: 0.2,
          },
        ],
        bracketStarted: false,
        winnerByMatchId: {},
      }),
    )

    render(<App />)

    expect(screen.getByText(/2 of 128 choices added/i)).toBeInTheDocument()
    expect(within(screen.getByRole('list')).getByText('Elden Ring')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/position/i)[0]).toHaveValue('slot-1')
  })

  it('advances winners through a four-choice bracket and selects a champion', async () => {
    const user = userEvent.setup()

    render(<App />)

    await addChoices(['Elden Ring', 'Hades', 'Celeste', 'Balatro'])

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

  it('persists a started bracket and selected champion across reloads', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await addChoices(['Elden Ring', 'Hades', 'Celeste', 'Balatro'])

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
    await user.click(screen.getAllByRole('button', { name: /elden ring/i }).at(-1)!)

    unmount()
    render(<App />)

    expect(screen.getByText(/bracket started/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/choice name/i)).not.toBeInTheDocument()
    expect(screen.getByText('Champion')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Elden Ring' })).toBeInTheDocument()
  })

  it('keeps the saved bracket when start over is cancelled', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<App />)

    await addChoices(['Elden Ring', 'Hades'])
    await user.click(screen.getByRole('button', { name: /start over/i }))

    expect(confirm).toHaveBeenCalledWith(
      'Start over and delete the saved bracket?',
    )
    expect(screen.getByText(/2 of 128 choices added/i)).toBeInTheDocument()
    expect(within(screen.getByRole('list')).getByText('Elden Ring')).toBeInTheDocument()
  })

  it('clears saved choices and progress when start over is confirmed', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { unmount } = render(<App />)

    await addChoices(['Elden Ring', 'Hades', 'Celeste', 'Balatro'])

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
    await user.click(screen.getAllByRole('button', { name: /elden ring/i }).at(-1)!)

    expect(screen.getByText('Champion')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /start over/i }))

    expect(confirm).toHaveBeenCalledWith(
      'Start over and delete the saved bracket?',
    )
    expect(screen.getByText(/0 of 128 choices added/i)).toBeInTheDocument()
    expect(screen.queryByText('Champion')).not.toBeInTheDocument()
    expect(screen.getByText(/no choices added yet/i)).toBeInTheDocument()
    expect(localStorage.length).toBe(0)

    unmount()
    render(<App />)

    expect(screen.getByText(/0 of 128 choices added/i)).toBeInTheDocument()
    expect(screen.queryByText('Elden Ring')).not.toBeInTheDocument()
  })

  it('clears later winners when an earlier winner changes', async () => {
    const user = userEvent.setup()

    render(<App />)

    await addChoices(['Elden Ring', 'Hades', 'Celeste', 'Balatro'])

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

  it('uses pairs and a three-way opening match when nine choices need four winners', async () => {
    const user = userEvent.setup()

    render(<App />)

    await addChoices([
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
