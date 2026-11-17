import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockUseAuth = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../components/Navbar', () => ({
  default: () => React.createElement('nav', null, 'Navbar'),
}));

vi.mock('../components/Sidebar', () => ({
  default: () => React.createElement('aside', null, 'Sidebar'),
}));

import Layout from '../components/Layout';
import PrivateRoute from '../components/PrivateRoute';
import Login from '../pages/Login';

describe('Authentication Routing & Blank Screen Prevention', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('renders a loading spinner in Layout while auth state is initializing', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: true,
      error: null,
    });

    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/dashboard'] },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            { element: React.createElement(Layout) },
            React.createElement(Route, {
              path: '/dashboard',
              element: React.createElement('div', null, 'Dashboard'),
            })
          )
        )
      )
    );

    expect(html).toContain('animate-spin');
    expect(html).not.toBe('');
  });

  it('does NOT render a blank screen when unauthenticated; Layout returns Navigate to /login', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });

    const element = Layout();
    expect(element).not.toBeNull();
    expect(element.props.to).toBe('/login');
    expect(element.props.replace).toBe(true);
  });

  it('PrivateRoute redirects unauthenticated users to /login with replace=true', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });

    const element = PrivateRoute({ children: React.createElement('div', null, 'Protected') });
    expect(element).not.toBeNull();
    expect(element.props.to).toBe('/login');
    expect(element.props.replace).toBe(true);
  });

  it('renders the Login page with Google Sign-In button and displays auth errors', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: 'Authentication failed. Please try signing in again.',
      login: vi.fn(),
    });

    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/login'] },
        React.createElement(Login)
      )
    );

    expect(html).toContain('Welcome to Mini CRM');
    expect(html).toContain('Sign in with Google');
    expect(html).toContain('Authentication failed. Please try signing in again.');
  });
});
