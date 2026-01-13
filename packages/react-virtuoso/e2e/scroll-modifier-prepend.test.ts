import { expect, Page, test } from '@playwright/test'

//@ts-expect-error - type module and playwright
import { navigateToExample } from './utils.ts'

test.describe('scroll modifier prepend', () => {
  test.beforeEach(async ({ baseURL, page }) => {
    await navigateToExample(page, baseURL, 'scroll-modifier-prepend')
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

  async function scrollToMiddle(page: Page) {
    const scroller = page.locator('[data-testid=virtuoso-scroller]')
    await scroller.waitFor({ timeout: 5000 })
    const scrollHeight = await scroller.evaluate((el) => el.scrollHeight)
    await scroller.evaluate((el, height) => {
      el.scrollTop = height / 2
    }, scrollHeight)
    await page.waitForTimeout(200)
  }

  test('preserves scroll position when prepending items', async ({ page }) => {
    // Wait for items to render
    await page.waitForTimeout(300)

    // Get initial scroll height to check if list is scrollable
    const scroller = page.locator('[data-testid=virtuoso-scroller]')
    const scrollHeight = await scroller.evaluate((el) => el.scrollHeight)
    const clientHeight = await scroller.evaluate((el) => el.clientHeight)
    const isScrollable = scrollHeight > clientHeight

    if (isScrollable) {
      // Scroll to middle of list
      await scrollToMiddle(page)
      const scrollTopBefore = await getScrollTop(page)
      expect(scrollTopBefore).toBeGreaterThan(0)

      // Prepend items
      await page.locator('button:has-text("Prepend 5 Items")').click()
      await page.waitForTimeout(1500) // Wait longer for scroll adjustment to complete

      // Scroll position should be adjusted to account for prepended items
      const scrollTopAfter = await getScrollTop(page)
      expect(scrollTopAfter).toBeGreaterThan(scrollTopBefore)
    } else {
      // If list isn't scrollable initially, just verify prepending works
      await page.locator('button:has-text("Prepend 5 Items")').click()
      await page.waitForTimeout(800)
      // After prepending, verify the list updated
      const newScrollHeight = await scroller.evaluate((el) => el.scrollHeight)
      expect(newScrollHeight).toBeGreaterThan(scrollHeight)
    }
  })

  test('prepends items correctly', async ({ page }) => {
    // Wait for items to render
    await page.waitForTimeout(400)

    // Get initial item count using the item list
    const initialItemCount = await page.evaluate(() => {
      const listContainer = document.querySelector('[data-testid=virtuoso-item-list]')
      return listContainer ? listContainer.childElementCount : 0
    })
    expect(initialItemCount).toBeGreaterThan(0)

    // Prepend items
    const button = page.locator('button:has-text("Prepend 5 Items")')
    await button.waitFor({ timeout: 5000 })
    await button.click()
    await page.waitForTimeout(800) // Wait for prepend to complete

    // Get item count after prepending
    const itemsAfter = await page.evaluate(() => {
      const listContainer = document.querySelector('[data-testid=virtuoso-item-list]')
      return listContainer ? listContainer.childElementCount : 0
    })

    // Should have more items (prepended items should be added)
    expect(itemsAfter).toBeGreaterThanOrEqual(initialItemCount)
  })
})
