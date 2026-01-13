import * as React from 'react'
import { useState, useCallback } from 'react'

import { Virtuoso } from '../src'

interface Message {
  id: number
  text: string
  timestamp: Date
}

export function Example() {
  const [messages, setMessages] = useState<Message[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      text: `Message ${i + 1}`,
      timestamp: new Date(Date.now() - (10 - i) * 60000),
    }))
  )

  const [scrollModifier, setScrollModifier] = React.useState<'auto' | 'smooth' | null>(null)

  const addMessage = useCallback(() => {
    const newMessage: Message = {
      id: messages.length + 1,
      text: `New message ${messages.length + 1}`,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, newMessage])
    setScrollModifier('auto')
  }, [messages.length])

  const addMessageSmooth = useCallback(() => {
    const newMessage: Message = {
      id: messages.length + 1,
      text: `New message ${messages.length + 1}`,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, newMessage])
    setScrollModifier('smooth')
  }, [messages.length])

  const dataWithScrollModifier = React.useMemo(() => {
    if (scrollModifier === null) {
      return { data: messages }
    }
    return {
      data: messages,
      scrollModifier: {
        type: 'auto-scroll-to-bottom' as const,
        autoScroll: scrollModifier === 'smooth' ? ('smooth' as const) : true,
      },
    }
  }, [messages, scrollModifier])

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={addMessage}>Add Message (auto scroll)</button>
        <button onClick={addMessageSmooth} style={{ marginLeft: '0.5rem' }}>
          Add Message (smooth scroll)
        </button>
        <p style={{ fontSize: '0.875rem', color: '#666' }}>
          Add messages to the list. The list should automatically scroll to the bottom when new messages arrive.
        </p>
      </div>
      <Virtuoso
        style={{ height: 400 }}
        dataWithScrollModifier={dataWithScrollModifier}
        itemIdentity={(item) => item.id}
        itemContent={(_, message) => (
          <div style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
            <div style={{ fontWeight: 'bold' }}>{message.text}</div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>{message.timestamp.toLocaleTimeString()}</div>
          </div>
        )}
      />
    </div>
  )
}
