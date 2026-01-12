import { expect, Page, test } from '@playwright/test'

//@ts-expect-error - type module and playwright
import { navigateToExample } from './utils.ts'

test.describe('scroll modifier items-change', () => {
  test.beforeEach(async ({ baseURL, page }) => {
    await navigateToExample(page, baseURL, 'scroll-modifier-items-change')
    // Wait for the scroller to be ready
    await page.waitForSelector('[data-testid=virtuoso-scroller]', { timeout: 10000 })
    // Wait for item list to exist (it might be hidden initially)
    await page.waitForSelector('[data-testid=virtuoso-item-list]', { timeout: 10000, state: 'attached' })
    await page.waitForTimeout(400)
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

  test('maintains scroll position at bottom when filtering items', async ({ page }) => {
    // Scroll to bottom
    await scrollToBottom(page)
    const scrollHeightBefore = await getScrollHeight(page)
    const scrollTopBefore = await getScrollTop(page)
    const clientHeight = await getClientHeight(page)

    // Filter to active items only
    await page.locator('button:has-text("Show Active Only")').click()
    await page.waitForTimeout(300)

    // Should still be at bottom after filtering
    const scrollHeightAfter = await getScrollHeight(page)
    const scrollTopAfter = await getScrollTop(page)

    // If we were at bottom before, we should still be at bottom
    const wasAtBottom = scrollTopBefore + clientHeight >= scrollHeightBefore - 10
    if (wasAtBottom) {
      expect(scrollTopAfter + clientHeight).toBeGreaterThanOrEqual(scrollHeightAfter - 10)
    }
  })

  test('filters items correctly', async ({ page }) => {
    // Wait for items to render
    await page.waitForTimeout(400)
    
    // Get initial scroll height (proportional to total item count)
    const initialScrollHeight = await getScrollHeight(page)
    expect(initialScrollHeight).toBeGreaterThan(0)

    // Filter to active items only
    const button = page.locator('button:has-text("Show Active Only")')
    await button.waitFor({ timeout: 5000 })
    await button.click()
    await page.waitForTimeout(800) // Wait for filter to apply

    // Get scroll height after filtering (should be less since we have fewer items)
    const filteredScrollHeight = await getScrollHeight(page)
    
    // Should have fewer items (only active ones), so scroll height should be less
    expect(filteredScrollHeight).toBeLessThan(initialScrollHeight)

    // Verify items are filtered by checking visible text
    const itemTexts = await page.evaluate(() => {
      const listContainer = document.querySelector('[data-testid=virtuoso-item-list]')
      if (!listContainer) return []
      return Array.from(listContainer.children).map((child) => child.textContent || '')
    })
    
    // All visible items should be active
    itemTexts.forEach((text) => {
      expect(text).toContain('active')
    })
  })

  test('resets items correctly', async ({ page }) => {
    // Wait for items to render
    await page.waitForTimeout(400)
    
    // Filter to active items
    const filterButton = page.locator('button:has-text("Show Active Only")')
    await filterButton.waitFor({ timeout: 5000 })
    await filterButton.click()
    await page.waitForTimeout(800) // Wait for filter to apply
    
    const filteredScrollHeight = await getScrollHeight(page)

    // Reset
    const resetButton = page.locator('button:has-text("Reset")')
    await resetButton.waitFor({ timeout: 5000 })
    await resetButton.click()
    await page.waitForTimeout(800) // Wait for reset to apply

    // Should have more items again (back to 50 items), so scroll height should be greater
    const resetScrollHeight = await getScrollHeight(page)
    expect(resetScrollHeight).toBeGreaterThan(filteredScrollHeight)
  })
})
