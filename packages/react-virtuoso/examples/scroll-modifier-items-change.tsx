import * as React from 'react'
import { useState, useCallback } from 'react'

import { Virtuoso } from '../src'

interface Item {
  id: number
  name: string
  status: 'active' | 'inactive'
}

export function Example() {
  const [items, setItems] = useState<Item[]>(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      status: i % 2 === 0 ? 'active' : ('inactive' as const),
    }))
  )

  const [useScrollModifier, setUseScrollModifier] = React.useState(false)

  const filterActive = useCallback(() => {
    const filtered = items.filter((item) => item.status === 'active')
    setItems(filtered)
    setUseScrollModifier(true)
  }, [items])

  const filterInactive = useCallback(() => {
    const filtered = items.filter((item) => item.status === 'inactive')
    setItems(filtered)
    setUseScrollModifier(true)
  }, [items])

  const reset = useCallback(() => {
    setItems(
      Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        status: i % 2 === 0 ? 'active' : ('inactive' as const),
      }))
    )
    setUseScrollModifier(true)
  }, [])

  const dataWithScrollModifier = React.useMemo(() => {
    if (!useScrollModifier) {
      return { data: items }
    }
    return {
      data: items,
      scrollModifier: {
        type: 'items-change' as const,
        behavior: 'auto' as const,
      },
    }
  }, [items, useScrollModifier])

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={filterActive}>Show Active Only</button>
        <button onClick={filterInactive} style={{ marginLeft: '0.5rem' }}>
          Show Inactive Only
        </button>
        <button onClick={reset} style={{ marginLeft: '0.5rem' }}>
          Reset
        </button>
        <p style={{ fontSize: '0.875rem', color: '#666' }}>
          Filter items and observe scroll position behavior. If you&apos;re at the bottom, it should stay at the bottom.
        </p>
      </div>
      <Virtuoso
        style={{ height: 400 }}
        dataWithScrollModifier={dataWithScrollModifier}
        itemIdentity={(item) => item.id}
        itemContent={(_, item) => (
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid #eee',
              backgroundColor: item.status === 'active' ? '#e8f5e9' : '#fff3e0',
            }}
          >
            {item.name} ({item.status})
          </div>
        )}
      />
    </div>
  )
}
