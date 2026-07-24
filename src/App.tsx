import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { getReductionRoundPlan, getReductionRoundPlans } from './bracket'
import { getImportableChoiceNames } from './importChoices'
import './App.css'

const MIN_BRACKET_ITEMS = 2
const MAX_BRACKET_ITEMS = 128
const STORAGE_KEY = 'what2pick.bracket.v1'

type FixedBracketPosition = `slot-${number}`
type BracketPosition = 'random' | FixedBracketPosition

type Choice = {
  id: string
  name: string
  position: BracketPosition
  randomOrder: number
}

type PersistedBracketState = {
  choices: Choice[]
  bracketStarted: boolean
  winnerByMatchId: Record<string, string>
}

type BracketEntry =
  | {
      type: 'choice'
      choice: Choice
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

function getBracketAssignments(choices: Choice[]) {
  const assignments: Array<Choice | undefined> = Array.from({
    length: choices.length,
  })

  choices.forEach((choice) => {
    if (choice.position !== 'random') {
      const positionIndex = Number(choice.position.replace('slot-', '')) - 1

      if (positionIndex >= 0 && positionIndex < assignments.length) {
        assignments[positionIndex] = choice
      }
    }
  })

  const randomChoices = choices
    .filter((choice) => choice.position === 'random')
    .sort((firstChoice, secondChoice) =>
      firstChoice.randomOrder - secondChoice.randomOrder
    )

  let randomIndex = 0

  return assignments.map((assignedChoice) => {
    if (assignedChoice) {
      return assignedChoice
    }

    const randomChoice = randomChoices[randomIndex]
    randomIndex += 1
    return randomChoice
  })
}

function buildBracketRounds(orderedChoices: Choice[]) {
  const rounds: BracketRound[] = []
  let entries: BracketEntry[] = orderedChoices.map((choice) => ({
    type: 'choice',
    choice,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBracketPosition(value: unknown): value is BracketPosition {
  return (
    value === 'random' ||
    (typeof value === 'string' && /^slot-\d+$/.test(value))
  )
}

function isChoice(value: unknown): value is Choice {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isBracketPosition(value.position) &&
    typeof value.randomOrder === 'number'
  )
}

function isWinnerMap(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((winnerId) => typeof winnerId === 'string')
  )
}

function readPersistedBracketState(): PersistedBracketState {
  if (typeof window === 'undefined') {
    return {
      choices: [],
      bracketStarted: false,
      winnerByMatchId: {},
    }
  }

  try {
    const storedState = window.localStorage.getItem(STORAGE_KEY)

    if (!storedState) {
      return {
        choices: [],
        bracketStarted: false,
        winnerByMatchId: {},
      }
    }

    const parsedState: unknown = JSON.parse(storedState)

    if (!isRecord(parsedState)) {
      return {
        choices: [],
        bracketStarted: false,
        winnerByMatchId: {},
      }
    }

    const storedChoices = Array.isArray(parsedState.choices)
      ? parsedState.choices
      : parsedState.games

    if (!Array.isArray(storedChoices)) {
      return {
        choices: [],
        bracketStarted: false,
        winnerByMatchId: {},
      }
    }

    const choices = storedChoices.filter(isChoice).slice(0, MAX_BRACKET_ITEMS)
    const winnerByMatchId = isWinnerMap(parsedState.winnerByMatchId)
      ? parsedState.winnerByMatchId
      : {}

    return {
      choices,
      bracketStarted:
        parsedState.bracketStarted === true &&
        choices.length >= MIN_BRACKET_ITEMS,
      winnerByMatchId,
    }
  } catch {
    return {
      choices: [],
      bracketStarted: false,
      winnerByMatchId: {},
    }
  }
}

function App() {
  const persistedState = useMemo(readPersistedBracketState, [])
  const [choiceName, setChoiceName] = useState('')
  const [bulkChoiceText, setBulkChoiceText] = useState('')
  const [choices, setChoices] = useState<Choice[]>(persistedState.choices)
  const [bracketStarted, setBracketStarted] = useState(
    persistedState.bracketStarted,
  )
  const [winnerByMatchId, setWinnerByMatchId] = useState<
    Record<string, string>
  >(persistedState.winnerByMatchId)
  const bracketScrollbarRef = useRef<HTMLDivElement>(null)
  const bracketViewportRef = useRef<HTMLDivElement>(null)

  const bracketAssignments = useMemo(
    () => getBracketAssignments(choices),
    [choices],
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
    ? choices.find((choice) => choice.id === winnerByMatchId[finalMatch.id])
    : undefined
  const randomChoicesCount = choices.filter(
    (choice) => choice.position === 'random',
  ).length
  const canStartBracket =
    choices.length >= MIN_BRACKET_ITEMS && choices.length <= MAX_BRACKET_ITEMS
  const availableChoiceSlots = MAX_BRACKET_ITEMS - choices.length
  const { importableChoiceNames, skippedChoicesCount } = useMemo(
    () => getImportableChoiceNames(bulkChoiceText, availableChoiceSlots),
    [availableChoiceSlots, bulkChoiceText],
  )
  const positionOptions = Array.from(
    { length: choices.length },
    (_, index) => `slot-${index + 1}` as FixedBracketPosition,
  )
  const reductionRoundPlans = getReductionRoundPlans(choices.length)
  const reductionPairMatchesCount = reductionRoundPlans.reduce(
    (total, plan) => total + plan.pairMatchCount,
    0,
  )
  const reductionTripleMatchesCount = reductionRoundPlans.reduce(
    (total, plan) => total + plan.tripleMatchCount,
    0,
  )

  function findChoice(choiceId: string | undefined) {
    return choices.find((choice) => choice.id === choiceId)
  }

  useEffect(() => {
    try {
      if (
        choices.length === 0 &&
        !bracketStarted &&
        Object.keys(winnerByMatchId).length === 0
      ) {
        window.localStorage.removeItem(STORAGE_KEY)
        return
      }

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          choices,
          bracketStarted,
          winnerByMatchId,
        } satisfies PersistedBracketState),
      )
    } catch {
      // Continue without persistence when storage is unavailable.
    }
  }, [bracketStarted, choices, winnerByMatchId])

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
  }, [bracketColumnCount, choices.length])

  function resolveEntry(entry: BracketEntry) {
    if (entry.type === 'choice') {
      return entry.choice
    }

    return findChoice(winnerByMatchId[entry.matchId])
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = choiceName.trim()

    if (!trimmedName || choices.length >= MAX_BRACKET_ITEMS || bracketStarted) {
      return
    }

    setChoices([...choices, createChoice(trimmedName)])
    setChoiceName('')
  }

  function createChoice(name: string): Choice {
    return {
      id: crypto.randomUUID(),
      name,
      position: 'random',
      randomOrder: Math.random(),
    }
  }

  function importBulkChoices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      bracketStarted ||
      availableChoiceSlots <= 0 ||
      importableChoiceNames.length === 0
    ) {
      return
    }

    setChoices([
      ...choices,
      ...importableChoiceNames.map((name) => createChoice(name)),
    ])
    setBulkChoiceText('')
  }

  function removeChoice(choiceId: string) {
    setChoices(choices.filter((choice) => choice.id !== choiceId))
  }

  function updateChoicePosition(
    choiceId: string,
    position: BracketPosition,
  ) {
    setChoices(
      choices.map((choice) =>
        choice.id === choiceId ? { ...choice, position } : choice,
      ),
    )
  }

  function shuffleRandomChoices() {
    setChoices(
      choices.map((choice) =>
        choice.position === 'random'
          ? { ...choice, randomOrder: Math.random() }
          : choice,
      ),
    )
  }

  function selectMatchWinner(
    roundIndex: number,
    matchId: string,
    choice: Choice | undefined,
  ) {
    if (!bracketStarted || !choice) {
      return
    }

    setWinnerByMatchId((currentWinners) => {
      const nextWinners = { ...currentWinners, [matchId]: choice.id }

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

  function startOver() {
    const shouldReset = window.confirm(
      'Start over and delete the saved bracket?',
    )

    if (!shouldReset) {
      return
    }

    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Continue resetting app state when storage is unavailable.
    }

    setChoiceName('')
    setBulkChoiceText('')
    setChoices([])
    setBracketStarted(false)
    setWinnerByMatchId({})
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
                  const choice = resolvedParticipants[index]
                  const isSelected = choice?.id === winnerByMatchId[match.id]
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
                        selectMatchWinner(round.roundIndex, match.id, choice)
                      }
                      disabled={!bracketStarted || !isReady || !choice}
                    >
                      <strong>Pick {index + 1}:</strong>
                      <span>{choice?.name ?? placeholder}</span>
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
          <h2>Add your choices</h2>
          <p>
            {choices.length} of {MAX_BRACKET_ITEMS} choices added. Start with at
            least {MIN_BRACKET_ITEMS}.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="choice-name">Choice name</label>

            <input
              id="choice-name"
              type="text"
              placeholder="Example: Pizza"
              value={choiceName}
              onChange={(event) => setChoiceName(event.target.value)}
              disabled={bracketStarted || choices.length >= MAX_BRACKET_ITEMS}
            />

            <button
              type="submit"
              disabled={bracketStarted || choices.length >= MAX_BRACKET_ITEMS}
            >
              Add choice
            </button>
          </form>

          <form className="bulk-choice-form" onSubmit={importBulkChoices}>
            <label htmlFor="bulk-choice-list">Bulk choices</label>

            <textarea
              id="bulk-choice-list"
              placeholder={'Pizza\nSushi\nTacos'}
              value={bulkChoiceText}
              onChange={(event) => setBulkChoiceText(event.target.value)}
              disabled={bracketStarted || choices.length >= MAX_BRACKET_ITEMS}
              rows={5}
            />

            <p className="import-summary">
              {importableChoiceNames.length} ready. {availableChoiceSlots}{' '}
              slots available.
              {skippedChoicesCount > 0
                ? ` ${skippedChoicesCount} will not fit.`
                : ''}
            </p>

            <button
              type="submit"
              disabled={
                bracketStarted ||
                importableChoiceNames.length === 0 ||
                choices.length >= MAX_BRACKET_ITEMS
              }
            >
              Add list
            </button>
          </form>

          {choices.length === 0 ? (
            <p>No choices added yet.</p>
          ) : (
            <ul className="choice-list">
              {choices.map((choice) => (
                <li key={choice.id}>
                  <span>{choice.name}</span>

                  <label htmlFor={`position-${choice.id}`}>
                    Position
                  </label>

                  <select
                    id={`position-${choice.id}`}
                    value={choice.position}
                    onChange={(event) =>
                      updateChoicePosition(
                        choice.id,
                        event.target.value as BracketPosition,
                      )
                    }
                    disabled={bracketStarted}
                  >
                    <option value="random">Random</option>

                    {positionOptions.map((position, index) => {
                      const isOccupied = choices.some(
                        (otherChoice) =>
                          otherChoice.id !== choice.id &&
                          otherChoice.position === position,
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
                    onClick={() => removeChoice(choice.id)}
                    disabled={bracketStarted}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="setup-actions">
            <button
              type="button"
              onClick={shuffleRandomChoices}
              disabled={bracketStarted || randomChoicesCount < 2}
            >
              Shuffle random choices
            </button>
            <button
              type="button"
              onClick={toggleBracket}
              disabled={!bracketStarted && !canStartBracket}
            >
              {bracketStarted ? 'Edit bracket setup' : 'Start bracket'}
            </button>
            {choices.length > 0 && (
              <button
                type="button"
                className="danger-button"
                onClick={startOver}
              >
                Start over
              </button>
            )}
          </div>
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
            <div className="bracket-panel-actions">
              <button type="button" onClick={toggleBracket}>
                Edit bracket setup
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={startOver}
              >
                Start over
              </button>
            </div>
          )}
        </div>

        {choices.length < MIN_BRACKET_ITEMS ? (
          <p>Add at least {MIN_BRACKET_ITEMS} choices to preview the bracket.</p>
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
