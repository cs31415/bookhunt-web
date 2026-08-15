import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessagesPage } from './MessagesPage';
import { AuthProvider } from '../auth/AuthContext';
import { ApiError } from '../../api/client';
import {
  getConversation,
  getConversations,
  markConversationRead,
  postMessage,
} from '../../api/messages/messages';

vi.mock('../../api/messages/messages');

const mockedConversations = vi.mocked(getConversations);
const mockedConversation = vi.mocked(getConversation);
const mockedPost = vi.mocked(postMessage);
const mockedRead = vi.mocked(markConversationRead);

function renderMessages(path = '/messages') {
  const router = createMemoryRouter(
    [
      { path: '/messages', element: <MessagesPage /> },
      { path: '/messages/:handle', element: <MessagesPage /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.setItem(
    'bookhunt_user',
    JSON.stringify({ id: 1, email: 'a@b.com', displayName: 'Ada', handle: 'ada' }),
  );
  mockedConversations.mockReset();
  mockedConversation.mockReset();
  mockedPost.mockReset();
  mockedRead.mockReset();

  mockedConversations.mockResolvedValue({
    conversations: [
      {
        handle: 'bob',
        displayName: 'Bob',
        lastMessage: { body: 'hello there', at: '2026-01-01', fromMe: false },
        unreadCount: 2,
      },
    ],
  });
  mockedConversation.mockResolvedValue({
    messages: [
      { id: 1, body: 'hello there', createdAt: '2026-01-01', fromMe: false },
      { id: 2, body: 'hi back', createdAt: '2026-01-02', fromMe: true },
    ],
    total: 2,
    page: 1,
    pageSize: 50,
  });
  mockedRead.mockResolvedValue({ marked: 2 });
});

afterEach(() => localStorage.clear());

describe('the conversation list', () => {
  it('lists threads with their unread count', async () => {
    renderMessages();

    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.getByLabelText('2 unread')).toBeInTheDocument();
  });

  it('explains how to start one when there are none', async () => {
    mockedConversations.mockResolvedValue({ conversations: [] });
    renderMessages();

    expect(await screen.findByText(/favourited you back/)).toBeInTheDocument();
  });
});

describe('a thread', () => {
  it('shows both sides', async () => {
    renderMessages('/messages/bob');

    expect(await screen.findByText('hello there')).toBeInTheDocument();
    expect(screen.getByText('hi back')).toBeInTheDocument();
  });

  it('marks it read on open, which is what clears the badge', async () => {
    renderMessages('/messages/bob');

    await screen.findByText('hello there');
    await waitFor(() => expect(mockedRead).toHaveBeenCalledWith('bob'));
  });

  it('appends a sent message and clears the box', async () => {
    mockedPost.mockResolvedValue({
      message: { id: 3, body: 'new one', createdAt: '2026-01-03', fromMe: true },
    });

    renderMessages('/messages/bob');
    await screen.findByText('hello there');

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'new one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('new one')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toHaveValue('');
  });

  it('keeps a refused message in the box, with the reason inline', async () => {
    // The reader has to edit this text. A toast would take the reason away
    // after eight seconds, and clearing the box would take the words too.
    mockedPost.mockRejectedValue(
      new ApiError(422, 'This message was not sent. Please rephrase it.', 'MESSAGE_REJECTED'),
    );

    renderMessages('/messages/bob');
    await screen.findByText('hello there');

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'something rude' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('was not sent');
    expect(screen.getByLabelText('Message')).toHaveValue('something rude');
  });

  it('explains a lost mutual favourite rather than failing generically', async () => {
    mockedPost.mockRejectedValue(
      new ApiError(
        403,
        'You can only message readers who have favourited you back.',
        'NOT_MUTUAL_FAVORITE',
      ),
    );

    renderMessages('/messages/bob');
    await screen.findByText('hello there');

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'hello?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('favourited you back');
  });

  it('sends nothing for an empty draft', async () => {
    renderMessages('/messages/bob');
    await screen.findByText('hello there');

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(mockedPost).not.toHaveBeenCalled();
  });
});
