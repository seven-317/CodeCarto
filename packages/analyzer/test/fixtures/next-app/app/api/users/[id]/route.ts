import { db } from '@/lib/db'

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  return Response.json(await db.user.findUnique({ where: { id: ctx.params.id } }))
}
