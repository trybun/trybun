// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignOutButton } from './sign-out-button.js';

const signOut = vi.hoisted(() => vi.fn());
vi.mock('next-auth/react', () => ({ signOut }));

afterEach(() => {
  cleanup();
  signOut.mockReset();
});

describe('SignOutButton', () => {
  it('is the main button by default', () => {
    render(<SignOutButton label="Sign out" />);

    const button = screen.getByRole('button', { name: 'Sign out' });
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('h-11');
  });

  it('is a secondary button with the outline variant (#384)', () => {
    render(<SignOutButton label="Wyloguj się" variant="outline" />);

    const { className } = screen.getByRole('button', { name: 'Wyloguj się' });
    expect(className).toContain('border-border');
    expect(className).not.toContain('bg-primary');
    // The touch target of every button (Rule 9).
    expect(className).toContain('h-11');
  });

  it('ends the session and returns to the start page', async () => {
    render(<SignOutButton label="Sign out" variant="outline" />);

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' }));
  });
});
