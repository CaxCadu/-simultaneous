// Proxy da API publica do Deezer (ela nao envia CORS). Apenas leituras permitidas.
const ALLOWED = [/^search$/, /^track\/[A-Za-z0-9:_-]+$/];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const path = (await params).path.join("/");
  if (!ALLOWED.some((re) => re.test(path))) {
    return Response.json({ error: "not allowed" }, { status: 403 });
  }
  const url = new URL(req.url);
  const upstream = await fetch(`https://api.deezer.com/${path}${url.search}`, {
    next: { revalidate: 3600 },
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=3600" },
  });
}
