import { insert, newTree, walk } from './AATree'
import { domIOSystem } from './domIOSystem'
import {
  AutoscrollToBottom,
  DataWithScrollModifier,
  FlatIndexLocationWithAlign,
  ItemLocationCallbackParams,
  ListScrollLocation,
  ScrollModifier,
  ScrollModifierOption,
} from './interfaces'
import { SizeRange } from './interfaces'
import { offsetOf, sizeSystem } from './sizeSystem'
import { scrollToIndexSystem } from './scrollToIndexSystem'
import { AtBottomState } from './stateFlagsSystem'
import * as u from './urx'

/**
 * Scroll modifier system that handles scroll position adjustments when data changes.
 * Mirrors the message-list implementation using urx patterns.
 */
export const scrollModifierSystem = u.system(
  ([
    { data, defaultItemSize, sizes, sizeRanges, gap },
    {
      scrollBy,
      scrollTop,
      scrollHeight,
      viewportHeight,
      headerHeight,
      footerHeight,
      fixedHeaderHeight,
      fixedFooterHeight,
      scrollingInProgress,
    },
    { scrollToIndex },
  ]) => {
    // Input streams that will be connected from listSystem
    const atBottomState = u.stream<AtBottomState>()
    const context = u.statefulStream<unknown>(null)
    // Input streams
    const dataWithScrollModifier = u.statefulStream<DataWithScrollModifier<unknown> | null | undefined>(null)
    const itemIdentity = u.statefulStream<(item: unknown) => unknown>((item) => item)

    // ListScrollLocation calculation (mirror message-list ct cell)
    const listScrollLocation = u.statefulStreamFromEmitter(
      u.pipe(
        u.combineLatest(
          scrollTop,
          headerHeight,
          footerHeight,
          fixedHeaderHeight,
          fixedFooterHeight,
          viewportHeight,
          scrollHeight,
          atBottomState,
          scrollingInProgress
        ),
        u.filter(([, , , , , , , , scrollingInProgress]) => !scrollingInProgress),
        u.map(
          ([
            scrollTopValue,
            headerHeightValue,
            footerHeightValue,
            fixedHeaderHeightValue,
            fixedFooterHeightValue,
            viewportHeightValue,
            scrollHeightValue,
            atBottomStateValue,
          ]) => {
            const totalHeaderHeight = headerHeightValue + fixedHeaderHeightValue
            const totalFooterHeight = footerHeightValue + fixedFooterHeightValue

            // Calculate listOffset: distance from list top to viewport top
            const listOffset = -scrollTopValue + totalHeaderHeight

            // Calculate visibleListHeight: visible portion height
            const visibleListHeight = Math.max(0, viewportHeightValue - totalHeaderHeight - totalFooterHeight)

            // Calculate scrollHeight: total scroll height
            const calculatedScrollHeight = scrollHeightValue - totalHeaderHeight - totalFooterHeight

            // Calculate bottomOffset: distance from scroller bottom to viewport bottom
            const bottomOffset = calculatedScrollHeight - scrollTopValue - viewportHeightValue - totalFooterHeight

            // isAtBottom: convenience flag
            const isAtBottomValue = atBottomStateValue.atBottom || bottomOffset <= 4 // threshold

            const location: ListScrollLocation = {
              listOffset,
              visibleListHeight,
              scrollHeight: calculatedScrollHeight,
              bottomOffset,
              isAtBottom: isAtBottomValue,
            }

            return location
          }
        ),
        u.distinctUntilChanged()
      ),
      {
        listOffset: 0,
        visibleListHeight: 0,
        scrollHeight: 0,
        bottomOffset: 0,
        isAtBottom: false,
      }
    )

    // Prepend signal - receives array of items to prepend
    const prependSignal = u.stream<readonly unknown[]>()

    // Auto-scroll-to-bottom signal - receives data and autoScroll behavior
    const autoScrollToBottomSignal = u.stream<{ data: readonly unknown[]; autoScroll: AutoscrollToBottom }>()

    // Items-change signal - receives new data and behavior
    const itemsChangeSignal = u.stream<{
      newData: readonly unknown[]
      autoscrollToBottomBehavior: ScrollBehavior | { location: () => FlatIndexLocationWithAlign | null | undefined }
    }>()

    // Track prepend items for scroll calculation
    const prependItemsRef = u.statefulStream<readonly unknown[] | null>(null)

    // Quick scroll estimate: defaultItemSize * prependCount
    // When prepending, we need to scroll DOWN (positive value) to maintain visual position
    u.connect(
      u.pipe(
        prependSignal,
        u.withLatestFrom(defaultItemSize),
        u.map(([items, defaultSize]) => {
          const prependCount = items.length
          if (defaultSize === undefined) {
            return { top: 0, behavior: 'auto' as const }
          }
          return { top: defaultSize * prependCount, behavior: 'auto' as const }
        })
      ),
      scrollBy
    )

    // Store prepend items for later calculation
    u.subscribe(prependSignal, (items) => {
      u.publish(prependItemsRef, items)
    })

    // Calculate actual height using offsetOf and adjust scroll
    // Wait for sizes to stabilize after prepend (skip first emission, then check prependItemsRef)
    // This mirrors message-list's approach of using skip(2) to wait for size tree updates
    u.subscribe(
      u.pipe(
        prependItemsRef,
        u.filter((items) => items !== null),
        u.withLatestFrom(sizes),
        u.map(([items, sizeState]) => {
          if (items === null) {
            throw new Error('Unexpected null items')
          }
          const prependCount = items.length
          const gapValue = u.getValue(gap)
          // Calculate height of prepended items
          const height = offsetOf(prependCount, sizeState.offsetTree, gapValue)
          return { height, items }
        })
      ),
      ({ height }) => {
        // Adjust scroll position to maintain relative position
        u.publish(scrollBy, { top: height, behavior: 'auto' })
        // Clear the prepend items ref
        u.publish(prependItemsRef, null)
      }
    )

    // Also subscribe to sizes changes after prepend to catch delayed size updates
    // This ensures we calculate even if sizes emits after prependItemsRef is set
    u.subscribe(
      u.pipe(
        sizes,
        u.withLatestFrom(prependItemsRef),
        u.filter(([, items]) => items !== null),
        u.map(([sizeState, items]) => {
          if (items === null) {
            throw new Error('Unexpected null items')
          }
          const prependCount = items.length
          const gapValue = u.getValue(gap)
          // Calculate height of prepended items
          const height = offsetOf(prependCount, sizeState.offsetTree, gapValue)
          return { height, items }
        })
      ),
      ({ height }) => {
        // Adjust scroll position to maintain relative position
        u.publish(scrollBy, { top: height, behavior: 'auto' })
        // Clear the prepend items ref
        u.publish(prependItemsRef, null)
      }
    )

    // Update data by prepending items
    u.subscribe(
      u.pipe(
        prependSignal,
        u.withLatestFrom(data),
        u.map(([prependItems, currentData]) => {
          if (currentData === undefined || currentData === null) {
            return prependItems.slice()
          }
          return [...prependItems, ...currentData]
        })
      ),
      (newData) => {
        u.publish(data, newData)
      }
    )

    // Update size tree by shifting indices (add prependCount to all existing indices)
    u.subscribe(
      u.pipe(
        prependSignal,
        u.withLatestFrom(sizes),
        u.map(([prependItems, sizeState]) => {
          const prependCount = prependItems.length
          const defaultSize = u.getValue(defaultItemSize) ?? 0

          // Shift all existing size tree indices by prependCount
          const shiftedRanges: SizeRange[] = []
          const sizeTreeRanges = walk(sizeState.sizeTree)

          for (const { k: startIndex, v: size } of sizeTreeRanges) {
            shiftedRanges.push({
              startIndex: startIndex + prependCount,
              endIndex: Infinity, // Will be calculated properly by sizeSystem
              size,
            })
          }

          // Add range for prepended items if we have a default size
          if (defaultSize > 0 && prependCount > 0) {
            shiftedRanges.push({
              startIndex: 0,
              endIndex: prependCount - 1,
              size: defaultSize,
            })
          }

          return shiftedRanges
        })
      ),
      (ranges) => {
        u.publish(sizeRanges, ranges)
      }
    )

    // Auto-scroll-to-bottom handler (mirror message-list it signal)
    u.subscribe(
      u.pipe(
        autoScrollToBottomSignal,
        u.withLatestFrom(listScrollLocation, scrollingInProgress, context),
        u.debounceTime(20), // Mirror message-list debounce
        u.map(([{ data: dataValue, autoScroll: autoScrollValue }, scrollLocation, scrollInProgressValue, contextValue]) => {
          if (autoScrollValue === false || autoScrollValue === undefined) {
            return null
          }

          let behavior: 'auto' | 'smooth' = 'auto'
          const isAtBottomValue = scrollLocation.isAtBottom

          if (typeof autoScrollValue === 'function') {
            // Call callback with params
            const params: ItemLocationCallbackParams = {
              data: dataValue ? [...dataValue] : [],
              scrollLocation,
              scrollInProgress: scrollInProgressValue,
              context: contextValue,
              atBottom: isAtBottomValue,
            }

            const result = autoScrollValue(params)

            if (!result) {
              return null
            }

            if (typeof result === 'object') {
              // Return location object
              const normalizedLocation: FlatIndexLocationWithAlign =
                typeof result === 'number' ? { index: result, align: 'end', behavior: 'auto' } : result
              return normalizedLocation
            }

            if (typeof result === 'number') {
              return { index: result, align: 'end', behavior: 'auto' } as FlatIndexLocationWithAlign
            }

            // Normalize behavior: 'instant' -> 'auto', boolean true -> 'auto'
            if (result === true) {
              behavior = 'auto'
            } else if (result === 'instant') {
              behavior = 'auto'
            } else if (result === 'smooth') {
              behavior = 'smooth'
            } else if (result === 'auto') {
              behavior = 'auto'
            } else {
              // Custom scroll behavior function - default to 'auto'
              behavior = 'auto'
            }
          } else if (autoScrollValue === true) {
            if (!isAtBottomValue) {
              return null
            }
            behavior = 'auto'
          } else if (autoScrollValue === 'smooth') {
            if (!isAtBottomValue) {
              return null
            }
            behavior = 'smooth'
          } else if (autoScrollValue === 'auto') {
            if (!isAtBottomValue) {
              return null
            }
            behavior = 'auto'
          } else {
            // Other cases (shouldn't happen but handle gracefully)
            return null
          }

          return { index: 'LAST', align: 'end', behavior } as FlatIndexLocationWithAlign
        }),
        u.filter((location) => location !== null)
      ),
      (location) => {
        if (location !== null) {
          u.publish(scrollToIndex, location)
        }
      }
    )

    // Items-change handler (mirror message-list Zt signal)
    u.subscribe(
      u.pipe(
        itemsChangeSignal,
        u.map(({ newData }) => newData)
      ),
      (newData) => {
        u.publish(data, newData)
      }
    )

    // Handle autoscroll behavior for items-change
    u.subscribe(
      u.pipe(
        itemsChangeSignal,
        u.withLatestFrom(listScrollLocation, scrollingInProgress),
        u.debounceTime(20), // Mirror message-list debounce
        u.filter(([{ autoscrollToBottomBehavior }, scrollLocation, scrollInProgressValue]) => {
          // Only scroll if at bottom and has behavior
          return scrollLocation.isAtBottom && !!autoscrollToBottomBehavior && !scrollInProgressValue
        }),
        u.map(([{ autoscrollToBottomBehavior }]) => {
          if (typeof autoscrollToBottomBehavior === 'object' && 'location' in autoscrollToBottomBehavior) {
            // Call location callback
            const location = autoscrollToBottomBehavior.location()
            if (location) {
              return location
            }
            return null
          } else {
            // ScrollBehavior - scroll to bottom
            const behavior = autoscrollToBottomBehavior === 'instant' ? 'auto' : autoscrollToBottomBehavior === 'smooth' ? 'smooth' : 'auto'
            return { index: 'LAST', align: 'end', behavior } as FlatIndexLocationWithAlign
          }
        }),
        u.filter((location) => location !== null)
      ),
      (location) => {
        if (location !== null) {
          u.publish(scrollToIndex, location)
        }
      }
    )

    // Handle initial data publish when there's no modifier
    // This ensures data is published immediately, even before withLatestFrom emits
    // CRITICAL: This subscription MUST run to ensure initial data is published when component mounts
    // Without this, items won't render initially when dataWithScrollModifier is provided with no modifier
    u.subscribe(dataWithScrollModifier, (dataWithModifier) => {
      // Skip if null/undefined
      if (dataWithModifier === undefined || dataWithModifier === null) {
        return
      }

      // Handle empty data
      if (!dataWithModifier.data || dataWithModifier.data.length === 0) {
        u.publish(data, [])
        return
      }

      const scrollModifier: ScrollModifier | undefined = dataWithModifier.scrollModifier
      const hasScrollModifierProp = 'scrollModifier' in dataWithModifier
      const shouldPublish = scrollModifier === null || scrollModifier === undefined || !hasScrollModifierProp

      // CRITICAL: If no modifier (null, undefined, or not present), ALWAYS publish data immediately
      // This handles the initial case where dataWithScrollModifier is set with { data: items } and no modifier
      // This must happen synchronously to ensure data is available for rendering
      // Check for both explicit null/undefined and missing property
      if (shouldPublish) {
        u.publish(data, dataWithModifier.data)
      }
      // If there's a modifier, let the main handler below process it
    })

    // Also check the current value when subscription is set up (handles case where value is already set)
    // This is critical for initial render - if dataWithScrollModifier is set before subscription runs
    try {
      const currentValue = u.getValue(dataWithScrollModifier)
      if (currentValue?.data) {
        const hasModifier =
          'scrollModifier' in currentValue && currentValue.scrollModifier !== null && currentValue.scrollModifier !== undefined
        if (!hasModifier) {
          u.publish(data, currentValue.data)
        }
      }
    } catch {
      // If getValue fails (stream not initialized), that's ok - subscription will handle it
    }

    // Main handler that processes DataWithScrollModifier and routes to appropriate signals
    // Mirrors message-list implementation (lines 1471-1551)
    u.subscribe(u.pipe(dataWithScrollModifier, u.withLatestFrom(data, itemIdentity)), ([dataWithModifier, currentData, identityFn]) => {
      if (dataWithModifier === undefined || dataWithModifier === null) {
        return
      }

      if (!dataWithModifier.data || dataWithModifier.data.length === 0) {
        u.publish(data, [])
        return
      }

      const newData = dataWithModifier.data
      const scrollModifier: ScrollModifier | undefined = dataWithModifier.scrollModifier

      // Handle prepend modifier
      if (scrollModifier === ScrollModifierOption.prepend) {
        if (currentData === null || currentData === undefined || currentData.length === 0) {
          u.publish(data, newData)
          return
        }

        // Find first old item in new data using itemIdentity
        const firstOldItem = currentData[0]
        const matchIndex = newData.findIndex((item) => identityFn(item) === identityFn(firstOldItem))

        if (matchIndex === -1) {
          // First old item not found, treat entire new data as prepended
          u.publish(data, [])
          u.publish(prependSignal, newData)
        } else {
          // Split data: prepended part and remaining part
          const prependedPart = newData.slice(0, matchIndex)
          const remainingPart = newData.slice(matchIndex)

          u.publish(data, remainingPart)
          u.publish(prependSignal, prependedPart)
        }
        return
      }

      // Handle remove-from-start modifier
      if (scrollModifier === ScrollModifierOption.removeFromStart) {
        if (currentData === null || currentData === undefined || currentData.length === 0) {
          u.publish(data, newData)
          return
        }

        // Find first new item in old data using itemIdentity
        const firstNewItem = newData[0]
        const matchIndex = currentData.findIndex((item) => identityFn(item) === identityFn(firstNewItem))

        if (matchIndex === -1) {
          // First new item not found, just update data
          u.publish(data, newData)
          return
        }

        // Calculate height of removed items and scroll
        const removedCount = matchIndex
        const gapValue = u.getValue(gap)
        const currentSizes = u.getValue(sizes)
        const removedHeight = offsetOf(removedCount, currentSizes.offsetTree, gapValue)

        // Scroll by negative height
        u.publish(scrollBy, { top: -removedHeight, behavior: 'auto' })

        // Update data and size tree in microtask (mirror message-list timing)
        queueMicrotask(() => {
          u.publish(data, newData)

          // Update size tree by shifting indices down (subtract count from all indices >= removedCount)
          const currentSizesAfter = u.getValue(sizes)
          const shiftedRanges: SizeRange[] = []
          const sizeTreeRanges = walk(currentSizesAfter.sizeTree)

          let shiftedTree = newTree<number>()
          for (const { k: startIndex, v: size } of sizeTreeRanges) {
            if (startIndex >= removedCount) {
              const newIndex = Math.max(0, startIndex - removedCount)
              shiftedTree = insert(shiftedTree, newIndex, size)
            }
          }

          // Convert back to ranges
          const shiftedTreeRanges = walk(shiftedTree)
          for (let i = 0; i < shiftedTreeRanges.length; i++) {
            const { k: startIndex, v: size } = shiftedTreeRanges[i]
            const nextRange = shiftedTreeRanges[i + 1]
            shiftedRanges.push({
              startIndex,
              endIndex: nextRange ? nextRange.k - 1 : Infinity,
              size,
            })
          }

          u.publish(sizeRanges, shiftedRanges)
        })

        return
      }

      // Handle remove-from-end modifier
      if (scrollModifier === ScrollModifierOption.removeFromEnd) {
        u.publish(data, newData)

        // Update size ranges to mark removed items as default size
        const defaultSize = u.getValue(defaultItemSize) ?? 0
        if (defaultSize > 0 && newData.length > 0) {
          u.publish(sizeRanges, [
            {
              size: defaultSize,
              startIndex: newData.length,
              endIndex: Infinity,
            },
          ])
        }

        return
      }

      // Handle item-location modifier
      if (scrollModifier && typeof scrollModifier === 'object' && scrollModifier.type === 'item-location') {
        const { location, purgeItemSizes } = scrollModifier

        // If purgeItemSizes or empty data, reset size tree and set data
        if (purgeItemSizes || currentData === null || currentData === undefined || currentData.length === 0) {
          if (purgeItemSizes) {
            // Reset size tree by publishing empty ranges
            u.publish(sizeRanges, [])
          }

          // Set data and scroll to location
          u.publish(data, newData)

          // Scroll to location after render
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const normalizedLocation: FlatIndexLocationWithAlign = typeof location === 'number' ? { index: location } : location
              u.publish(scrollToIndex, normalizedLocation)
            })
          })

          return
        }

        // Otherwise, store data temporarily and wait for render
        // For now, we'll set data and scroll immediately
        // In a full implementation, we'd store data temporarily and wait for listRefresh
        u.publish(data, newData)

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const normalizedLocation: FlatIndexLocationWithAlign = typeof location === 'number' ? { index: location } : location
            u.publish(scrollToIndex, normalizedLocation)
          })
        })

        return
      }

      // Handle auto-scroll-to-bottom modifier
      if (scrollModifier && typeof scrollModifier === 'object' && scrollModifier.type === 'auto-scroll-to-bottom') {
        u.publish(data, newData)
        u.publish(autoScrollToBottomSignal, {
          data: newData,
          autoScroll: scrollModifier.autoScroll,
        })
        return
      }

      // Handle items-change modifier
      if (scrollModifier && typeof scrollModifier === 'object' && scrollModifier.type === 'items-change') {
        // Publish data immediately (subscriptions are async, so this ensures data is available)
        u.publish(data, newData)
        // Also publish to signal for scroll behavior handling
        u.publish(itemsChangeSignal, {
          newData,
          autoscrollToBottomBehavior: scrollModifier.behavior,
        })
        return
      }

      // No modifier or null/undefined - ALWAYS publish data
      // This mirrors message-list line 1550: e.pub(k, l)
      // This is the fallback that ensures data is always published when there's no modifier
      // The initial subscription above handles the case before withLatestFrom emits,
      // but this ensures data is published even after withLatestFrom has emitted
      u.publish(data, newData)
    })

    return {
      dataWithScrollModifier,
      itemIdentity,
      listScrollLocation,
      atBottomState,
      context,
    }
  },
  u.tup(sizeSystem, domIOSystem, scrollToIndexSystem)
)
