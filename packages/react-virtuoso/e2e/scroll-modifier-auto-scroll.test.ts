import { expect, Page, test } from '@playwright/test'

//@ts-expect-error - type module and playwright
import { navigateToExample } from './utils.ts'

test.describe('scroll modifier auto-scroll-to-bottom', () => {
  test.beforeEach(async ({ baseURL, page }) => {
    await navigateToExample(page, baseURL, 'scroll-modifier-auto-scroll')
    // Wait for the scroller to be ready
    await page.waitForSelector('[data-testid=virtuoso-scroller]', { timeout: 10000 })
    await page.waitForTimeout(200)
  })

  async function getScrollTop(page: Page) {
    const scroller = page.locator('[data-testid=virtuoso-scroller]')
    await scroller.waitFor({ timeout: 5000 })
    return scroller.evaluate((el) => el.scrollTop)
  }

  async function getScrollHeight(page: Page) {
    const scroller = page.locator('[data-testid=virtuoso-scroller]')
    await scroller.waitFor({ timeout: 5000 })
    return scroller.evaluate((el) => el.scrollHeight)
  }

  async function getClientHeight(page: Page) {
    const scroller = page.locator('[data-testid=virtuoso-scroller]')
    await scroller.waitFor({ timeout: 5000 })
    return scroller.evaluate((el) => el.clientHeight)
  }

  async function scrollToBottom(page: Page) {
    const scroller = page.locator('[data-testid=virtuoso-scroller]')
    await scroller.waitFor({ timeout: 5000 })
    const scrollHeight = await scroller.evaluate((el) => el.scrollHeight)
    const clientHeight = await scroller.evaluate((el) => el.clientHeight)
    await scroller.evaluate((el, maxScroll) => {
      el.scrollTop = maxScroll
    }, scrollHeight - clientHeight)
    await page.waitForTimeout(200)
  }

  test('auto-scrolls to bottom when adding messages', async ({ page }) => {
    // Scroll to bottom first
    await scrollToBottom(page)

    // Add a message
    const button = page.locator('button:has-text("Add Message (auto scroll)")')
    await button.waitFor({ timeout: 5000 })
    await button.click()
    await page.waitForTimeout(500)

    // Should be at bottom after adding message
    const scrollHeightAfter = await getScrollHeight(page)
    const scrollTopAfter = await getScrollTop(page)
    const clientHeight = await getClientHeight(page)

    // Should be scrolled to bottom (allowing for small rounding differences)
    expect(scrollTopAfter + clientHeight).toBeGreaterThanOrEqual(scrollHeightAfter - 10)
  })

  test('smooth scrolls to bottom when adding messages', async ({ page }) => {
    // Scroll to bottom first
    await scrollToBottom(page)

    // Add a message with smooth scroll
    const button = page.locator('button:has-text("Add Message (smooth scroll)")')
    await button.waitFor({ timeout: 5000 })
    await button.click()
    await page.waitForTimeout(1000) // Wait for smooth scroll animation

    // Should be at bottom after adding message
    const scrollHeight = await getScrollHeight(page)
    const scrollTop = await getScrollTop(page)
    const clientHeight = await getClientHeight(page)

    // Should be scrolled to bottom (allowing for small rounding differences)
    expect(scrollTop + clientHeight).toBeGreaterThanOrEqual(scrollHeight - 10)
  })
})
