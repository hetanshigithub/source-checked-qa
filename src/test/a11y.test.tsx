import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { ApiProvider } from '../api/context'
import { createDemoApi } from '../demo/engine'
import { sampleTexts } from '../demo/samples'

// Colour contrast needs real layout and styles, which jsdom does not have. The palette's
// text colours are checked separately (all pairs are at least 4.5:1).
async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  })
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const user = userEvent.setup()
  const view = render(
    <QueryClientProvider client={client}>
      <ApiProvider api={createDemoApi(sampleTexts)}>
        <App />
      </ApiProvider>
    </QueryClientProvider>,
  )
  return { user, ...view }
}

describe('accessibility (axe)', () => {
  it('has no violations before a question is asked', async () => {
    const { container } = setup()
    await screen.findByText('ai_in_finance.txt')
    expect(await violations(container)).toEqual([])
  })

  it('has no violations with an answer, source passage and inspector', async () => {
    const { container, user } = setup()
    await user.type(screen.getByLabelText('Your question'), 'What is recall at k?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    await screen.findByRole('heading', { name: 'Answer' })
    expect(await violations(container)).toEqual([])
  })

  it('has no violations in the weak-match state', async () => {
    const { container, user } = setup()
    await user.type(screen.getByLabelText('Your question'), 'What is the capital city of Australia?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    await user.click(await screen.findByRole('button', { name: 'Show the closest statements anyway' }))
    expect(await violations(container)).toEqual([])
  })
})
