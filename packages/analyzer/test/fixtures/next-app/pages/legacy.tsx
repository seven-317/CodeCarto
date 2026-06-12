import { formatDate } from '../src/lib/utils'

export default function LegacyPage() {
  return <p>{formatDate(new Date())}</p>
}
