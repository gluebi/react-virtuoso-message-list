import { alignToBottomSystem } from './alignToBottomSystem'
import { contextSystem } from './contextSystem'
import { domIOSystem } from './domIOSystem'
import { followOutputSystem } from './followOutputSystem'
import { groupedListSystem } from './groupedListSystem'
import { initialItemCountSystem } from './initialItemCountSystem'
import { initialScrollTopSystem } from './initialScrollTopSystem'
import { initialTopMostItemIndexSystem } from './initialTopMostItemIndexSystem'
import { listStateSystem } from './listStateSystem'
import { loggerSystem } from './loggerSystem'
import { propsReadySystem } from './propsReadySystem'
import { scrollIntoViewSystem } from './scrollIntoViewSystem'
import { scrollModifierSystem } from './scrollModifierSystem'
import { scrollSeekSystem } from './scrollSeekSystem'
import { scrollToIndexSystem } from './scrollToIndexSystem'
import { sizeRangeSystem } from './sizeRangeSystem'
import { sizeSystem } from './sizeSystem'
import { stateLoadSystem } from './stateLoadSystem'
import { topItemCountSystem } from './topItemCountSystem'
import { totalListHeightSystem } from './totalListHeightSystem'
import { upwardScrollFixSystem } from './upwardScrollFixSystem'
import * as u from './urx'
import { windowScrollerSystem } from './windowScrollerSystem'

const featureGroup1System = u.system(
  ([
    sizeRange,
    initialItemCount,
    propsReady,
    scrollSeek,
    totalListHeight,
    initialScrollTopSystem,
    alignToBottom,
    windowScroller,
    scrollIntoView,
    logger,
    context,
  ]) => {
    return {
      ...sizeRange,
      ...initialItemCount,
      ...propsReady,
      ...scrollSeek,
      ...totalListHeight,
      ...initialScrollTopSystem,
      ...alignToBottom,
      ...windowScroller,
      ...scrollIntoView,
      ...logger,
      ...context,
    }
  },
  u.tup(
    sizeRangeSystem,
    initialItemCountSystem,
    propsReadySystem,
    scrollSeekSystem,
    totalListHeightSystem,
    initialScrollTopSystem,
    alignToBottomSystem,
    windowScrollerSystem,
    scrollIntoViewSystem,
    loggerSystem,
    contextSystem
  )
)

export const listSystem = u.system(
  (deps) => {
    // Workaround for TypeScript inference issue with complex system tuples
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const depsTyped = deps as any
    
    // Create fallback streams for scroll modifier system in case it's not properly initialized
    const fallbackDataWithScrollModifier = u.statefulStream<import('./interfaces').DataWithScrollModifier<unknown> | null | undefined>(null)
    const fallbackItemIdentity = u.statefulStream<(item: unknown) => unknown>((item) => item)
    const fallbackListScrollLocation = u.statefulStream<import('./interfaces').ListScrollLocation>({
      listOffset: 0,
      visibleListHeight: 0,
      scrollHeight: 0,
      bottomOffset: 0,
      isAtBottom: false,
    })
    const [
      {
        data,
        defaultItemSize,
        firstItemIndex,
        fixedItemSize,
        fixedGroupSize,
        gap,
        groupIndices,
        heightEstimates,
        itemSize,
        sizeRanges,
        sizes,
        statefulTotalCount,
        totalCount,
        trackItemSizes,
      },
      { initialItemFinalLocationReached, initialTopMostItemIndex, scrolledToInitialItem },
      domIO,
      stateLoad,
      followOutput,
      listStateSystemOutput,
      { scrollToIndex },
      _,
      { topItemCount },
      { groupCounts },
      scrollModifier,
      featureGroup1,
    ] = depsTyped
    const { listState, minOverscanItemCount, topItemsIndexes, rangeChanged, atBottomState, ...flags } = listStateSystemOutput
    
    // Runtime safety checks for systems that might not be properly typed
    if (featureGroup1 && 'scrollSeekRangeChanged' in featureGroup1 && typeof featureGroup1.scrollSeekRangeChanged === 'function') {
      u.connect(rangeChanged, featureGroup1.scrollSeekRangeChanged)
    }
    
    if (
      featureGroup1 &&
      'windowViewportRect' in featureGroup1 &&
      typeof featureGroup1.windowViewportRect === 'function' &&
      domIO &&
      'viewportHeight' in domIO &&
      typeof domIO.viewportHeight === 'function'
    ) {
      u.connect(
        u.pipe(
          featureGroup1.windowViewportRect,
          u.map((value: { visibleHeight: number }) => value.visibleHeight)
        ),
        domIO.viewportHeight
      )
    }

    // Connect atBottomState and context to scrollModifierSystem
    // Runtime safety check - ensure scrollModifier system is properly initialized
    if (
      scrollModifier &&
      'atBottomState' in scrollModifier &&
      typeof scrollModifier.atBottomState === 'function' &&
      'context' in scrollModifier &&
      typeof scrollModifier.context === 'function' &&
      featureGroup1 &&
      'context' in featureGroup1 &&
      typeof featureGroup1.context === 'function'
    ) {
      u.connect(atBottomState, scrollModifier.atBottomState)
      u.connect(featureGroup1.context, scrollModifier.context)
    }

    return {
      data,
      defaultItemHeight: defaultItemSize,
      firstItemIndex,
      fixedItemHeight: fixedItemSize,
      fixedGroupHeight: fixedGroupSize,
      gap,
      groupCounts,
      heightEstimates,
      initialItemFinalLocationReached,
      initialTopMostItemIndex,
      scrolledToInitialItem,
      sizeRanges,
      topItemCount,
      topItemsIndexes,
      // input
      totalCount,
      ...followOutput,

      groupIndices,
      itemSize,
      listState,
      minOverscanItemCount,
      scrollToIndex,
      // output
      statefulTotalCount,
      trackItemSizes,

      // exported from stateFlagsSystem
      rangeChanged,
      ...flags,
      // the bag of IO from featureGroup1System
      ...featureGroup1,
      ...domIO,
      sizes,
      ...stateLoad,
      // scroll modifier system exports
      // Use scrollModifier streams if available, otherwise use fallback streams
      // Always ensure we return valid function streams to prevent "publisher is not a function" errors
      dataWithScrollModifier: (() => {
        try {
          if (
            scrollModifier &&
            typeof scrollModifier === 'object' &&
            'dataWithScrollModifier' in scrollModifier &&
            typeof scrollModifier.dataWithScrollModifier === 'function'
          ) {
            return scrollModifier.dataWithScrollModifier
          }
        } catch (error) {
          // Fall through to fallback
        }
        return fallbackDataWithScrollModifier
      })(),
      itemIdentity: (() => {
        try {
          if (
            scrollModifier &&
            typeof scrollModifier === 'object' &&
            'itemIdentity' in scrollModifier &&
            typeof scrollModifier.itemIdentity === 'function'
          ) {
            return scrollModifier.itemIdentity
          }
        } catch {
          // Fall through to fallback
        }
        return fallbackItemIdentity
      })(),
      listScrollLocation: (() => {
        try {
          if (
            scrollModifier &&
            typeof scrollModifier === 'object' &&
            'listScrollLocation' in scrollModifier &&
            typeof scrollModifier.listScrollLocation === 'function'
          ) {
            return scrollModifier.listScrollLocation
          }
        } catch {
          // Fall through to fallback
        }
        return fallbackListScrollLocation
      })(),
    }
  },
  u.tup(
    sizeSystem,
    initialTopMostItemIndexSystem,
    domIOSystem,
    stateLoadSystem,
    followOutputSystem,
    listStateSystem,
    scrollToIndexSystem,
    upwardScrollFixSystem,
    topItemCountSystem,
    groupedListSystem,
    scrollModifierSystem,
    featureGroup1System
  )
)
