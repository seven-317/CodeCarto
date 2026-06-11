import { db } from '@/lib/db'

export async function GET() {
  return Response.json(await db.user.findMany())
}

export const POST = async (req: Request) => {
  const body = await req.json()
  return Response.json(await db.user.create({ data: body }))
}
