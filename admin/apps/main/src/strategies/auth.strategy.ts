import payload, { AuthStrategy, AuthStrategyFunctionArgs } from 'payload';
import jwt from 'jsonwebtoken';

// export const ExternalAuthStrategy: AuthStrategy = {
//   name: 'external-auth',
//   authenticate: async (args: AuthStrategyFunctionArgs) => {
//     const auth = req.headers.authorization;
//     if (!auth?.startsWith('Bearer ')) return null;
//
//     const token = auth.slice(7);
//
//     const decoded = jwt.verify(token, process.env.EXTERNAL_JWT_PUBLIC_KEY!);
//
//     // decoded.sub — userId из внешней БД
//     const externalId = decoded.sub;
//
//     let user = await payload.find({
//       collection: 'users',
//       where: { externalId: { equals: externalId } },
//       limit: 1,
//     });
//
//     if (!user.docs.length) {
//       // создаём shadow user
//       user = await payload.create({
//         collection: 'users',
//         data: {
//           externalId,
//           email: decoded.email,
//           roles: decoded.roles ?? ['viewer'],
//         },
//         overrideAccess: true,
//       });
//     }
//
//     return {
//       user: user.docs[0],
//     };
//   },
// };
