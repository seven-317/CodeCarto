import { db } from '@/lib'

export default async function SettingsPage() {
  await fetch('/api/users', { method: 'POST' })
  const users = await db.user.findMany()
  return <pre>{JSON.stringify(users)}</pre>
}
