'use client'
import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'

export function UserList() {
  const [users, setUsers] = useState<unknown[]>([])
  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then(setUsers)
  }, [])

  async function loadOne(id: string) {
    return fetch(`/api/users/${id}`)
  }

  async function loadResource(resource: string) {
    return fetch(`/api/${resource}`)
  }

  void loadOne
  void loadResource
  return (
    <ul>
      {users.length} {formatDate(new Date())}
    </ul>
  )
}
