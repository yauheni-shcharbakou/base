import { ExternalAuthResponse, ExternalUser } from 'interfaces';
import _ from 'lodash';

export class ExternalAuthService {
  constructor(private readonly authUrl: string) {}

  async getCurrentUser(cookie = ''): Promise<ExternalUser | null> {
    const response = await fetch(`${this.authUrl}/api/users/me`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        cookie,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: ExternalAuthResponse = await response.json();

    if (!data.user) {
      return null;
    }

    return _.pick(data.user, ['id', 'email', 'role']);
  }
}
