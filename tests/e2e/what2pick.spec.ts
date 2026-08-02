import { expect, test } from '@playwright/test'

const choices = ['Elden Ring', 'Hades', 'Celeste', 'Balatro']
const multiRoundChoices = [
  'Elden Ring',
  'Hades',
  'Celeste',
  'Balatro',
  'Hollow Knight',
  'Disco Elysium',
  'Stardew Valley',
  'Outer Wilds',
]
const sevenChoiceBracket = multiRoundChoices.slice(0, 7)

test('chooses a champion through the What2Pick bracket', async ({ page }) => {
  await test.step('Open What2Pick', async () => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'What2Pick' })).toBeVisible()
    await page.getByRole('button', { name: /Individual mode/ }).click()
  })

  await test.step('Add four choices', async () => {
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    for (const choice of choices) {
      await page.getByLabel('Choice name').fill(choice)
      await page.getByRole('button', { name: 'Add choice' }).click()
    }
  })

  await test.step('Verify the choices appear in the list', async () => {
    const list = page.getByRole('list')

    for (const choice of choices) {
      await expect(list.getByText(choice)).toBeVisible()
    }
  })

  await test.step('Assign fixed bracket positions and start the bracket', async () => {
    const positionSelects = page.getByLabel('Position')

    await positionSelects.nth(0).selectOption('slot-1')
    await positionSelects.nth(1).selectOption('slot-2')
    await positionSelects.nth(2).selectOption('slot-3')
    await positionSelects.nth(3).selectOption('slot-4')
    await page.getByRole('button', { name: 'Start bracket' }).click()

    await expect(page.getByRole('status')).toContainText('Bracket started')
  })

  await test.step('Select the Match A and Match B winners', async () => {
    await page.getByRole('button', { name: /Pick 1:\s*Elden Ring/ }).click()
    await page.getByRole('button', { name: /Pick 2:\s*Balatro/ }).click()
  })

  await test.step('Select the champion', async () => {
    await page.getByRole('button', { name: /Pick 1:\s*Elden Ring/ }).last().click()
  })

  await test.step('Verify the champion appears correctly', async () => {
    await expect(page.getByText('Champion')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Elden Ring' })).toBeVisible()
  })
})

test('renders multi-round bracket connectors without empty endpoints', async ({
  page,
}) => {
  const consoleErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message)
  })

  async function buildBracket(bracketChoices: string[]) {
    await page.goto('/')
    await page.getByRole('button', { name: /Individual mode/ }).click()
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    for (const choice of bracketChoices) {
      await page.getByLabel('Choice name').fill(choice)
      await page.getByRole('button', { name: 'Add choice' }).click()
    }

    await page.getByRole('button', { name: 'Start bracket' }).click()
  }

  await buildBracket(multiRoundChoices)
  await expect(page.getByTestId('bracket-connector')).toHaveCount(6)

  async function expectAlignedConnectors(expectedConnectorCount: number) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve())
          })
        }),
    )

    const connectorReport = await page.evaluate(() => {
      const arena = document.querySelector('.bracket-arena')

      if (!arena) {
        return {
          failures: ['Missing bracket arena.'],
          relations: [],
        }
      }

      const arenaRect = arena.getBoundingClientRect()
      const connectors = Array.from(
        document.querySelectorAll<SVGPathElement>(
          '[data-testid="bracket-connector"]',
        ),
      )
      const tolerance = 2
      const failures: string[] = []
      const relations: string[] = []

      connectors.forEach((connector) => {
        const sourceMatchId = connector.dataset.sourceMatchId
        const targetMatchId = connector.dataset.targetMatchId
        relations.push(`${sourceMatchId ?? '?'}->${targetMatchId ?? '?'}`)
        const sourceMatch = sourceMatchId
          ? document.querySelector<HTMLElement>(
              `[data-match-id="${sourceMatchId}"]`,
            )
          : null
        const targetMatch = targetMatchId
          ? document.querySelector<HTMLElement>(
              `[data-match-id="${targetMatchId}"]`,
            )
          : null

        if (!sourceMatch || !targetMatch) {
          failures.push(
            `Connector ${sourceMatchId ?? '?'} -> ${targetMatchId ?? '?'} has a missing endpoint.`,
          )
          return
        }

        const sourceRect = sourceMatch.getBoundingClientRect()
        const targetRect = targetMatch.getBoundingClientRect()
        const sourceIsLeftOfTarget = sourceRect.left <= targetRect.left
        const expectedSourceX =
          (sourceIsLeftOfTarget ? sourceRect.right : sourceRect.left) -
          arenaRect.left
        const expectedTargetX =
          (sourceIsLeftOfTarget ? targetRect.left : targetRect.right) -
          arenaRect.left
        const expectedSourceY =
          sourceRect.top + sourceRect.height / 2 - arenaRect.top
        const expectedTargetY =
          targetRect.top + targetRect.height / 2 - arenaRect.top
        const sourceX = Number(connector.dataset.sourceX)
        const sourceY = Number(connector.dataset.sourceY)
        const targetX = Number(connector.dataset.targetX)
        const targetY = Number(connector.dataset.targetY)

        if (
          Math.abs(sourceX - expectedSourceX) > tolerance ||
          Math.abs(sourceY - expectedSourceY) > tolerance ||
          Math.abs(targetX - expectedTargetX) > tolerance ||
          Math.abs(targetY - expectedTargetY) > tolerance
        ) {
          failures.push(
            `Connector ${sourceMatchId} -> ${targetMatchId} is misaligned.`,
          )
        }
      })

      return {
        connectorCount: connectors.length,
        failures,
        relations,
      }
    })

    expect(connectorReport.connectorCount).toBe(expectedConnectorCount)
    expect(connectorReport.failures).toEqual([])

    return connectorReport.relations
  }

  await expectAlignedConnectors(6)

  await page.setViewportSize({ width: 390, height: 850 })
  await expect(page.getByTestId('bracket-connector')).toHaveCount(6)
  await expectAlignedConnectors(6)

  await page.setViewportSize({ width: 1280, height: 900 })
  await buildBracket(sevenChoiceBracket)
  await expect(page.getByTestId('bracket-connector')).toHaveCount(3)
  await expect(await expectAlignedConnectors(3)).toContain('r1-m3->r2-m1')

  expect(consoleErrors).toEqual([])
})
