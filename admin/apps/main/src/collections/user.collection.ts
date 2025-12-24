import { AuthService } from '@/services/auth.service';
import { MainDatabaseCollection } from '@packages/common';
import _ from 'lodash';
import type { CollectionConfig, AuthStrategyFunctionArgs, AuthStrategyResult } from 'payload';
// import { AuthStrategyResult } from 'payload/dist/auth/types';
import { Types } from 'mongoose';

export const UserCollection: CollectionConfig = {
  slug: MainDatabaseCollection.USER,
  admin: {
    useAsTitle: 'email',
  },
  timestamps: false,
  auth: true,
  // auth: {
  //   disableLocalStrategy: true,
  //   strategies: [
  //     {
  //       name: 'external-auth',
  //       authenticate: async (args): Promise<AuthStrategyResult> => {
  //         // console.log('Headers', args.headers, typeof args.headers);
  //         // console.log('emailField', args.payload.emailField);
  //         // console.log('email', AuthService.getEmail(), args.payload.emailField);
  //         // console.log('cookie', args.headers.getSetCookie(), args.headers.get('cookie'));
  //
  //         // const token = args.headers.get('cookie')?.split('access-token=')[1];
  //         const cookies = args.headers.get('cookie')?.split('; ') ?? [];
  //
  //         const cokkieMap = new Map(
  //           _.map(cookies, (cookie) => {
  //             const [key, value] = cookie.split('=');
  //             return [key, value];
  //           }),
  //         );
  //
  //         const accessToken = cokkieMap.get('access-token');
  //         console.log('access-token', accessToken);
  //
  //         if (args.headers.has('x-email') && args.headers.has('x-id')) {
  //           console.log('Inherit headers');
  //
  //           return {
  //             responseHeaders: args.headers,
  //             user: {
  //               id: args.headers.get('x-id')!,
  //               email: args.headers.get('x-email')!,
  //               collection: MainDatabaseCollection.USER,
  //             },
  //           };
  //         }
  //
  //         // console.log('New headers');
  //
  //         const res = await fetch('http://localhost:5555/auth', {
  //           method: 'GET',
  //           credentials: 'include',
  //         });
  //
  //         const data: { id: string; email: string } = await res.json();
  //
  //         try {
  //           const user = await args.payload.findByID({
  //             collection: MainDatabaseCollection.USER,
  //             id: data.id,
  //             disableErrors: true,
  //           });
  //
  //           // console.log('User', user);
  //
  //           if (user) {
  //             return {
  //               responseHeaders: args.headers,
  //               user: {
  //                 ...user,
  //                 collection: MainDatabaseCollection.USER,
  //               },
  //             };
  //           }
  //
  //           const createdUser = await args.payload.create({
  //             collection: MainDatabaseCollection.USER,
  //             data: {
  //               _id: data.id,
  //               email: data.email,
  //             } as any,
  //             overrideAccess: true,
  //             disableVerificationEmail: true,
  //           });
  //
  //           // console.log('createdUser', createdUser);
  //
  //           return {
  //             // responseHeaders: new Headers({
  //             //   'x-email': data.email,
  //             //   'x-id': data.id,
  //             //   Authorization: args.headers.get('Authorization') ?? '',
  //             // }),
  //             responseHeaders: args.headers,
  //             user: {
  //               ...createdUser,
  //               collection: MainDatabaseCollection.USER,
  //             },
  //           };
  //         } catch (error) {
  //           console.error(error, error.stack);
  //           return { user: null, responseHeaders: args.headers };
  //         }
  //       },
  //     },
  //   ],
  // },
  // auth: {
  //   lockTime: 60 * 60 * 1000,
  //   maxLoginAttempts: 10,
  //   // disableLocalStrategy: true,
  //   // strategies: [
  //   //   {
  //   //     name: 'local-custom',
  //   //     authenticate: async ({
  //   //       payload,
  //   //       headers,
  //   //     }: AuthStrategyFunctionArgs): Promise<AuthStrategyResult> => {
  //   //       console.log(headers);
  //   //
  //   //       const users = await payload.find({
  //   //         collection: MainDatabaseCollection.USER,
  //   //         where: {
  //   //           email: {
  //   //             equals: headers.get('email'),
  //   //           },
  //   //           password: {
  //   //             equals: headers.get('password'),
  //   //           },
  //   //         },
  //   //       });
  //   //
  //   //       if (!users.docs.length) {
  //   //         return { user: null };
  //   //       }
  //   //
  //   //       return {
  //   //         user: {
  //   //           ...users.docs[0],
  //   //           collection: MainDatabaseCollection.USER,
  //   //         },
  //   //       };
  //   //     },
  //   //   },
  //   // ],
  // },
  fields: [
    // {
    //   name: 'id',
    //   type: 'text',
    //   index: true,
    //   unique: true,
    //   hooks: {
    //     afterChange: [({ value }) => new Types.ObjectId(value.toString())],
    //   },
    // },
    {
      name: 'email',
      type: 'text',
      index: true,
    },
    // {
    //   name: 'password',
    //   type: 'text',
    //   required: true,
    // },
  ],
  hooks: {
    beforeLogin: [
      async (data) => {
        // console.log('before login', data);

        // await fetch('http://localhost:3336/my-route', {
        //   method: 'POST',
        //   body: JSON.stringify({ email: data.user?.email }),
        // });

        await fetch('http://localhost:5555/auth', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Set-Cookie': `access-token=12345; HttpOnly; Path=/; SameSite=false`,
          },
        });
      },
    ],
    afterLogin: [
      async (data) => {
        console.log('after login', data.req.headers, data.req.headers.get('cookie'));

        await fetch('http://localhost:5555/auth', {
          method: 'GET',
          credentials: 'include',
          // headers: {
          //   'Set-Cookie': `access-token=12345; HttpOnly; Path=/; SameSite=Lax`,
          // },
        });

        // console.log('after login', data);
        //
        // await fetch('http://localhost:3336/my-route', {
        //   method: 'POST',
        //   body: JSON.stringify({ email: data.user?.email }),
        // });
      },
    ],
  },
};
