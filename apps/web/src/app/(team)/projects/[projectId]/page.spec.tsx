import { describe, expect, it, vi } from 'vitest';

const redirect = vi.fn((): never => {
  throw new Error('NEXT_REDIRECT');
});
vi.mock('next/navigation.js', () => ({ redirect }));

const { default: ProjectPage } = await import('./page.js');

describe('ProjectPage', () => {
  it('shows the home page until the project home view exists', () => {
    expect(() => ProjectPage()).toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/');
  });
});
