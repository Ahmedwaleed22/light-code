import { signal } from '@preact/signals';
import { getJSON } from '../../shared/api/client';

export const apiStatus = signal<'checking' | 'online' | 'offline'>('checking');

export async function checkHealth(): Promise<void> {
  try {
    const result = await getJSON<{ status: string }>('/api/health');
    apiStatus.value = result.status === 'ok' ? 'online' : 'offline';
  } catch {
    apiStatus.value = 'offline';
  }
}
