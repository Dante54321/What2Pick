import { expect, test } from '@playwright/test'

const choices = ['Elden Ring', 'Hades', 'Celeste', 'Balatro']

test('chooses a champion through the What2Pick bracket', async ({ page }) => {
  await test.step('Open What2Pick', async () => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'What2Pick' })).toBeVisible()
  })

  await test.step('Add four choices', async () => {
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
