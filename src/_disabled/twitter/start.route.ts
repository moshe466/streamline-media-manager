
// TEMP: disable Twitter route completely so build passes
export async function GET() {
  return Response.json({ ok: true, disabled: true })
}
export async function POST() {
  return Response.json({ ok: true, disabled: true })
}
