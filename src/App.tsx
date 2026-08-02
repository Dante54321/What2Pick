import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { getReductionRoundPlan, getReductionRoundPlans } from './bracket'
import { getImportableChoiceNames } from './importChoices'
import { getOnlineMatchWinnerFromVotes } from './onlineVoting'
import { isSupabaseConfigured, supabase } from './supabaseClient'
import './App.css'

const MIN_BRACKET_ITEMS = 2
const MAX_BRACKET_ITEMS = 128
const STORAGE_KEY = 'what2pick.bracket.v1'
const SETTINGS_STORAGE_KEY = 'what2pick.settings.v1'
const USER_BRACKET_STATE_TABLE = 'user_bracket_states'
const CHOICE_TEMPLATES_TABLE = 'choice_templates'
const SAVED_BRACKETS_TABLE = 'saved_brackets'
const ONLINE_ROOMS_TABLE = 'online_rooms'
const ONLINE_PARTICIPANT_STORAGE_KEY = 'what2pick.onlineParticipantId.v1'

type FixedBracketPosition = `slot-${number}`
type BracketPosition = 'random' | FixedBracketPosition

type Choice = {
  id: string
  name: string
  position: BracketPosition
  randomOrder: number
}

type BracketState = {
  choices: Choice[]
  bracketStarted: boolean
  winnerByMatchId: Record<string, string>
}

type UserBracketStateRow = {
  choices: unknown
  bracket_started: boolean
  winner_by_match_id: unknown
  settings: unknown
}

type ChoiceTemplate = {
  id: string
  name: string
  choiceNames: string[]
  updatedAt: string
}

type ChoiceTemplateRow = {
  id: string
  name: string
  choice_names: unknown
  updated_at: string
}

type SavedBracket = {
  id: string
  name: string
  choices: Choice[]
  bracketStarted: boolean
  winnerByMatchId: Record<string, string>
  updatedAt: string
}

type SavedBracketRow = {
  id: string
  name: string
  choices: unknown
  bracket_started: boolean
  winner_by_match_id: unknown
  updated_at: string
}

type OnlineParticipant = {
  id: string
  name: string
}

type OnlineRoom = {
  id: string
  code: string
  title: string
  participants: OnlineParticipant[]
  choices: Choice[]
  bracketStarted: boolean
  winnerByMatchId: Record<string, string>
  votesByMatchId: Record<string, Record<string, string>>
  updatedAt: string
}

type OnlineRoomRow = {
  id: string
  code: string
  title: string
  participants: unknown
  choices: unknown
  bracket_started: boolean
  winner_by_match_id: unknown
  votes_by_match_id: unknown
  updated_at: string
}

type UserSettings = {
  darkMode: boolean
}

type AuthMode = 'login' | 'signup'
type AppMode = 'home' | 'individual' | 'online' | 'settings'
type TemplateSortMode = 'recent' | 'name'
type SavedBracketSortMode = 'recent' | 'name'

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

type BracketConnector = {
  id: string
  path: string
  sourceMatchId: string
  sourceX: number
  sourceY: number
  targetMatchId: string
  targetX: number
  targetY: number
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

  if (entries.length === 3) {
    const roundNumber = rounds.length + 1
    const matchId = `r${roundNumber}-m1`

    rounds.push({
      id: `r${roundNumber}`,
      name: '',
      matches: [
        {
          id: matchId,
          label: 'Match 1',
          participants: entries,
        },
      ],
    })
    entries = [{ type: 'match', matchId }]
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

function isOnlineParticipant(value: unknown): value is OnlineParticipant {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string'
  )
}

function isVotesByMatchId(
  value: unknown,
): value is Record<string, Record<string, string>> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (votesByParticipant) =>
        isRecord(votesByParticipant) &&
        Object.values(votesByParticipant).every(
          (choiceId) => typeof choiceId === 'string',
        ),
    )
  )
}

function readPersistedSettings(): UserSettings {
  if (typeof window === 'undefined') {
    return {
      darkMode: true,
    }
  }

  try {
    const storedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY)

    if (!storedSettings) {
      return {
        darkMode: true,
      }
    }

    const parsedSettings: unknown = JSON.parse(storedSettings)

    if (!isRecord(parsedSettings)) {
      return {
        darkMode: true,
      }
    }

    return {
      darkMode:
        typeof parsedSettings.darkMode === 'boolean'
          ? parsedSettings.darkMode
          : true,
    }
  } catch {
    return {
      darkMode: true,
    }
  }
}

function normalizeUserSettings(value: unknown): UserSettings {
  if (!isRecord(value)) {
    return {
      darkMode: true,
    }
  }

  return {
    darkMode: typeof value.darkMode === 'boolean' ? value.darkMode : true,
  }
}

function normalizeBracketState(row: UserBracketStateRow): BracketState {
  const choices = Array.isArray(row.choices)
    ? row.choices.filter(isChoice).slice(0, MAX_BRACKET_ITEMS)
    : []
  const winnerByMatchId = isWinnerMap(row.winner_by_match_id)
    ? row.winner_by_match_id
    : {}

  return {
    choices,
    bracketStarted:
      row.bracket_started === true && choices.length >= MIN_BRACKET_ITEMS,
    winnerByMatchId,
  }
}

function normalizeChoiceTemplate(row: ChoiceTemplateRow): ChoiceTemplate {
  return {
    id: row.id,
    name: row.name,
    choiceNames: Array.isArray(row.choice_names)
      ? row.choice_names
          .filter((choiceName) => typeof choiceName === 'string')
          .slice(0, MAX_BRACKET_ITEMS)
      : [],
    updatedAt: row.updated_at,
  }
}

function normalizeSavedBracket(row: SavedBracketRow): SavedBracket {
  const choices = Array.isArray(row.choices)
    ? row.choices.filter(isChoice).slice(0, MAX_BRACKET_ITEMS)
    : []
  const winnerByMatchId = isWinnerMap(row.winner_by_match_id)
    ? row.winner_by_match_id
    : {}

  return {
    id: row.id,
    name: row.name,
    choices,
    bracketStarted:
      row.bracket_started === true && choices.length >= MIN_BRACKET_ITEMS,
    winnerByMatchId,
    updatedAt: row.updated_at,
  }
}

function normalizeOnlineRoom(row: OnlineRoomRow): OnlineRoom {
  const choices = Array.isArray(row.choices)
    ? row.choices.filter(isChoice).slice(0, MAX_BRACKET_ITEMS)
    : []
  const participants = Array.isArray(row.participants)
    ? row.participants.filter(isOnlineParticipant)
    : []
  const winnerByMatchId = isWinnerMap(row.winner_by_match_id)
    ? row.winner_by_match_id
    : {}
  const votesByMatchId = isVotesByMatchId(row.votes_by_match_id)
    ? row.votes_by_match_id
    : {}

  return {
    id: row.id,
    code: row.code,
    title: row.title,
    participants,
    choices,
    bracketStarted:
      row.bracket_started === true && choices.length >= MIN_BRACKET_ITEMS,
    winnerByMatchId,
    votesByMatchId,
    updatedAt: row.updated_at,
  }
}

function getOnlineParticipantId() {
  if (typeof window === 'undefined') {
    return crypto.randomUUID()
  }

  try {
    const storedId = window.localStorage.getItem(ONLINE_PARTICIPANT_STORAGE_KEY)

    if (storedId) {
      return storedId
    }

    const nextId = crypto.randomUUID()
    window.localStorage.setItem(ONLINE_PARTICIPANT_STORAGE_KEY, nextId)
    return nextId
  } catch {
    return crypto.randomUUID()
  }
}

function generateRoomCode() {
  return Array.from({ length: 6 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.at(
      Math.floor(Math.random() * 32),
    ),
  ).join('')
}

function getAuthErrorMessage(errorMessage: string) {
  const normalizedMessage = errorMessage.toLowerCase()

  if (normalizedMessage.includes('rate limit')) {
    return 'Too many email attempts. Wait a while or disable email confirmation in Supabase while developing.'
  }

  if (normalizedMessage.includes('invalid login credentials')) {
    return 'The email or password is incorrect.'
  }

  return errorMessage
}

function App() {
  const persistedSettings = useMemo(readPersistedSettings, [])
  const onlineParticipantId = useMemo(getOnlineParticipantId, [])
  const [appMode, setAppMode] = useState<AppMode>('home')
  const [choiceName, setChoiceName] = useState('')
  const [bulkChoiceText, setBulkChoiceText] = useState('')
  const [bulkChoiceMode, setBulkChoiceMode] = useState(false)
  const [choiceDrawerOpen, setChoiceDrawerOpen] = useState(true)
  const [templateName, setTemplateName] = useState('')
  const [choiceTemplates, setChoiceTemplates] = useState<ChoiceTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [activeTemplateId, setActiveTemplateId] = useState('')
  const [renameTemplateName, setRenameTemplateName] = useState('')
  const [templateScreenOpen, setTemplateScreenOpen] = useState(false)
  const [quickListSaveOpen, setQuickListSaveOpen] = useState(false)
  const [templateSortMode, setTemplateSortMode] =
    useState<TemplateSortMode>('recent')
  const [templateMessage, setTemplateMessage] = useState('')
  const [templateLoading, setTemplateLoading] = useState(false)
  const [savedBrackets, setSavedBrackets] = useState<SavedBracket[]>([])
  const [selectedSavedBracketId, setSelectedSavedBracketId] = useState('')
  const [activeSavedBracketId, setActiveSavedBracketId] = useState('')
  const [savedBracketName, setSavedBracketName] = useState('')
  const [bracketScreenOpen, setBracketScreenOpen] = useState(false)
  const [savedBracketSortMode, setSavedBracketSortMode] =
    useState<SavedBracketSortMode>('recent')
  const [savedBracketMessage, setSavedBracketMessage] = useState('')
  const [savedBracketLoading, setSavedBracketLoading] = useState(false)
  const [quickSaveOpen, setQuickSaveOpen] = useState(false)
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoom | null>(null)
  const [onlineRoomTitle, setOnlineRoomTitle] = useState('Decision room')
  const [onlineRoomCodeInput, setOnlineRoomCodeInput] = useState('')
  const [onlineParticipantName, setOnlineParticipantName] = useState('')
  const [onlineChoiceName, setOnlineChoiceName] = useState('')
  const [onlineMessage, setOnlineMessage] = useState('')
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [choices, setChoices] = useState<Choice[]>([])
  const [bracketStarted, setBracketStarted] = useState(false)
  const [winnerByMatchId, setWinnerByMatchId] = useState<
    Record<string, string>
  >({})
  const [autoFocusSelection, setAutoFocusSelection] = useState(true)
  const [bracketZoom, setBracketZoom] = useState(100)
  const [settings, setSettings] = useState<UserSettings>(persistedSettings)
  const [session, setSession] = useState<Session | null>(null)
  const [userStateLoaded, setUserStateLoaded] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authScreenOpen, setAuthScreenOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const bracketScrollbarRef = useRef<HTMLDivElement>(null)
  const bracketViewportRef = useRef<HTMLDivElement>(null)
  const bracketArenaRef = useRef<HTMLDivElement>(null)
  const choiceEntryRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const matchElementRefs = useRef(new Map<string, HTMLElement>())
  const [bracketConnectors, setBracketConnectors] = useState<
    BracketConnector[]
  >([])

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

    finalMatch?.participants.forEach((participant, index) => {
      collectBranchMatches(participant, index % 2 === 0 ? left : right)
    })

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
  const bracketSideColumnCount = Math.max(
    leftRoundColumns.length,
    rightRoundColumns.length,
  )
  const bracketSideWidthRem =
    bracketSideColumnCount === 0
      ? 0
      : bracketSideColumnCount * 18 + (bracketSideColumnCount - 1)
  const bracketArenaWidthRem =
    bracketSideWidthRem * 2 + (finalRoundColumn ? 20 : 0) + 2.5
  const bracketColumnCount =
    leftRoundColumns.length + rightRoundColumns.length +
    (finalRoundColumn ? 1 : 0)
  const connectorRelations = useMemo(() => {
    const relations: Array<{ sourceMatchId: string; targetMatchId: string }> =
      []

    bracketRounds.forEach((round) => {
      round.matches.forEach((match) => {
        match.participants.forEach((participant) => {
          if (participant.type === 'match') {
            relations.push({
              sourceMatchId: participant.matchId,
              targetMatchId: match.id,
            })
          }
        })
      })
    })

    return relations
  }, [bracketRounds])
  const champion = finalMatch
    ? choices.find((choice) => choice.id === winnerByMatchId[finalMatch.id])
    : undefined
  const currentSelectionMatch = useMemo(() => {
    if (!bracketStarted) {
      return undefined
    }

    for (const round of bracketRounds) {
      for (const match of round.matches) {
        if (winnerByMatchId[match.id]) {
          continue
        }

        const isReady = match.participants.every((participant) => {
          if (participant.type === 'choice') {
            return true
          }

          return Boolean(
            choices.find(
              (choice) => choice.id === winnerByMatchId[participant.matchId],
            ),
          )
        })

        if (isReady) {
          return match
        }
      }
    }

    return undefined
  }, [bracketRounds, bracketStarted, choices, winnerByMatchId])
  const activeSelectionMatchId = currentSelectionMatch?.id
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
  const onlineBracketRounds = useMemo(
    () =>
      onlineRoom
        ? buildBracketRounds(getBracketAssignments(onlineRoom.choices))
        : [],
    [onlineRoom],
  )
  const onlineFinalMatch = onlineBracketRounds.at(-1)?.matches[0]
  const onlineChampion =
    onlineRoom && onlineFinalMatch
      ? onlineRoom.choices.find(
          (choice) =>
            choice.id === onlineRoom.winnerByMatchId[onlineFinalMatch.id],
        )
      : undefined
  const onlineCurrentMatch = useMemo(() => {
    if (!onlineRoom?.bracketStarted) {
      return undefined
    }

    const currentOnlineRoom = onlineRoom

    function resolveOnlineEntry(entry: BracketEntry) {
      if (entry.type === 'choice') {
        return entry.choice
      }

      return currentOnlineRoom.choices.find(
        (choice) =>
          choice.id === currentOnlineRoom.winnerByMatchId[entry.matchId],
      )
    }

    for (const round of onlineBracketRounds) {
      for (const match of round.matches) {
        if (currentOnlineRoom.winnerByMatchId[match.id]) {
          continue
        }

        const resolvedParticipants = match.participants.map(resolveOnlineEntry)

        if (resolvedParticipants.every(Boolean)) {
          return {
            match,
            participants: resolvedParticipants.filter(isChoice),
          }
        }
      }
    }

    return undefined
  }, [onlineBracketRounds, onlineRoom])
  const onlineCurrentVotes =
    onlineRoom && onlineCurrentMatch
      ? onlineRoom.votesByMatchId[onlineCurrentMatch.match.id] ?? {}
      : {}
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
  const selectedTemplate = choiceTemplates.find(
    (choiceTemplate) => choiceTemplate.id === selectedTemplateId,
  )
  const activeTemplate = choiceTemplates.find(
    (choiceTemplate) => choiceTemplate.id === activeTemplateId,
  )
  const sortedChoiceTemplates = useMemo(() => {
    const templates = [...choiceTemplates]

    if (templateSortMode === 'name') {
      return templates.sort((firstTemplate, secondTemplate) =>
        firstTemplate.name.localeCompare(secondTemplate.name),
      )
    }

    return templates.sort((firstTemplate, secondTemplate) =>
      secondTemplate.updatedAt.localeCompare(firstTemplate.updatedAt),
    )
  }, [choiceTemplates, templateSortMode])
  const selectedSavedBracket = savedBrackets.find(
    (savedBracket) => savedBracket.id === selectedSavedBracketId,
  )
  const activeSavedBracket = savedBrackets.find(
    (savedBracket) => savedBracket.id === activeSavedBracketId,
  )
  const sortedSavedBrackets = useMemo(() => {
    const brackets = [...savedBrackets]

    if (savedBracketSortMode === 'name') {
      return brackets.sort((firstBracket, secondBracket) =>
        firstBracket.name.localeCompare(secondBracket.name),
      )
    }

    return brackets.sort((firstBracket, secondBracket) =>
      secondBracket.updatedAt.localeCompare(firstBracket.updatedAt),
    )
  }, [savedBrackets, savedBracketSortMode])

  function findChoice(choiceId: string | undefined) {
    return choices.find((choice) => choice.id === choiceId)
  }

  function resetBracketState() {
    setChoiceName('')
    setBulkChoiceText('')
    setBulkChoiceMode(false)
    setChoices([])
    setBracketStarted(false)
    setWinnerByMatchId({})
  }

  function resetTemplateState() {
    setTemplateName('')
    setChoiceTemplates([])
    setSelectedTemplateId('')
    setActiveTemplateId('')
    setRenameTemplateName('')
    setTemplateScreenOpen(false)
    setTemplateMessage('')
    setTemplateLoading(false)
  }

  function resetSavedBracketState() {
    setSavedBrackets([])
    setSelectedSavedBracketId('')
    setActiveSavedBracketId('')
    setSavedBracketName('')
    setBracketScreenOpen(false)
    setSavedBracketMessage('')
    setSavedBracketLoading(false)
  }

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isActive = true

    supabase.auth.getSession().then(({ data }) => {
      if (isActive) {
        setSession(data.session)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthMessage('')

      if (nextSession) {
        setAuthScreenOpen(false)
      } else {
        setTemplateScreenOpen(false)
      }
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      resetBracketState()
      resetTemplateState()
      resetSavedBracketState()
      setUserStateLoaded(false)
      setSyncMessage('')

      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Continue without legacy storage cleanup when storage is unavailable.
      }

      return
    }

    let isActive = true

    async function loadUserData() {
      setUserStateLoaded(false)
      setTemplateLoading(true)
      setSavedBracketLoading(true)
      setSyncMessage('Loading your saved bracket...')

      const bracketStateRequest = supabase!
        .from(USER_BRACKET_STATE_TABLE)
        .select('choices, bracket_started, winner_by_match_id, settings')
        .eq('user_id', session!.user.id)
        .maybeSingle<UserBracketStateRow>()
      const templatesRequest = supabase!
        .from(CHOICE_TEMPLATES_TABLE)
        .select('id, name, choice_names, updated_at')
        .eq('user_id', session!.user.id)
        .order('updated_at', { ascending: false })
        .returns<ChoiceTemplateRow[]>()
      const savedBracketsRequest = supabase!
        .from(SAVED_BRACKETS_TABLE)
        .select('id, name, choices, bracket_started, winner_by_match_id, updated_at')
        .eq('user_id', session!.user.id)
        .order('updated_at', { ascending: false })
        .returns<SavedBracketRow[]>()

      const [
        { data, error },
        { data: templateRows, error: templatesError },
        { data: savedBracketRows, error: savedBracketsError },
      ] = await Promise.all([
        bracketStateRequest,
        templatesRequest,
        savedBracketsRequest,
      ])

      if (!isActive) {
        return
      }

      if (error) {
        resetBracketState()
        setSyncMessage(
          'Could not load your saved bracket. Check the Supabase table setup.',
        )
        setUserStateLoaded(true)
        setTemplateLoading(false)
        setSavedBracketLoading(false)
        return
      }

      if (!data) {
        resetBracketState()
        setSyncMessage('No saved bracket yet.')
        setUserStateLoaded(true)
      } else {
        const savedState = normalizeBracketState(data)

        setChoiceName('')
        setBulkChoiceText('')
        setChoices(savedState.choices)
        setBracketStarted(savedState.bracketStarted)
        setWinnerByMatchId(savedState.winnerByMatchId)
        setSettings(normalizeUserSettings(data.settings))
        setSyncMessage('Loaded your saved bracket.')
        setUserStateLoaded(true)
      }

      if (templatesError) {
        setChoiceTemplates([])
        setTemplateMessage(
          'Could not load templates. Check the Supabase table setup.',
        )
      } else {
        setChoiceTemplates((templateRows ?? []).map(normalizeChoiceTemplate))
        setTemplateMessage('')
      }

      if (savedBracketsError) {
        setSavedBrackets([])
        setSavedBracketMessage(
          'Could not load saved brackets. Check the Supabase table setup.',
        )
      } else {
        setSavedBrackets((savedBracketRows ?? []).map(normalizeSavedBracket))
        setSavedBracketMessage('')
      }

      setSelectedTemplateId('')
      setRenameTemplateName('')
      setSelectedSavedBracketId('')
      setTemplateLoading(false)
      setSavedBracketLoading(false)
    }

    void loadUserData()

    return () => {
      isActive = false
    }
  }, [session])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.darkMode
      ? 'dark'
      : 'light'

    try {
      window.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(settings),
      )
    } catch {
      // Continue without persistence when storage is unavailable.
    }
  }, [settings])

  useEffect(() => {
    if (!supabase || !session || !userStateLoaded) {
      return
    }

    const saveTimeout = window.setTimeout(() => {
      async function saveUserState() {
        const { error } = await supabase!
          .from(USER_BRACKET_STATE_TABLE)
          .upsert(
            {
              user_id: session!.user.id,
              choices,
              bracket_started: bracketStarted,
              winner_by_match_id: winnerByMatchId,
              settings,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'user_id',
            },
          )

        setSyncMessage(
          error
            ? 'Could not save your bracket. Check the Supabase table setup.'
            : 'Saved to your account.',
        )
      }

      void saveUserState()
    }, 500)

    return () => {
      window.clearTimeout(saveTimeout)
    }
  }, [
    bracketStarted,
    choices,
    session,
    settings,
    userStateLoaded,
    winnerByMatchId,
  ])

  useEffect(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Continue without legacy storage cleanup when storage is unavailable.
    }
  }, [])

  useEffect(() => {
    const scrollbar = bracketScrollbarRef.current
    const viewport = bracketViewportRef.current

    if (
      !scrollbar ||
      !viewport ||
      bracketColumnCount <= 1 ||
      (bracketStarted && autoFocusSelection && activeSelectionMatchId)
    ) {
      return
    }

    requestAnimationFrame(() => {
      const centeredScrollLeft =
        Math.max(0, viewport.scrollWidth - viewport.clientWidth) / 2

      viewport.scrollLeft = centeredScrollLeft
      scrollbar.scrollLeft = centeredScrollLeft
    })
  }, [
    activeSelectionMatchId,
    autoFocusSelection,
    bracketColumnCount,
    bracketStarted,
    choices.length,
    bracketZoom,
  ])

  useEffect(() => {
    if (!bracketStarted || !autoFocusSelection || !activeSelectionMatchId) {
      return
    }

    requestAnimationFrame(() => {
      const matchElement = matchElementRefs.current.get(activeSelectionMatchId)
      const viewport = bracketViewportRef.current
      const scrollbar = bracketScrollbarRef.current

      if (!matchElement || !viewport) {
        return
      }

      const viewportRect = viewport.getBoundingClientRect()
      const matchRect = matchElement.getBoundingClientRect()
      const nextScrollLeft =
        viewport.scrollLeft +
        matchRect.left -
        viewportRect.left -
        (viewport.clientWidth - matchRect.width) / 2

      viewport.scrollLeft = Math.max(0, nextScrollLeft)

      requestAnimationFrame(() => {
        if (scrollbar) {
          scrollbar.scrollLeft = viewport.scrollLeft
        }
      })
    })
  }, [
    activeSelectionMatchId,
    autoFocusSelection,
    bracketStarted,
    bracketZoom,
  ])

  useLayoutEffect(() => {
    const arena = bracketArenaRef.current
    const viewport = bracketViewportRef.current

    if (!arena || connectorRelations.length === 0) {
      setBracketConnectors([])
      return
    }

    let animationFrameId = 0

    function updateConnectors() {
      const currentArena = bracketArenaRef.current

      if (!currentArena) {
        return
      }

      const arenaRect = currentArena.getBoundingClientRect()
      const nextConnectors = connectorRelations.flatMap((relation) => {
        const sourceElement = matchElementRefs.current.get(
          relation.sourceMatchId,
        )
        const targetElement = matchElementRefs.current.get(
          relation.targetMatchId,
        )

        if (!sourceElement || !targetElement) {
          return []
        }

        const sourceRect = sourceElement.getBoundingClientRect()
        const targetRect = targetElement.getBoundingClientRect()
        const sourceIsLeftOfTarget = sourceRect.left <= targetRect.left
        const sourceX = sourceIsLeftOfTarget
          ? sourceRect.right - arenaRect.left
          : sourceRect.left - arenaRect.left
        const targetX = sourceIsLeftOfTarget
          ? targetRect.left - arenaRect.left
          : targetRect.right - arenaRect.left
        const sourceY = sourceRect.top + sourceRect.height / 2 - arenaRect.top
        const targetY = targetRect.top + targetRect.height / 2 - arenaRect.top
        const midpointX = sourceX + (targetX - sourceX) / 2

        return [
          {
            id: `${relation.sourceMatchId}-${relation.targetMatchId}`,
            path: `M ${sourceX} ${sourceY} H ${midpointX} V ${targetY} H ${targetX}`,
            sourceMatchId: relation.sourceMatchId,
            sourceX,
            sourceY,
            targetMatchId: relation.targetMatchId,
            targetX,
            targetY,
          },
        ]
      })

      setBracketConnectors(nextConnectors)
    }

    function scheduleUpdate() {
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = window.requestAnimationFrame(() => {
        updateConnectors()
        animationFrameId = window.requestAnimationFrame(updateConnectors)
      })
    }

    scheduleUpdate()

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(scheduleUpdate)
    resizeObserver?.observe(arena)

    matchElementRefs.current.forEach((matchElement) => {
      resizeObserver?.observe(matchElement)
    })
    viewport?.addEventListener('scroll', scheduleUpdate)
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      resizeObserver?.disconnect()
      viewport?.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [connectorRelations, bracketZoom])

  useEffect(() => {
    if (appMode !== 'online' || !onlineRoom || !supabase) {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadOnlineRoomByCode(onlineRoom.code, true)
    }, 2500)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [appMode, onlineRoom])

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
      !bulkChoiceMode ||
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

  function submitChoices(event: FormEvent<HTMLFormElement>) {
    if (bulkChoiceMode) {
      importBulkChoices(event)
      return
    }

    handleSubmit(event)
  }

  function toggleBulkChoiceMode(enabled: boolean) {
    setBulkChoiceMode(enabled)

    if (!enabled) {
      setBulkChoiceText('')
    }
  }

  async function saveChoiceTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = templateName.trim()

    if (!supabase || !session || !name || choices.length === 0) {
      return
    }

    if (hasDuplicateTemplateName(name)) {
      setTemplateMessage('A saved list with that name already exists.')
      return
    }

    setTemplateLoading(true)
    setTemplateMessage('')

    const choiceNames = choices.map((choice) => choice.name)
    const { data, error } = await supabase
      .from(CHOICE_TEMPLATES_TABLE)
      .insert({
        user_id: session.user.id,
        name,
        choice_names: choiceNames,
      })
      .select('id, name, choice_names, updated_at')
      .single<ChoiceTemplateRow>()

    setTemplateLoading(false)

    if (error) {
      setTemplateMessage(
        'Could not save template. Check the Supabase table setup.',
      )
      return
    }

    const savedTemplate = normalizeChoiceTemplate(data)

    setChoiceTemplates([savedTemplate, ...choiceTemplates])
    setSelectedTemplateId(savedTemplate.id)
    setActiveTemplateId(savedTemplate.id)
    setRenameTemplateName(savedTemplate.name)
    setTemplateName('')
    setQuickListSaveOpen(false)
    setTemplateMessage('Template saved.')
  }

  async function updateChoiceTemplate() {
    const template = choiceTemplates.find(
      (choiceTemplate) => choiceTemplate.id === selectedTemplateId,
    )

    if (!supabase || !session || !template || choices.length === 0) {
      return
    }

    setTemplateLoading(true)
    setTemplateMessage('')

    const choiceNames = choices.map((choice) => choice.name)
    const { data, error } = await supabase
      .from(CHOICE_TEMPLATES_TABLE)
      .update({
        choice_names: choiceNames,
        updated_at: new Date().toISOString(),
      })
      .eq('id', template.id)
      .eq('user_id', session.user.id)
      .select('id, name, choice_names, updated_at')
      .single<ChoiceTemplateRow>()

    setTemplateLoading(false)

    if (error) {
      setTemplateMessage('Could not update template.')
      return
    }

    const updatedTemplate = normalizeChoiceTemplate(data)

    setChoiceTemplates(
      choiceTemplates.map((choiceTemplate) =>
        choiceTemplate.id === updatedTemplate.id
          ? updatedTemplate
          : choiceTemplate,
      ),
    )
    setTemplateMessage(`Updated ${updatedTemplate.name}.`)
  }

  async function renameChoiceTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = renameTemplateName.trim()

    if (!supabase || !session || !selectedTemplate || !name) {
      return
    }

    if (hasDuplicateTemplateName(name, selectedTemplate.id)) {
      setTemplateMessage('A saved list with that name already exists.')
      return
    }

    setTemplateLoading(true)
    setTemplateMessage('')

    const { data, error } = await supabase
      .from(CHOICE_TEMPLATES_TABLE)
      .update({
        name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedTemplate.id)
      .eq('user_id', session.user.id)
      .select('id, name, choice_names, updated_at')
      .single<ChoiceTemplateRow>()

    setTemplateLoading(false)

    if (error) {
      setTemplateMessage('Could not rename template.')
      return
    }

    const renamedTemplate = normalizeChoiceTemplate(data)

    setChoiceTemplates(
      choiceTemplates.map((choiceTemplate) =>
        choiceTemplate.id === renamedTemplate.id
          ? renamedTemplate
          : choiceTemplate,
      ),
    )
    setRenameTemplateName(renamedTemplate.name)
    setTemplateMessage(`Renamed to ${renamedTemplate.name}.`)
  }

  async function deleteChoiceTemplate() {
    if (!supabase || !session || !selectedTemplate) {
      return
    }

    const shouldDelete = window.confirm(
      `Delete the saved list "${selectedTemplate.name}"?`,
    )

    if (!shouldDelete) {
      return
    }

    setTemplateLoading(true)
    setTemplateMessage('')

    const { error } = await supabase
      .from(CHOICE_TEMPLATES_TABLE)
      .delete()
      .eq('id', selectedTemplate.id)
      .eq('user_id', session.user.id)

    setTemplateLoading(false)

    if (error) {
      setTemplateMessage('Could not delete template.')
      return
    }

    setChoiceTemplates(
      choiceTemplates.filter(
        (choiceTemplate) => choiceTemplate.id !== selectedTemplate.id,
      ),
    )

    if (activeTemplateId === selectedTemplate.id) {
      setActiveTemplateId('')
    }

    setSelectedTemplateId('')
    setRenameTemplateName('')
    setTemplateMessage(`Deleted ${selectedTemplate.name}.`)
  }

  function loadChoiceTemplate() {
    const template = selectedTemplate

    if (!template) {
      return
    }

    setChoices(template.choiceNames.map((name) => createChoice(name)))
    setBracketStarted(false)
    setWinnerByMatchId({})
    setActiveTemplateId(template.id)
    setTemplateMessage(`Loaded ${template.name}.`)
  }

  function selectChoiceTemplate(templateId: string) {
    const template = choiceTemplates.find(
      (choiceTemplate) => choiceTemplate.id === templateId,
    )

    setSelectedTemplateId(templateId)
    setRenameTemplateName(template?.name ?? '')
    setQuickListSaveOpen(false)
    setTemplateMessage('')
  }

  function saveQuickChoiceList() {
    if (selectedTemplateId) {
      void updateChoiceTemplate()
      return
    }

    setTemplateName('')
    setTemplateMessage('')
    setQuickListSaveOpen(true)
  }

  function hasDuplicateTemplateName(name: string, ignoredTemplateId?: string) {
    const normalizedName = name.trim().toLowerCase()

    return choiceTemplates.some(
      (template) =>
        template.id !== ignoredTemplateId &&
        template.name.trim().toLowerCase() === normalizedName,
    )
  }

  async function saveCurrentBracket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = savedBracketName.trim()

    await saveBracketSnapshot(name)
  }

  function openQuickSaveBracket() {
    const defaultName =
      activeSavedBracket?.name ??
      (champion ? `${champion.name} bracket` : 'Untitled bracket')

    setSavedBracketName(defaultName)
    setSavedBracketMessage('')
    setQuickSaveOpen(true)
  }

  function closeQuickSaveBracket() {
    setQuickSaveOpen(false)
    setSavedBracketName('')
  }

  async function saveBracketSnapshot(name: string) {
    if (!supabase || !session || !name || choices.length === 0) {
      return
    }

    const existingBracket = savedBrackets.find(
      (savedBracket) =>
        savedBracket.name.trim().toLowerCase() === name.toLowerCase(),
    )

    if (existingBracket) {
      const shouldUpdate = window.confirm(
        `A bracket named "${existingBracket.name}" already exists. Update it?`,
      )

      if (!shouldUpdate) {
        setSavedBracketMessage('Save cancelled.')
        return
      }

      await saveBracketSnapshotToExisting(existingBracket.id)
      return
    }

    setSavedBracketLoading(true)
    setSavedBracketMessage('')

    const { data, error } = await supabase
      .from(SAVED_BRACKETS_TABLE)
      .insert({
        user_id: session.user.id,
        name,
        choices,
        bracket_started: bracketStarted,
        winner_by_match_id: winnerByMatchId,
      })
      .select('id, name, choices, bracket_started, winner_by_match_id, updated_at')
      .single<SavedBracketRow>()

    setSavedBracketLoading(false)

    if (error) {
      setSavedBracketMessage(
        'Could not save bracket. Check the Supabase table setup.',
      )
      return
    }

    const savedBracket = normalizeSavedBracket(data)

    setSavedBrackets([savedBracket, ...savedBrackets])
    setSelectedSavedBracketId(savedBracket.id)
    setActiveSavedBracketId(savedBracket.id)
    setSavedBracketName('')
    setQuickSaveOpen(false)
    setSavedBracketMessage('Bracket saved.')
  }

  async function saveBracketSnapshotToExisting(savedBracketId: string) {
    if (!supabase || !session || choices.length === 0) {
      return
    }

    setSavedBracketLoading(true)
    setSavedBracketMessage('')

    const { data, error } = await supabase
      .from(SAVED_BRACKETS_TABLE)
      .update({
        choices,
        bracket_started: bracketStarted,
        winner_by_match_id: winnerByMatchId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', savedBracketId)
      .eq('user_id', session.user.id)
      .select('id, name, choices, bracket_started, winner_by_match_id, updated_at')
      .single<SavedBracketRow>()

    setSavedBracketLoading(false)

    if (error) {
      setSavedBracketMessage('Could not update saved bracket.')
      return
    }

    const updatedBracket = normalizeSavedBracket(data)

    setSavedBrackets(
      savedBrackets.map((savedBracket) =>
        savedBracket.id === updatedBracket.id ? updatedBracket : savedBracket,
      ),
    )
    setSelectedSavedBracketId(updatedBracket.id)
    setActiveSavedBracketId(updatedBracket.id)
    setQuickSaveOpen(false)
    setSavedBracketMessage(`Updated ${updatedBracket.name}.`)
  }

  async function updateSavedBracket() {
    if (!supabase || !session || !selectedSavedBracket || choices.length === 0) {
      return
    }

    await saveBracketSnapshotToExisting(selectedSavedBracket.id)
  }

  function loadSavedBracket() {
    if (!selectedSavedBracket) {
      return
    }

    setChoiceName('')
    setBulkChoiceText('')
    setBulkChoiceMode(false)
    setChoices(selectedSavedBracket.choices)
    setBracketStarted(selectedSavedBracket.bracketStarted)
    setWinnerByMatchId(selectedSavedBracket.winnerByMatchId)
    setActiveSavedBracketId(selectedSavedBracket.id)
    setSavedBracketMessage(`Loaded ${selectedSavedBracket.name}.`)
    setBracketScreenOpen(false)
  }

  async function deleteSavedBracket() {
    if (!supabase || !session || !selectedSavedBracket) {
      return
    }

    const shouldDelete = window.confirm(
      `Delete the saved bracket "${selectedSavedBracket.name}"?`,
    )

    if (!shouldDelete) {
      return
    }

    setSavedBracketLoading(true)
    setSavedBracketMessage('')

    const { error } = await supabase
      .from(SAVED_BRACKETS_TABLE)
      .delete()
      .eq('id', selectedSavedBracket.id)
      .eq('user_id', session.user.id)

    setSavedBracketLoading(false)

    if (error) {
      setSavedBracketMessage('Could not delete saved bracket.')
      return
    }

    setSavedBrackets(
      savedBrackets.filter(
        (savedBracket) => savedBracket.id !== selectedSavedBracket.id,
      ),
    )

    if (activeSavedBracketId === selectedSavedBracket.id) {
      setActiveSavedBracketId('')
    }

    setSelectedSavedBracketId('')
    setSavedBracketMessage(`Deleted ${selectedSavedBracket.name}.`)
  }

  function selectSavedBracket(savedBracketId: string) {
    setSelectedSavedBracketId(savedBracketId)
    setSavedBracketMessage('')
  }

  function getSavedBracketStatus(savedBracket: SavedBracket) {
    const savedBracketRounds = buildBracketRounds(
      getBracketAssignments(savedBracket.choices),
    )
    const savedBracketFinalMatch = savedBracketRounds.at(-1)?.matches[0]

    if (
      savedBracketFinalMatch &&
      savedBracket.winnerByMatchId[savedBracketFinalMatch.id]
    ) {
      return 'Completed'
    }

    if (savedBracket.bracketStarted) {
      return 'In progress'
    }

    return 'Draft'
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

  function updateDarkMode(darkMode: boolean) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      darkMode,
    }))
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const email = authEmail.trim()
    const password = authPassword

    if (!supabase || !email || password.length < 6) {
      return
    }

    setAuthLoading(true)
    setAuthMessage('')

    const { error } =
      authMode === 'login'
        ? await supabase.auth.signInWithPassword({
            email,
            password,
          })
        : await supabase.auth.signUp({
            email,
            password,
          })

    setAuthLoading(false)

    if (error) {
      setAuthMessage(getAuthErrorMessage(error.message))
      return
    }

    if (authMode === 'signup') {
      setAuthMessage('Account created. Check your email if confirmation is required.')
      return
    }

    setAuthMessage('Signed in.')
  }

  async function signOut() {
    if (!supabase) {
      return
    }

    setAuthLoading(true)
    setAuthMessage('')

    const { error } = await supabase.auth.signOut()

    setAuthLoading(false)

    if (error) {
      setAuthMessage(getAuthErrorMessage(error.message))
    }
  }

  function openAuthScreen(nextAuthMode: AuthMode) {
    setAuthMode(nextAuthMode)
    setAuthMessage('')
    setAuthScreenOpen(true)
  }

  function openMainMenu() {
    setAppMode('home')
    setAuthMessage('')
  }

  function openChoiceDrawerForEntry() {
    setChoiceDrawerOpen(true)
    requestAnimationFrame(() => {
      choiceEntryRef.current?.focus()
    })
  }

  async function loadOnlineRoomByCode(code: string, silent = false) {
    const normalizedCode = code.trim().toUpperCase()

    if (!supabase || !normalizedCode) {
      return undefined
    }

    if (!silent) {
      setOnlineLoading(true)
      setOnlineMessage('')
    }

    const { data, error } = await supabase
      .from(ONLINE_ROOMS_TABLE)
      .select(
        'id, code, title, participants, choices, bracket_started, winner_by_match_id, votes_by_match_id, updated_at',
      )
      .eq('code', normalizedCode)
      .maybeSingle<OnlineRoomRow>()

    if (!silent) {
      setOnlineLoading(false)
    }

    if (error || !data) {
      if (!silent) {
        setOnlineMessage('Could not find that room.')
      }
      return undefined
    }

    const room = normalizeOnlineRoom(data)
    setOnlineRoom(room)
    setOnlineRoomCodeInput(room.code)
    return room
  }

  async function saveOnlineRoom(
    nextRoom: OnlineRoom,
    successMessage: string,
  ) {
    if (!supabase) {
      setOnlineMessage('Online mode needs Supabase configured.')
      return
    }

    setOnlineLoading(true)
    setOnlineMessage('')

    const { data, error } = await supabase
      .from(ONLINE_ROOMS_TABLE)
      .update({
        participants: nextRoom.participants,
        choices: nextRoom.choices,
        bracket_started: nextRoom.bracketStarted,
        winner_by_match_id: nextRoom.winnerByMatchId,
        votes_by_match_id: nextRoom.votesByMatchId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', nextRoom.id)
      .select(
        'id, code, title, participants, choices, bracket_started, winner_by_match_id, votes_by_match_id, updated_at',
      )
      .single<OnlineRoomRow>()

    setOnlineLoading(false)

    if (error) {
      setOnlineMessage('Could not update the room.')
      return
    }

    setOnlineRoom(normalizeOnlineRoom(data))
    setOnlineMessage(successMessage)
  }

  async function createOnlineRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const participantName = onlineParticipantName.trim()
    const title = onlineRoomTitle.trim() || 'Decision room'

    if (!supabase || !participantName) {
      setOnlineMessage('Enter your name to create a room.')
      return
    }

    setOnlineLoading(true)
    setOnlineMessage('')

    const code = generateRoomCode()
    const participants = [
      {
        id: onlineParticipantId,
        name: participantName,
      },
    ]
    const { data, error } = await supabase
      .from(ONLINE_ROOMS_TABLE)
      .insert({
        code,
        title,
        host_user_id: session?.user.id ?? null,
        participants,
      })
      .select(
        'id, code, title, participants, choices, bracket_started, winner_by_match_id, votes_by_match_id, updated_at',
      )
      .single<OnlineRoomRow>()

    setOnlineLoading(false)

    if (error) {
      setOnlineMessage('Could not create the room. Try again.')
      return
    }

    setOnlineRoom(normalizeOnlineRoom(data))
    setOnlineRoomCodeInput(code)
    setOnlineMessage(`Room ${code} created.`)
  }

  async function joinOnlineRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const participantName = onlineParticipantName.trim()

    if (!participantName) {
      setOnlineMessage('Enter your name to join.')
      return
    }

    const room = await loadOnlineRoomByCode(onlineRoomCodeInput)

    if (!room) {
      return
    }

    const participants = room.participants.some(
      (participant) => participant.id === onlineParticipantId,
    )
      ? room.participants.map((participant) =>
          participant.id === onlineParticipantId
            ? { ...participant, name: participantName }
            : participant,
        )
      : [
          ...room.participants,
          {
            id: onlineParticipantId,
            name: participantName,
          },
        ]

    await saveOnlineRoom(
      {
        ...room,
        participants,
      },
      `Joined room ${room.code}.`,
    )
  }

  function leaveOnlineRoom() {
    setOnlineRoom(null)
    setOnlineChoiceName('')
    setOnlineMessage('')
  }

  async function addOnlineChoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = onlineChoiceName.trim()

    if (
      !onlineRoom ||
      !name ||
      onlineRoom.bracketStarted ||
      onlineRoom.choices.length >= MAX_BRACKET_ITEMS
    ) {
      return
    }

    await saveOnlineRoom(
      {
        ...onlineRoom,
        choices: [...onlineRoom.choices, createChoice(name)],
      },
      'Choice added.',
    )
    setOnlineChoiceName('')
  }

  async function startOnlineVoting() {
    if (!onlineRoom || onlineRoom.choices.length < MIN_BRACKET_ITEMS) {
      return
    }

    await saveOnlineRoom(
      {
        ...onlineRoom,
        bracketStarted: true,
        winnerByMatchId: {},
        votesByMatchId: {},
      },
      'Voting started.',
    )
  }

  async function voteOnline(choiceId: string) {
    if (!onlineRoom || !onlineCurrentMatch) {
      return
    }

    const matchId = onlineCurrentMatch.match.id
    const votesForMatch = {
      ...(onlineRoom.votesByMatchId[matchId] ?? {}),
      [onlineParticipantId]: choiceId,
    }
    const votesByMatchId = {
      ...onlineRoom.votesByMatchId,
      [matchId]: votesForMatch,
    }
    const winningChoiceId = getOnlineMatchWinnerFromVotes(
      votesForMatch,
      onlineRoom.participants.length,
    )

    await saveOnlineRoom(
      {
        ...onlineRoom,
        votesByMatchId,
        winnerByMatchId: winningChoiceId
          ? {
              ...onlineRoom.winnerByMatchId,
              [matchId]: winningChoiceId,
            }
          : onlineRoom.winnerByMatchId,
      },
      winningChoiceId ? 'Match decided.' : 'Vote saved.',
    )
  }

  function switchAuthMode(nextAuthMode: AuthMode) {
    setAuthMode(nextAuthMode)
    setAuthMessage('')
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
              <article
                className={
                  match.id === activeSelectionMatchId
                    ? 'active-selection-match'
                    : undefined
                }
                data-match-id={match.id}
                key={match.id}
                ref={(element) => {
                  if (element) {
                    matchElementRefs.current.set(match.id, element)
                    return
                  }

                  matchElementRefs.current.delete(match.id)
                }}
              >
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

  if (authScreenOpen && !session) {
    return (
      <main className="auth-phase">
        <section className="auth-screen" aria-label="User account">
          <div className="auth-screen-header">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setAuthScreenOpen(false)}
            >
              Back
            </button>

            <div>
              <h1>What2Pick</h1>
              <p>
                {authMode === 'login'
                  ? 'Log in to save your choices and settings.'
                  : 'Create an account to keep your brackets synced.'}
              </p>
            </div>
          </div>

          <form className="auth-form" onSubmit={submitAuth}>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              disabled={authLoading || !isSupabaseConfigured}
              required
            />

            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              disabled={authLoading || !isSupabaseConfigured}
              minLength={6}
              required
            />

            <button
              type="submit"
              disabled={
                authLoading ||
                !isSupabaseConfigured ||
                authEmail.trim().length === 0 ||
                authPassword.length < 6
              }
            >
              {authLoading
                ? 'Working...'
                : authMode === 'login'
                  ? 'Log in'
                  : 'Create account'}
            </button>
          </form>

          {!isSupabaseConfigured && <p>Login is not configured.</p>}
          {authMessage && <p role="status">{authMessage}</p>}

          <div className="auth-mode-switch">
            {authMode === 'login' ? (
              <>
                <span>Need an account?</span>
                <button type="button" onClick={() => switchAuthMode('signup')}>
                  Create account
                </button>
              </>
            ) : (
              <>
                <span>Already have an account?</span>
                <button type="button" onClick={() => switchAuthMode('login')}>
                  Log in
                </button>
              </>
            )}
          </div>
        </section>
      </main>
    )
  }

  if (templateScreenOpen && session) {
    return (
      <main className="templates-phase">
        <section className="template-screen" aria-label="Saved lists">
          <div className="template-screen-header">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setTemplateScreenOpen(false)}
            >
              Back
            </button>

            <div>
              <h1>Saved lists</h1>
              <p>
                {activeTemplate
                  ? `Active list: ${activeTemplate.name}`
                  : 'Create, load, rename, update, and delete your reusable lists.'}
              </p>
            </div>
          </div>

          <div className="template-screen-grid">
            <section className="template-panel">
              <h2>Current list</h2>
              <p>
                {choices.length} choice{choices.length === 1 ? '' : 's'} in the current setup.
              </p>

              <form
                className="template-form"
                onSubmit={saveChoiceTemplate}
              >
                <label htmlFor="template-name">New saved list name</label>
                <input
                  id="template-name"
                  type="text"
                  placeholder="Example: Friday restaurants"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  disabled={templateLoading || choices.length === 0}
                />
                <button
                  type="submit"
                  disabled={
                    templateLoading ||
                    templateName.trim().length === 0 ||
                    choices.length === 0
                  }
                >
                  Save new list
                </button>
              </form>

              <button
                type="button"
                onClick={updateChoiceTemplate}
                disabled={
                  templateLoading ||
                  !selectedTemplateId ||
                  choices.length === 0
                }
              >
                Update selected list
              </button>
            </section>

            <section className="template-panel">
              <div className="template-panel-header">
                <div>
                  <h2>Your saved lists</h2>
                  <p>
                    {choiceTemplates.length} saved list
                    {choiceTemplates.length === 1 ? '' : 's'}.
                  </p>
                </div>

                <div className="template-sort" aria-label="Sort saved lists">
                  <button
                    type="button"
                    className={
                      templateSortMode === 'recent'
                        ? 'secondary-button selected'
                        : 'secondary-button'
                    }
                    onClick={() => setTemplateSortMode('recent')}
                  >
                    Recent
                  </button>
                  <button
                    type="button"
                    className={
                      templateSortMode === 'name'
                        ? 'secondary-button selected'
                        : 'secondary-button'
                    }
                    onClick={() => setTemplateSortMode('name')}
                  >
                    A-Z
                  </button>
                </div>
              </div>

              <div className="template-loader">
                <label htmlFor="choice-template">Selected list</label>
                <select
                  id="choice-template"
                  value={selectedTemplateId}
                  onChange={(event) => selectChoiceTemplate(event.target.value)}
                  disabled={templateLoading || choiceTemplates.length === 0}
                >
                  <option value="">Choose a saved list</option>
                  {sortedChoiceTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.choiceNames.length})
                      {template.id === activeTemplateId ? ' - active' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={loadChoiceTemplate}
                  disabled={templateLoading || !selectedTemplateId}
                >
                  Load list
                </button>
              </div>

              <form className="template-rename-form" onSubmit={renameChoiceTemplate}>
                <label htmlFor="rename-template">Rename selected list</label>
                <input
                  id="rename-template"
                  type="text"
                  value={renameTemplateName}
                  onChange={(event) => setRenameTemplateName(event.target.value)}
                  disabled={templateLoading || !selectedTemplateId}
                />
                <button
                  type="submit"
                  disabled={
                    templateLoading ||
                    !selectedTemplateId ||
                    renameTemplateName.trim().length === 0 ||
                    renameTemplateName.trim() === selectedTemplate?.name
                  }
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={deleteChoiceTemplate}
                  disabled={templateLoading || !selectedTemplateId}
                >
                  Delete
                </button>
              </form>

              {sortedChoiceTemplates.length > 0 ? (
                <ul className="template-catalog">
                  {sortedChoiceTemplates.map((template) => (
                    <li
                      key={template.id}
                      className={
                        template.id === selectedTemplateId
                          ? 'selected'
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        onClick={() => selectChoiceTemplate(template.id)}
                      >
                        <strong>{template.name}</strong>
                        <span>
                          {template.choiceNames.length} choice
                          {template.choiceNames.length === 1 ? '' : 's'}
                          {template.id === activeTemplateId ? ' - active' : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No saved lists yet.</p>
              )}

              {templateMessage && <p role="status">{templateMessage}</p>}
            </section>
          </div>
        </section>
      </main>
    )
  }

  if (bracketScreenOpen && session) {
    return (
      <main className="templates-phase">
        <section className="template-screen" aria-label="My brackets">
          <div className="template-screen-header">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setBracketScreenOpen(false)}
            >
              Back
            </button>

            <div>
              <h1>My brackets</h1>
              <p>
                {activeSavedBracket
                  ? `Active bracket: ${activeSavedBracket.name}`
                  : 'Save the current bracket state or open a previous one.'}
              </p>
            </div>
          </div>

          <div className="template-screen-grid">
            <section className="template-panel">
              <h2>Current bracket</h2>
              <p>
                {choices.length} choice{choices.length === 1 ? '' : 's'}.
                {bracketStarted ? ' Bracket started.' : ' Setup draft.'}
              </p>

              <form className="template-form" onSubmit={saveCurrentBracket}>
                <label htmlFor="saved-bracket-name">Bracket name</label>
                <input
                  id="saved-bracket-name"
                  type="text"
                  placeholder="Example: Best restaurants"
                  value={savedBracketName}
                  onChange={(event) => setSavedBracketName(event.target.value)}
                  disabled={savedBracketLoading || choices.length === 0}
                />
                <button
                  type="submit"
                  disabled={
                    savedBracketLoading ||
                    savedBracketName.trim().length === 0 ||
                    choices.length === 0
                  }
                >
                  Save bracket
                </button>
              </form>

              <button
                type="button"
                onClick={updateSavedBracket}
                disabled={
                  savedBracketLoading ||
                  !selectedSavedBracketId ||
                  choices.length === 0
                }
              >
                Update selected bracket
              </button>
            </section>

            <section className="template-panel">
              <div className="template-panel-header">
                <div>
                  <h2>Saved brackets</h2>
                  <p>
                    {savedBrackets.length} bracket
                    {savedBrackets.length === 1 ? '' : 's'} saved.
                  </p>
                </div>

                <div className="template-sort" aria-label="Sort saved brackets">
                  <button
                    type="button"
                    className={
                      savedBracketSortMode === 'recent'
                        ? 'secondary-button selected'
                        : 'secondary-button'
                    }
                    onClick={() => setSavedBracketSortMode('recent')}
                  >
                    Recent
                  </button>
                  <button
                    type="button"
                    className={
                      savedBracketSortMode === 'name'
                        ? 'secondary-button selected'
                        : 'secondary-button'
                    }
                    onClick={() => setSavedBracketSortMode('name')}
                  >
                    A-Z
                  </button>
                </div>
              </div>

              <div className="template-loader">
                <label htmlFor="saved-bracket">Selected bracket</label>
                <select
                  id="saved-bracket"
                  value={selectedSavedBracketId}
                  onChange={(event) => selectSavedBracket(event.target.value)}
                  disabled={savedBracketLoading || savedBrackets.length === 0}
                >
                  <option value="">Choose a saved bracket</option>
                  {sortedSavedBrackets.map((savedBracket) => (
                    <option key={savedBracket.id} value={savedBracket.id}>
                      {savedBracket.name} ({getSavedBracketStatus(savedBracket)})
                      {savedBracket.id === activeSavedBracketId
                        ? ' - active'
                        : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={loadSavedBracket}
                  disabled={savedBracketLoading || !selectedSavedBracketId}
                >
                  Load bracket
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={deleteSavedBracket}
                  disabled={savedBracketLoading || !selectedSavedBracketId}
                >
                  Delete
                </button>
              </div>

              {sortedSavedBrackets.length > 0 ? (
                <ul className="template-catalog">
                  {sortedSavedBrackets.map((savedBracket) => (
                    <li
                      key={savedBracket.id}
                      className={
                        savedBracket.id === selectedSavedBracketId
                          ? 'selected'
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        onClick={() => selectSavedBracket(savedBracket.id)}
                      >
                        <strong>{savedBracket.name}</strong>
                        <span>
                          {savedBracket.choices.length} choice
                          {savedBracket.choices.length === 1 ? '' : 's'} -{' '}
                          {getSavedBracketStatus(savedBracket)}
                          {savedBracket.id === activeSavedBracketId
                            ? ' - active'
                            : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No saved brackets yet.</p>
              )}

              {savedBracketMessage && (
                <p role="status">{savedBracketMessage}</p>
              )}
            </section>
          </div>
        </section>
      </main>
    )
  }

  if (appMode === 'home') {
    return (
      <main className="home-phase">
        <header>
          <div className="home-hero">
            <svg
              aria-hidden="true"
              className="brand-mark"
              viewBox="0 0 64 64"
            >
              <rect
                x="13"
                y="12"
                width="24"
                height="34"
                rx="7"
                transform="rotate(-13 25 29)"
                className="brand-card brand-card-blue"
              />
              <rect
                x="27"
                y="12"
                width="24"
                height="34"
                rx="7"
                transform="rotate(13 39 29)"
                className="brand-card brand-card-red"
              />
              <circle cx="32" cy="33" r="13" className="brand-ring" />
              <circle cx="32" cy="33" r="8" className="brand-core" />
              <path d="m27.5 33 3.2 3.2 6.8-8" className="brand-check" />
            </svg>
            <h1 className="brand-title">
              What<span className="brand-title-two">2</span>Pick
            </h1>
          </div>
        </header>

        <section className="mode-grid" aria-label="Choose mode">
          <button
            type="button"
            className="mode-card primary-mode-card"
            onClick={() => setAppMode('individual')}
          >
            <strong>Individual mode</strong>
          </button>

          <button
            type="button"
            className="mode-card"
            onClick={() => setAppMode('online')}
          >
            <strong>Online mode</strong>
          </button>

          <button
            type="button"
            className="mode-card"
            onClick={() => setAppMode('settings')}
          >
            <strong>Settings</strong>
          </button>

          {isSupabaseConfigured ? (
            session ? (
              <section className="mode-card account-mode-card">
                <p className="account-email">{session.user.email}</p>
                <button type="button" onClick={signOut} disabled={authLoading}>
                  Sign out
                </button>
              </section>
            ) : (
              <section className="mode-card account-mode-card">
                <strong>Account</strong>
                <div className="account-actions">
                  <button type="button" onClick={() => openAuthScreen('login')}>
                    Log in
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openAuthScreen('signup')}
                  >
                    Create account
                  </button>
                </div>
              </section>
            )
          ) : (
            <section className="mode-card account-mode-card">
              <strong>Account</strong>
              <p className="account-email">Not configured</p>
            </section>
          )}
        </section>
      </main>
    )
  }

  if (appMode === 'settings') {
    return (
      <main className="settings-phase">
        <section className="settings-screen" aria-label="Settings">
          <div className="template-screen-header">
            <button
              type="button"
              className="secondary-button"
              onClick={openMainMenu}
            >
              Back
            </button>
            <div>
              <h1>Settings</h1>
              <p>Preferences</p>
            </div>
          </div>

          <label className="settings-row" htmlFor="settings-dark-mode">
            <span>
              <strong>Dark mode</strong>
              <small>Saved locally for guests and to your account when signed in.</small>
            </span>
            <input
              id="settings-dark-mode"
              type="checkbox"
              checked={settings.darkMode}
              onChange={(event) => updateDarkMode(event.target.checked)}
            />
          </label>
        </section>
      </main>
    )
  }

  if (appMode === 'online') {
    return (
      <main className="online-phase">
        <section className="settings-screen" aria-label="Online mode">
          <div className="template-screen-header">
            <button
              type="button"
              className="secondary-button"
              onClick={openMainMenu}
            >
              Back
            </button>
            <div>
              <h1>Online mode</h1>
              <p>Voting room</p>
            </div>
          </div>

          {!isSupabaseConfigured ? (
            <div className="mode-placeholder">
              <strong>Online mode needs Supabase.</strong>
              <p>Configure Supabase before creating voting rooms.</p>
            </div>
          ) : !onlineRoom ? (
            <div className="online-room-grid">
              <form className="online-room-form" onSubmit={createOnlineRoom}>
                <h2>Create room</h2>
                <label htmlFor="online-participant-name">Your name</label>
                <input
                  id="online-participant-name"
                  value={onlineParticipantName}
                  onChange={(event) =>
                    setOnlineParticipantName(event.target.value)
                  }
                  placeholder="Example: David"
                />
                <label htmlFor="online-room-title">Room name</label>
                <input
                  id="online-room-title"
                  value={onlineRoomTitle}
                  onChange={(event) => setOnlineRoomTitle(event.target.value)}
                  placeholder="Decision room"
                />
                <button
                  type="submit"
                  disabled={onlineLoading || !onlineParticipantName.trim()}
                >
                  Create room
                </button>
              </form>

              <form className="online-room-form" onSubmit={joinOnlineRoom}>
                <h2>Join room</h2>
                <label htmlFor="join-participant-name">Your name</label>
                <input
                  id="join-participant-name"
                  value={onlineParticipantName}
                  onChange={(event) =>
                    setOnlineParticipantName(event.target.value)
                  }
                  placeholder="Example: David"
                />
                <label htmlFor="online-room-code">Room code</label>
                <input
                  id="online-room-code"
                  value={onlineRoomCodeInput}
                  onChange={(event) =>
                    setOnlineRoomCodeInput(event.target.value.toUpperCase())
                  }
                  placeholder="ABC123"
                />
                <button
                  type="submit"
                  disabled={
                    onlineLoading ||
                    !onlineParticipantName.trim() ||
                    !onlineRoomCodeInput.trim()
                  }
                >
                  Join room
                </button>
              </form>
            </div>
          ) : (
            <div className="online-room">
              <div className="online-room-header">
                <div>
                  <h2>{onlineRoom.title}</h2>
                  <p>
                    Code <strong>{onlineRoom.code}</strong> ·{' '}
                    {onlineRoom.participants.length} participant
                    {onlineRoom.participants.length === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={leaveOnlineRoom}
                >
                  Leave
                </button>
              </div>

              <section className="online-room-panel">
                <h3>Participants</h3>
                <ul className="online-pill-list">
                  {onlineRoom.participants.map((participant) => (
                    <li key={participant.id}>
                      {participant.name}
                      {participant.id === onlineParticipantId ? ' (you)' : ''}
                    </li>
                  ))}
                </ul>
              </section>

              {!onlineRoom.bracketStarted ? (
                <section className="online-room-panel">
                  <h3>Shared choices</h3>
                  <form className="online-choice-form" onSubmit={addOnlineChoice}>
                    <label htmlFor="online-choice-name">Choice name</label>
                    <input
                      id="online-choice-name"
                      value={onlineChoiceName}
                      onChange={(event) =>
                        setOnlineChoiceName(event.target.value)
                      }
                      placeholder="Example: Pizza"
                      disabled={
                        onlineLoading ||
                        onlineRoom.choices.length >= MAX_BRACKET_ITEMS
                      }
                    />
                    <button
                      type="submit"
                      disabled={onlineLoading || !onlineChoiceName.trim()}
                    >
                      Add choice
                    </button>
                  </form>

                  {onlineRoom.choices.length > 0 ? (
                    <ul className="online-choice-list">
                      {onlineRoom.choices.map((choice) => (
                        <li key={choice.id}>{choice.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No shared choices yet.</p>
                  )}

                  <button
                    type="button"
                    onClick={startOnlineVoting}
                    disabled={
                      onlineLoading ||
                      onlineRoom.choices.length < MIN_BRACKET_ITEMS
                    }
                  >
                    Start voting
                  </button>
                </section>
              ) : (
                <section className="online-room-panel">
                  <h3>Current vote</h3>
                  {onlineChampion ? (
                    <div className="champion-result" role="status">
                      <p>Champion</p>
                      <h3>{onlineChampion.name}</h3>
                    </div>
                  ) : onlineCurrentMatch ? (
                    <div className="online-vote-card">
                      <h4>{onlineCurrentMatch.match.label}</h4>
                      <div className="online-vote-options">
                        {onlineCurrentMatch.participants.map((choice) => {
                          const voteCount = Object.values(
                            onlineCurrentVotes,
                          ).filter((choiceId) => choiceId === choice.id).length
                          const isSelected =
                            onlineCurrentVotes[onlineParticipantId] === choice.id

                          return (
                            <button
                              type="button"
                              className={isSelected ? 'selected' : undefined}
                              key={choice.id}
                              onClick={() => voteOnline(choice.id)}
                              disabled={onlineLoading}
                            >
                              <span>{choice.name}</span>
                              <strong>{voteCount}</strong>
                            </button>
                          )
                        })}
                      </div>
                      <p>
                        {Object.keys(onlineCurrentVotes).length} of{' '}
                        {onlineRoom.participants.length} votes in.
                      </p>
                    </div>
                  ) : (
                    <p>Waiting for the next match.</p>
                  )}
                </section>
              )}
            </div>
          )}

          {onlineMessage && <p role="status">{onlineMessage}</p>}
        </section>
      </main>
    )
  }

  return (
    <main
      className={
        bracketStarted
          ? 'playing-phase'
          : `setup-phase ${
              choiceDrawerOpen ? 'choices-open' : 'choices-closed'
            }`
      }
    >
      <header>
        <div className="top-bar">
          <button
            type="button"
            className="back-button"
            onClick={openMainMenu}
            aria-label="Back"
          >
            ←
          </button>

          <div className="brand-lockup">
            <svg
              aria-hidden="true"
              className="brand-mark"
              viewBox="0 0 64 64"
            >
              <rect
                x="13"
                y="12"
                width="24"
                height="34"
                rx="7"
                transform="rotate(-13 25 29)"
                className="brand-card brand-card-blue"
              />
              <rect
                x="27"
                y="12"
                width="24"
                height="34"
                rx="7"
                transform="rotate(13 39 29)"
                className="brand-card brand-card-red"
              />
              <circle cx="32" cy="33" r="13" className="brand-ring" />
              <circle cx="32" cy="33" r="8" className="brand-core" />
              <path d="m27.5 33 3.2 3.2 6.8-8" className="brand-check" />
            </svg>

            <h1 className="brand-title">
              What<span className="brand-title-two">2</span>Pick
            </h1>
          </div>

          {!bracketStarted && (
            <div className="top-controls">
              <label className="theme-toggle" htmlFor="dark-mode">
                <input
                  id="dark-mode"
                  type="checkbox"
                  checked={settings.darkMode}
                  onChange={(event) => updateDarkMode(event.target.checked)}
                />
                Dark mode
              </label>

              <section className="account-summary" aria-label="User account">
                {isSupabaseConfigured ? (
                  session ? (
                    <>
                      <p>
                        <span>Signed in</span>
                        <strong>{session.user.email}</strong>
                      </p>
                      <button
                        type="button"
                        onClick={signOut}
                        disabled={authLoading}
                      >
                        Sign out
                      </button>
                    </>
                  ) : (
                    <div className="account-actions">
                      <button
                        type="button"
                        onClick={() => openAuthScreen('login')}
                      >
                        Log in
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openAuthScreen('signup')}
                      >
                        Create account
                      </button>
                    </div>
                  )
                ) : (
                  <p>Login is not configured.</p>
                )}

                {session && syncMessage && <p role="status">{syncMessage}</p>}
                {authMessage && <p role="status">{authMessage}</p>}
              </section>
            </div>
          )}
        </div>

        {!bracketStarted && <p>Create a bracket. Make your choice.</p>}
      </header>

      {!bracketStarted && (
        <>
          <section className="setup-control-bar" aria-label="Choice controls">
            <div className="mobile-view-switch" aria-label="Setup view">
              <button
                type="button"
                className={choiceDrawerOpen ? 'selected' : undefined}
                onClick={() => setChoiceDrawerOpen(true)}
              >
                Choices
              </button>
              <button
                type="button"
                className={!choiceDrawerOpen ? 'selected' : undefined}
                onClick={() => setChoiceDrawerOpen(false)}
              >
                Bracket
              </button>
            </div>

            <button
              type="button"
              className="drawer-toggle-button"
              aria-expanded={choiceDrawerOpen}
              aria-controls="choice-drawer"
              onClick={() => setChoiceDrawerOpen((isOpen) => !isOpen)}
            >
              <span>{choiceDrawerOpen ? 'Hide choices' : 'Show choices'}</span>
              <strong>
                {choices.length}/{MAX_BRACKET_ITEMS}
              </strong>
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={openChoiceDrawerForEntry}
              disabled={choices.length >= MAX_BRACKET_ITEMS}
            >
              Add
            </button>

            {session && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setBracketScreenOpen(true)}
              >
                My brackets
              </button>
            )}

            <button
              type="button"
              className="secondary-button"
              onClick={shuffleRandomChoices}
              disabled={randomChoicesCount < 2}
            >
              Shuffle
            </button>

            <button
              type="button"
              onClick={toggleBracket}
              disabled={!canStartBracket}
            >
              Start bracket
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
          </section>

          {choiceDrawerOpen && (
            <section
              className="setup-panel choice-drawer"
              id="choice-drawer"
              aria-label="Choices drawer"
            >
              <div className="choice-drawer-header">
                <div>
                  <h2>Choices</h2>
                  <p>
                    {choices.length} of {MAX_BRACKET_ITEMS} choices added. Start
                    with at least {MIN_BRACKET_ITEMS}.
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setChoiceDrawerOpen(false)}
                >
                  Hide
                </button>
              </div>

          <div className="choice-entry-grid">
            <form
              className={bulkChoiceMode ? 'choice-entry-form bulk-mode' : 'choice-entry-form'}
              onSubmit={submitChoices}
            >
              <div className="choice-entry-header">
                <label htmlFor="choice-entry">
                  {bulkChoiceMode ? 'Multiple choices' : 'Choice name'}
                </label>
                <label className="bulk-mode-toggle" htmlFor="bulk-choice-mode">
                  <input
                    id="bulk-choice-mode"
                    type="checkbox"
                    checked={bulkChoiceMode}
                    onChange={(event) =>
                      toggleBulkChoiceMode(event.target.checked)
                    }
                    disabled={
                      bracketStarted || choices.length >= MAX_BRACKET_ITEMS
                    }
                  />
                  Multiple
                </label>
              </div>

              {bulkChoiceMode ? (
                <>
                  <textarea
                    id="choice-entry"
                    ref={(element) => {
                      choiceEntryRef.current = element
                    }}
                    placeholder={'Pizza\nSushi\nTacos'}
                    value={bulkChoiceText}
                    onChange={(event) => setBulkChoiceText(event.target.value)}
                    disabled={
                      bracketStarted || choices.length >= MAX_BRACKET_ITEMS
                    }
                    rows={5}
                  />

                  <p className="import-summary">
                    {importableChoiceNames.length} ready. {availableChoiceSlots}{' '}
                    slots available.
                    {skippedChoicesCount > 0
                      ? ` ${skippedChoicesCount} will not fit.`
                      : ''}
                  </p>
                </>
              ) : (
                <input
                  id="choice-entry"
                  ref={(element) => {
                    choiceEntryRef.current = element
                  }}
                  type="text"
                  placeholder="Example: Pizza"
                  value={choiceName}
                  onChange={(event) => setChoiceName(event.target.value)}
                  disabled={
                    bracketStarted || choices.length >= MAX_BRACKET_ITEMS
                  }
                />
              )}

              <button
                type="submit"
                disabled={
                  bracketStarted ||
                  choices.length >= MAX_BRACKET_ITEMS ||
                  (bulkChoiceMode && importableChoiceNames.length === 0)
                }
              >
                {bulkChoiceMode ? 'Add list' : 'Add choice'}
              </button>
            </form>
          </div>

          {choices.length === 0 ? (
            <p>No choices added yet.</p>
          ) : (
            <ul className="choice-list">
              {choices.map((choice) => (
                <li key={choice.id}>
                  <span>{choice.name}</span>

                  <label
                    className="visually-hidden"
                    htmlFor={`position-${choice.id}`}
                  >
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
                    aria-label={`Remove ${choice.name}`}
                    className="remove-choice-button"
                    onClick={() => removeChoice(choice.id)}
                    disabled={bracketStarted}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {session && (
            <section className="quick-list-panel" aria-label="Active saved list">
              <div className="quick-list-summary">
                <span>Active saved list</span>
                <strong>{activeTemplate?.name ?? 'None selected'}</strong>
              </div>

              {choiceTemplates.length > 0 && (
                  <select
                    aria-label="Saved list"
                    value={selectedTemplateId}
                    onChange={(event) => selectChoiceTemplate(event.target.value)}
                    disabled={templateLoading}
                  >
                    <option value="">Choose a saved list</option>
                    {sortedChoiceTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.choiceNames.length})
                        {template.id === activeTemplateId ? ' - active' : ''}
                      </option>
                    ))}
                  </select>
              )}

              {choiceTemplates.length > 0 && (
                <button
                  type="button"
                  onClick={loadChoiceTemplate}
                  disabled={templateLoading || !selectedTemplateId}
                >
                  Load
                </button>
              )}
              <button
                type="button"
                onClick={saveQuickChoiceList}
                disabled={templateLoading || choices.length === 0}
              >
                Save
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setTemplateScreenOpen(true)}
              >
                Edit lists
              </button>
              {quickListSaveOpen && (
                <form
                  className="quick-list-save-form"
                  onSubmit={saveChoiceTemplate}
                >
                  <label htmlFor="quick-template-name">New list name</label>
                  <input
                    id="quick-template-name"
                    type="text"
                    placeholder="Example: Weekend picks"
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    disabled={templateLoading}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={
                      templateLoading ||
                      templateName.trim().length === 0 ||
                      choices.length === 0
                    }
                  >
                    Save new list
                  </button>
                </form>
              )}
              {templateMessage && <p role="status">{templateMessage}</p>}
            </section>
          )}

            </section>
          )}
        </>
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
              <button
                type="button"
                className="secondary-button"
                onClick={toggleBracket}
              >
                Edit bracket setup
              </button>
              {champion && (
                <button
                  type="button"
                  className="danger-button"
                  onClick={startOver}
                >
                  Start over
                </button>
              )}
            </div>
          )}
        </div>

        {choices.length < MIN_BRACKET_ITEMS ? (
          <p>Add at least {MIN_BRACKET_ITEMS} choices to preview the bracket.</p>
        ) : (
          <>
            {!bracketStarted && (
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
            )}

            {bracketStarted && (
              <div className="selection-toolbar" aria-label="Selection controls">
                <label htmlFor="auto-focus-selection">
                  <input
                    id="auto-focus-selection"
                    type="checkbox"
                    checked={autoFocusSelection}
                    onChange={(event) =>
                      setAutoFocusSelection(event.target.checked)
                    }
                  />
                  Auto focus
                </label>

                <label className="zoom-control" htmlFor="bracket-zoom">
                  <span>Zoom</span>
                  <input
                    id="bracket-zoom"
                    type="range"
                    min="55"
                    max="125"
                    step="5"
                    value={bracketZoom}
                    onChange={(event) =>
                      setBracketZoom(Number(event.target.value))
                    }
                  />
                  <strong>{bracketZoom}%</strong>
                </label>
              </div>
            )}

            <div
              className="bracket-scrollbar"
              aria-label="Scroll bracket rounds horizontally"
              ref={bracketScrollbarRef}
              onScroll={() => syncBracketScroll('scrollbar')}
            >
              <div
                className="bracket-scrollbar-content"
                style={{
                  width: `${bracketArenaWidthRem}rem`,
                }}
              />
            </div>

            <div
              className="bracket-viewport"
              aria-label="Bracket rounds"
              ref={bracketViewportRef}
              onScroll={() => syncBracketScroll('viewport')}
            >
              <div
                className="bracket-rounds bracket-arena"
                ref={bracketArenaRef}
                style={{
                  '--bracket-side-width': `${bracketSideWidthRem}rem`,
                  '--bracket-zoom': bracketStarted
                    ? bracketZoom / 100
                    : 1,
                } as CSSProperties}
              >
                {bracketConnectors.length > 0 && (
                  <svg
                    aria-hidden="true"
                    className="bracket-connectors"
                    data-testid="bracket-connectors"
                  >
                    {bracketConnectors.map((connector) => (
                      <path
                        d={connector.path}
                        data-source-match-id={connector.sourceMatchId}
                        data-source-x={connector.sourceX}
                        data-source-y={connector.sourceY}
                        data-target-match-id={connector.targetMatchId}
                        data-target-x={connector.targetX}
                        data-target-y={connector.targetY}
                        data-testid="bracket-connector"
                        key={connector.id}
                      />
                    ))}
                  </svg>
                )}
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

            {session && (!bracketStarted || champion) && (
              <div className="bracket-panel-footer">
                {savedBracketMessage && (
                  <p role="status">{savedBracketMessage}</p>
                )}
                {quickSaveOpen ? (
                  <form
                    className="quick-save-bracket-form"
                    onSubmit={saveCurrentBracket}
                  >
                    <label htmlFor="quick-saved-bracket-name">
                      Bracket name
                    </label>
                    <input
                      id="quick-saved-bracket-name"
                      type="text"
                      value={savedBracketName}
                      onChange={(event) =>
                        setSavedBracketName(event.target.value)
                      }
                      disabled={savedBracketLoading}
                    />
                    <button
                      type="submit"
                      disabled={
                        savedBracketLoading ||
                        savedBracketName.trim().length === 0
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={closeQuickSaveBracket}
                      disabled={savedBracketLoading}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={openQuickSaveBracket}
                    disabled={savedBracketLoading || choices.length === 0}
                  >
                    Save bracket
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}

export default App
