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
import { getOnlineMatchWinnerFromVotes } from './onlineVoting'

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.pushState({}, '', '/')
  vi.restoreAllMocks()
})

async function openIndividualMode() {
  const user = userEvent.setup()
  const individualButton = screen.queryByRole('button', {
    name: /individual mode/i,
  })

  if (individualButton) {
    await user.click(individualButton)
  }
}

async function addChoice(name: string) {
  const user = userEvent.setup()

  await openIndividualMode()
  if (!screen.queryByLabelText(/^choice name$/i)) {
    await user.click(screen.getByRole('button', { name: /^add$/i }))
  }
  await user.type(screen.getByLabelText(/^choice name$/i), name)
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
    await openIndividualMode()

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
    await openIndividualMode()

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
    await openIndividualMode()

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.click(screen.getByLabelText(/multiple/i))

    fireEvent.change(screen.getByLabelText(/^multiple choices$/i), {
      target: { value: 'Pizza\n\nSushi\n  Tacos  ' },
    })

    expect(screen.getByText(/3 ready\. 128 slots available/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /add list/i }))

    const list = screen.getByRole('list')

    expect(screen.getByText(/3 of 128 choices added/i)).toBeInTheDocument()
    expect(within(list).getByText('Pizza')).toBeInTheDocument()
    expect(within(list).getByText('Sushi')).toBeInTheDocument()
    expect(within(list).getByText('Tacos')).toBeInTheDocument()
    expect(screen.getByLabelText(/^multiple choices$/i)).toHaveValue('')
  })

  it('limits bulk imports to the remaining choice slots', () => {
    expect(getImportableChoiceNames('Extra 1\nExtra 2\nExtra 3', 2)).toEqual({
      importableChoiceNames: ['Extra 1', 'Extra 2'],
      skippedChoicesCount: 1,
    })
  })

  it('does not persist guest choices across reloads', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await openIndividualMode()

    await addChoices(['Elden Ring', 'Hades'])

    const positionSelects = screen.getAllByLabelText(/position/i)

    await user.selectOptions(positionSelects[0], 'slot-1')
    await user.selectOptions(positionSelects[1], 'slot-2')

    unmount()
    render(<App />)
    await openIndividualMode()

    expect(screen.getByText(/0 of 128 choices added/i)).toBeInTheDocument()
    expect(screen.queryByText('Elden Ring')).not.toBeInTheDocument()
    expect(screen.queryByText('Hades')).not.toBeInTheDocument()
  })

  it('ignores legacy saved games while browsing as a guest', async () => {
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
    await openIndividualMode()

    expect(screen.getByText(/0 of 128 choices added/i)).toBeInTheDocument()
    expect(screen.queryByText('Elden Ring')).not.toBeInTheDocument()
  })

  it('persists the guest dark mode preference across reloads', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await user.click(screen.getByRole('button', { name: /settings/i }))

    const darkModeToggle = screen.getByLabelText(/dark mode/i)

    expect(darkModeToggle).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('dark')

    await user.click(darkModeToggle)

    expect(darkModeToggle).not.toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('light')

    unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /settings/i }))

    expect(screen.getByLabelText(/dark mode/i)).not.toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('what2pick.settings.v1')).toBeTruthy()
  })

  it('opens a separate login screen and can switch to account creation', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /^log in$/i }))

    expect(screen.getByRole('heading', { name: /what2pick/i })).toBeInTheDocument()
    expect(screen.getByText(/log in to save your choices and settings/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(screen.getByText(/create an account to keep your brackets synced/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^create account$/i }),
    ).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /^back$/i }))

    expect(screen.getByRole('button', { name: /individual mode/i })).toBeInTheDocument()
  })

  it('opens online mode with room creation and join actions', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /online mode/i }))

    expect(screen.getByRole('heading', { name: /online mode/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /create room/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /join room/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/room code or invite link/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tie breaker/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/show who voted/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/choices per participant/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/voting time/i)).toBeInTheDocument()
  })

  it('prefills online room code from an invite link query string', async () => {
    window.history.pushState({}, '', '/?room=ABC123')

    render(<App />)

    expect(screen.getByRole('heading', { name: /online mode/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/room code or invite link/i)).toHaveValue('ABC123')
  })

  it('decides tied online match votes randomly after everyone votes', () => {
    expect(
      getOnlineMatchWinnerFromVotes(
        {
          participantA: 'choice-a',
        },
        2,
        () => 0,
      ),
    ).toBeUndefined()

    expect(
      getOnlineMatchWinnerFromVotes(
        {
          participantA: 'choice-a',
          participantB: 'choice-a',
          participantC: 'choice-b',
        },
        3,
        () => 0,
      ),
    ).toBe('choice-a')

    expect(
      getOnlineMatchWinnerFromVotes(
        {
          participantA: 'choice-a',
          participantB: 'choice-b',
        },
        2,
        () => 0.75,
      ),
    ).toBe('choice-b')
  })

  it('advances winners through a four-choice bracket and selects a champion', async () => {
    const user = userEvent.setup()

    render(<App />)
    await openIndividualMode()

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

  it('does not persist a guest bracket champion across reloads', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await openIndividualMode()

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
    await openIndividualMode()

    expect(screen.getByText(/0 of 128 choices added/i)).toBeInTheDocument()
    expect(screen.queryByText('Champion')).not.toBeInTheDocument()
    expect(screen.queryByText('Elden Ring')).not.toBeInTheDocument()
  })

  it('keeps the saved bracket when start over is cancelled', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<App />)
    await openIndividualMode()

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
    await openIndividualMode()

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
    expect(localStorage.getItem('what2pick.bracket.v1')).toBeNull()
    expect(localStorage.getItem('what2pick.settings.v1')).toBeTruthy()

    unmount()
    render(<App />)
    await openIndividualMode()

    expect(screen.getByText(/0 of 128 choices added/i)).toBeInTheDocument()
    expect(screen.queryByText('Elden Ring')).not.toBeInTheDocument()
  })

  it('clears later winners when an earlier winner changes', async () => {
    const user = userEvent.setup()

    render(<App />)
    await openIndividualMode()

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
    await openIndividualMode()

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

  it('builds a three-way final after seven choices reduce to three winners', async () => {
    const user = userEvent.setup()

    render(<App />)
    await openIndividualMode()

    await addChoices([
      'Elden Ring',
      'Hades',
      'Celeste',
      'Balatro',
      'Inside',
      'Portal',
      'Tunic',
    ])

    const positionSelects = screen.getAllByLabelText(/position/i)

    for (let index = 0; index < positionSelects.length; index += 1) {
      await user.selectOptions(positionSelects[index], `slot-${index + 1}`)
    }

    expect(
      screen.getByText(
        /reducing over 1 round with 2 two-player matches and 1 three-way match/i,
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /start bracket/i }))

    const finalSection = screen
      .getByRole('heading', { name: /final/i })
      .closest('section')

    expect(finalSection).not.toBeNull()
    expect(
      within(finalSection as HTMLElement).getAllByRole('button'),
    ).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: /pick 1:\s*elden ring/i }))
    await user.click(screen.getByRole('button', { name: /pick 1:\s*celeste/i }))
    await user.click(screen.getByRole('button', { name: /pick 1:\s*inside/i }))

    expect(
      within(finalSection as HTMLElement).getByRole('button', {
        name: /pick 1:\s*elden ring/i,
      }),
    ).toBeEnabled()
    expect(
      within(finalSection as HTMLElement).getByRole('button', {
        name: /pick 2:\s*celeste/i,
      }),
    ).toBeEnabled()
    expect(
      within(finalSection as HTMLElement).getByRole('button', {
        name: /pick 3:\s*inside/i,
      }),
    ).toBeEnabled()
  })

  it('plans repeated reduction rounds without automatic advances', () => {
    expect(getReductionRoundPlan(7)).toEqual({
      targetSize: 3,
      pairMatchCount: 2,
      tripleMatchCount: 1,
    })
    expect(getReductionRoundPlans(7)).toEqual([
      {
        targetSize: 3,
        pairMatchCount: 2,
        tripleMatchCount: 1,
      },
    ])

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
