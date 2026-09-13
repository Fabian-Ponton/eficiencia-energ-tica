import { describe, expect, it } from 'vitest';
import type { CloudSession } from '@/domain/types';
import { createCloudClient, type CloudRow } from '@/sync/client';

const headersOf = (init: RequestInit) => init.headers as Record<string, string>;

describe('cliente de Supabase por HTTP', () => {
  it('usa la clave pública, el token del usuario y la secuencia del servidor', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init: init ?? {} });
      if (url.includes('/auth/v1/token')) {
        return new Response(JSON.stringify({ access_token: 'token-usuario', refresh_token: 'renovar', expires_in: 3600, user: { id: 'u-1', email: 'auditor@ejemplo.co' } }), { status: 200 });
      }
      if (init?.method === 'POST') return new Response(null, { status: 201 });
      return new Response('[]', { status: 200 });
    }) as typeof fetch;
    const client = createCloudClient('https://demo.supabase.co/', 'anon-123', fakeFetch);

    const session = await client.signIn('auditor@ejemplo.co', 'secreta');
    expect(session).toMatchObject({ accessToken: 'token-usuario', refreshToken: 'renovar', userId: 'u-1', email: 'auditor@ejemplo.co' });
    expect(calls[0].url).toBe('https://demo.supabase.co/auth/v1/token?grant_type=password');
    expect(headersOf(calls[0].init).apikey).toBe('anon-123');

    const row: CloudRow = { owner: 'u-1', table_name: 'areas', id: 'a1', project_id: 'p1', data: { name: 'Aula 601' }, updated_at: 1, deleted_at: null };
    await client.upsert(session, [row]);
    expect(calls[1].url).toBe('https://demo.supabase.co/rest/v1/pontia_records?on_conflict=owner,table_name,id');
    expect(headersOf(calls[1].init).Authorization).toBe('Bearer token-usuario');
    expect(headersOf(calls[1].init).Prefer).toContain('merge-duplicates');
    expect(JSON.parse(String(calls[1].init.body))).toEqual([row]);

    await client.pull(session, 42, 500);
    expect(calls[2].url).toContain('server_seq=gt.42');
    expect(calls[2].url).toContain('order=server_seq.asc');
    expect(calls[2].url).toContain('limit=500');

    await client.uploadPhoto(session, 'u-1/p1/f1.jpg', new Blob([new Uint8Array([1, 2])], { type: 'image/jpeg' }));
    expect(calls[3].url).toBe('https://demo.supabase.co/storage/v1/object/pontia-fotos/u-1/p1/f1.jpg');
    expect(headersOf(calls[3].init)['x-upsert']).toBe('true');
  });

  it('explica en español los errores más comunes', async () => {
    const session: CloudSession = { accessToken: 't', refreshToken: 'r', expiresAt: 0, userId: 'u', email: 'auditor@ejemplo.co' };
    const answering = (body: object, status: number) => createCloudClient('https://demo.supabase.co', 'anon', (async () => new Response(JSON.stringify(body), { status })) as typeof fetch);
    await expect(answering({ error_description: 'Invalid login credentials' }, 400).signIn('auditor@ejemplo.co', 'mala')).rejects.toThrow('Correo o contraseña incorrectos.');
    await expect(answering({ message: 'relation "public.pontia_records" does not exist' }, 404).pull(session, 0, 10)).rejects.toThrow('ejecuta el SQL de PONTIA');
    // Si la cuenta necesita confirmar el correo, Supabase no devuelve sesión
    expect(await answering({ id: 'u', email: 'auditor@ejemplo.co' }, 200).signUp('auditor@ejemplo.co', 'secreta')).toBeNull();
    const offline = createCloudClient('https://demo.supabase.co', 'anon', (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch);
    await expect(offline.ping()).rejects.toThrow('No hay conexión con la nube');
  });
});
