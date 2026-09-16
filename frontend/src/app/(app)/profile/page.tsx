import type { Metadata } from 'next';
import { ProfilePage } from '@/components/account/AccountPages';

export const metadata: Metadata = { title: 'Profile' };

export default function Page() {
  return <ProfilePage />;
}
