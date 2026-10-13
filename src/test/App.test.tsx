import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { ApiProvider } from '../api/context'
import { ApiError } from '../api/types'
import type { Api } from '../api/types'
import { createDemoApi } from '../demo/engine'
import { sampleTexts } from '../demo/samples'

function renderApp(api: Api = createDemoApi(sampleTexts)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const user = userEvent.setup({ applyAccept: false })
  const view = render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <App />
      </ApiProvider>
    </QueryClientProvider>,
  )
  return { api, user, ...view }
}

async function ask(user: ReturnType<typeof userEvent.setup>, question: string) {
  await user.type(screen.getByLabelText('Your question'), question)
  await user.click(screen.getByRole('button', { name: 'Ask' }))
}

const marks = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('mark.cite')]

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('asking a question', () => {
  it('keeps Ask disabled until the question has at least three characters', async () => {
    const { user } = renderApp()
    const button = screen.getByRole('button', { name: 'Ask' })
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText('Your question'), 'ab')
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText('Your question'), 'c')
    expect(button).toBeEnabled()
  })

  it('shows numbered statements, a confidence meter and the source passage with marks', async () => {
    const { user, container } = renderApp()
    await ask(user, 'Why can an inner-product index be used for cosine similarity?')

    const heading = await screen.findByRole('heading', { name: 'Answer' })
    expect(heading).toHaveFocus()

    const statements = screen.getAllByRole('button', { name: /^Statement \d/ })
    expect(statements.length).toBeGreaterThanOrEqual(2)
    expect(statements[0]).toHaveAccessibleName(/vector_search_and_faiss\.txt/)

    const meter = screen.getByRole('meter', { name: 'Match confidence' })
    expect(meter).toHaveAttribute('aria-valuetext', expect.stringMatching(/above the 30% line/))

    const source = screen.getByRole('complementary', { name: 'Source passage' })
    expect(within(source).getByText('vector_search_and_faiss.txt')).toBeInTheDocument()
    expect(marks(container).length).toBe(statements.length)
    // The first statement is selected: exactly one mark is the active one.
    expect(marks(container).filter((m) => m.dataset.active === 'true')).toHaveLength(1)
  })

  it('moves the active mark to the statement you select', async () => {
    const { user, container } = renderApp()
    await ask(user, 'Why can an inner-product index be used for cosine similarity?')
    const statements = await screen.findAllByRole('button', { name: /^Statement \d/ })

    await user.click(statements[2])

    expect(statements[2]).toHaveAttribute('aria-pressed', 'true')
    expect(statements[0]).toHaveAttribute('aria-pressed', 'false')
    const active = marks(container).find((m) => m.dataset.active === 'true')!
    const statementText = statements[2].querySelector('.reading')!.textContent!
    expect(statementText.startsWith(active.textContent!)).toBe(true)
  })

  it('answers straight away from a link with ?q= and ?k=', async () => {
    window.history.replaceState(null, '', '/?q=What%20is%20recall%20at%20k%3F&k=3')
    const api = createDemoApi(sampleTexts)
    const spy = vi.spyOn(api, 'query')
    renderApp(api)

    await screen.findByRole('heading', { name: 'Answer' })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('What is recall at k?', 3)
    expect(screen.getByLabelText('Your question')).toHaveValue('What is recall at k?')
  })

  it('writes the question into the address so it can be shared', async () => {
    const { user } = renderApp()
    await ask(user, 'What is recall at k?')
    await screen.findByRole('heading', { name: 'Answer' })
    expect(new URLSearchParams(window.location.search).get('q')).toBe('What is recall at k?')
  })
})

describe('when the documents do not answer', () => {
  it('says so, hides the statements and marks nothing until asked', async () => {
    const { user, container } = renderApp()
    await ask(user, 'What is the capital city of Australia?')

    expect(await screen.findByRole('heading', { name: /don’t clearly answer this/ })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^Statement \d/ })).toHaveLength(0)
    expect(marks(container)).toHaveLength(0)
    expect(screen.getByRole('meter', { name: 'Match confidence' })).toHaveAttribute(
      'aria-valuetext',
      expect.stringMatching(/below the 30% line/),
    )
    // The inspector still shows what was retrieved.
    expect(screen.getByRole('table', { name: /Passages retrieved/ })).toBeInTheDocument()
  })

  it('shows the closest statements only when asked', async () => {
    const { user, container } = renderApp()
    await ask(user, 'What is the capital city of Australia?')
    await user.click(await screen.findByRole('button', { name: 'Show the closest statements anyway' }))

    expect(screen.getAllByRole('button', { name: /^Statement \d/ }).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: /^Read passage/ })[0])
    expect(marks(container).length).toBeGreaterThan(0)
  })
})

describe('retrieval inspector', () => {
  it('lists every retrieved passage and opens the one you choose', async () => {
    const { user } = renderApp()
    await ask(user, 'What is recall at k?')
    await screen.findByRole('heading', { name: 'Answer' })

    const table = screen.getByRole('table', { name: /Passages retrieved/ })
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 4)

    const readButtons = within(table).getAllByRole('button', { name: /^Read passage/ })
    await user.click(readButtons[1])
    expect(readButtons[1]).toHaveAttribute('aria-pressed', 'true')
    const source = screen.getByRole('complementary', { name: 'Source passage' })
    expect(source).toHaveTextContent(/retrieved at rank 2/)
  })
})

describe('errors', () => {
  it('explains a failed question and lets you retry', async () => {
    const api = createDemoApi(sampleTexts)
    const real = api.query.bind(api)
    vi.spyOn(api, 'query').mockRejectedValueOnce(new ApiError(503, 'Index is not ready yet.')).mockImplementation(real)
    const { user } = renderApp(api)

    await ask(user, 'What is recall at k?')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('That question couldn’t be answered')
    expect(alert).toHaveTextContent('Index is not ready yet.')

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Answer' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('tells you when the API cannot be reached and how to fix it', async () => {
    const api = createDemoApi(sampleTexts)
    vi.spyOn(api, 'getIndex').mockRejectedValue(new ApiError(0, "Can't reach the API at http://localhost:8000."))
    renderApp(api)

    const alert = await screen.findByText('Can’t reach the API')
    expect(alert.closest('[role=alert]')).toHaveTextContent('docker compose up')
    expect(screen.getByText('Not connected')).toBeInTheDocument()
  })
})

describe('documents', () => {
  const file = (name: string, text: string) => new File([text], name, { type: 'text/plain' })
  const NOTE = 'Quarterly reports should be archived for seven years. The archive must live in a separate region.'

  it('lists the sample documents', async () => {
    renderApp()
    expect(await screen.findByText('ai_in_finance.txt')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument()
  })

  it('adds an uploaded document to the list', async () => {
    const { user } = renderApp()
    await screen.findByText('ai_in_finance.txt')
    await user.upload(screen.getByLabelText(/Add a document/), file('retention.txt', NOTE))

    expect(await screen.findByText('Added retention.txt: 1 passage.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove retention.txt' })).toBeInTheDocument()
  })

  it('shows the reason an upload was refused', async () => {
    const { user } = renderApp()
    await screen.findByText('ai_in_finance.txt')
    await user.upload(screen.getByLabelText(/Add a document/), file('notes.docx', 'x'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Only .txt and .pdf files')
  })

  it('asks before removing, and keeps the document if you back out', async () => {
    const { user } = renderApp()
    await screen.findByText('ai_in_finance.txt')
    await user.upload(screen.getByLabelText(/Add a document/), file('retention.txt', NOTE))
    await user.click(await screen.findByRole('button', { name: 'Remove retention.txt' }))

    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.getByText('retention.txt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove retention.txt' }))
    await user.click(screen.getByRole('button', { name: 'Remove retention.txt' }))
    await waitFor(() => expect(screen.queryByText('retention.txt')).not.toBeInTheDocument())
  })

  it('warns that an answer is out of date after the documents change', async () => {
    const { user } = renderApp()
    await ask(user, 'What is recall at k?')
    await screen.findByRole('heading', { name: 'Answer' })
    expect(screen.queryByText(/Your documents changed/)).not.toBeInTheDocument()

    await user.upload(screen.getByLabelText(/Add a document/), file('retention.txt', NOTE))
    expect(await screen.findByText(/Your documents changed after this answer/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ask again' }))
    await waitFor(() => expect(screen.queryByText(/Your documents changed/)).not.toBeInTheDocument())
  })
})
