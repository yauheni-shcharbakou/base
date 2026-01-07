import { CommonDatabaseCollection } from '@packages/common';
import { AuthStrategy, AuthStrategyFunctionArgs, AuthStrategyResult } from 'payload';
import { ExternalAuthService } from 'services';

export class ExternalAuthStrategy implements AuthStrategy {
  public name: string = 'external-auth';
  private readonly externalAuthService: ExternalAuthService;

  constructor(authUrl: string) {
    this.externalAuthService = new ExternalAuthService(authUrl);
  }

  async authenticate({ headers, payload }: AuthStrategyFunctionArgs): Promise<AuthStrategyResult> {
    const cookie = headers.get('cookie');

    if (!cookie) {
      return { user: null };
    }

    try {
      const externalUser = await this.externalAuthService.getCurrentUser(cookie);

      if (!externalUser) {
        return { user: null };
      }

      const { docs } = await payload.find({
        collection: CommonDatabaseCollection.EXTERNAL_USER,
        where: { email: { equals: externalUser.email } },
        limit: 1,
      });

      let user = docs[0];

      if (!docs.length) {
        user = await payload.create({
          collection: CommonDatabaseCollection.EXTERNAL_USER,
          data: {
            externalId: externalUser.id,
            email: externalUser.email,
            role: externalUser.role,
          },
        });
      }

      return {
        user: {
          ...user,
          collection: CommonDatabaseCollection.EXTERNAL_USER,
        },
      };
    } catch (err) {
      return { user: null };
    }
  }
}
