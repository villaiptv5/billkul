import { createContext, useContext } from 'react';
import type { DocType } from '../data/types';

/** Where the desktop layout is. It is mirrored in the address after "#", so Back, Forward and Reload work. */
export type Route =
  | { page: 'home' }
  | { page: 'documents'; type: DocType }
  | { page: 'cash' }
  | { page: 'sales' }
  | { page: 'customers' }
  | { page: 'items' }
  | { page: 'settings' }
  | { page: 'editor'; docId: string };

export function toHash(route: Route): string {
  switch (route.page) {
    case 'documents':
      return `#/documents/${route.type}`;
    case 'editor':
      return `#/doc/${encodeURIComponent(route.docId)}`;
    default:
      return `#/${route.page}`;
  }
}

export function fromHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'documents':
      return { page: 'documents', type: parts[1] === 'invoice' ? 'invoice' : 'quote' };
    case 'doc':
      return parts[1] ? { page: 'editor', docId: decodeURIComponent(parts[1]) } : { page: 'documents', type: 'quote' };
    case 'cash':
      return { page: 'cash' };
    case 'sales':
      return { page: 'sales' };
    case 'customers':
      return { page: 'customers' };
    case 'items':
      return { page: 'items' };
    case 'settings':
      return { page: 'settings' };
    default:
      return { page: 'home' };
  }
}

export interface Desk {
  route: Route;
  go: (route: Route) => void;
  back: () => void;
}

export const DeskContext = createContext<Desk>({ route: { page: 'home' }, go: () => {}, back: () => {} });

export function useDesk(): Desk {
  return useContext(DeskContext);
}
