import { formatDate } from '@/lib'
import { UserList } from '@/components/UserList'

export default async function HomePage() {
  const { Chart } = await import('@/components/Chart')
  return (
    <main>
      {formatDate(new Date())}
      <UserList />
      <Chart />
    </main>
  )
}
