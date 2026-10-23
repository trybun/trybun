import { requireSession } from '../lib/auth/session.js';

export default async function HomePage() {
  await requireSession();
  return <main />;
}
