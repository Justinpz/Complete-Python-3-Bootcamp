// Hand-rolled hash router — 8 flat routes, so no library needed. Hash URLs
// survive file:// and any static host with zero config.

import { useSyncExternalStore } from 'react';

// '#/project/abc' -> { name: 'project', param: 'abc' }
export function parseHash(hash = window.location.hash) {
  const path = hash.replace(/^#\/?/, '');
  const [name, param = null] = path.split('/');
  switch (name) {
    case 'today':
    case 'upcoming':
    case 'completed':
    case 'stats':
      return { name, param: null };
    case 'project':
    case 'label':
    case 'filter':
      return param ? { name, param } : { name: 'project', param: 'inbox' };
    default:
      return { name: 'project', param: 'inbox' };
  }
}

function subscribe(cb) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useHashRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseHash(hash);
}

export function navigate(path) {
  window.location.hash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
}

export function routeFor(route) {
  return route.param ? `#/${route.name}/${route.param}` : `#/${route.name}`;
}
