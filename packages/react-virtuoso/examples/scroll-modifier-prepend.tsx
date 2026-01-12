import * as React from 'react'
import { useState, useCallback } from 'react'

import { Virtuoso } from '../src'

interface Item {
  id: number
  text: string
}

export function Example() {
  const [items, setItems] = useState<Item[]>(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      text: `Item ${i + 1}`,
    }))
  )
  const [scrollModifier, setScrollModifier] = React.useState<'prepend' | null>(null)

  const prependItems = useCallback(() => {
    const newItems: Item[] = Array.from({ length: 5 }, (_, i) => ({
      id: items[0].id - 5 + i,
      text: `New Item ${items[0].id - 5 + i}`,
    }))

    setItems((prev) => [...newItems, ...prev])
    setScrollModifier('prepend')
  }, [items])

  const dataWithScrollModifier = React.useMemo(() => {
    if (scrollModifier === 'prepend') {
      return {
        data: items,
        scrollModifier: 'prepend' as const,
      }
    }
    return { data: items }
  }, [items, scrollModifier])

  // Reset modifier after it's been used
  React.useEffect(() => {
    if (scrollModifier !== null) {
      setScrollModifier(null)
    }
  }, [items, scrollModifier])

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={prependItems}>Prepend 5 Items</button>
        <p style={{ fontSize: '0.875rem', color: '#666' }}>
          Click the button to prepend items. The scroll position should be preserved.
        </p>
      </div>
      <Virtuoso
        style={{ height: 400 }}
        dataWithScrollModifier={dataWithScrollModifier}
        itemIdentity={(item) => item.id}
        itemContent={(_, item) => (
          <div style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
            {item.text}
          </div>
        )}
      />
    </div>
  )
}
