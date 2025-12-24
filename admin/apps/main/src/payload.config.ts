import { DatabaseValidationSchema, validateEnv } from '@packages/common';
import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import Joi from 'joi';
import { pbkdf2, scryptSync, timingSafeEqual } from 'crypto';
import { headers } from 'next/headers';
import path from 'path';
import { buildConfig } from 'payload';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
// @ts-ignore
// import scmp from 'scmp';

// const salt = '36879b1d38ea9b44b6029d3f40cdc42011130b8ef67f6a565c36913d95bd4b19';
// const hash =
//   'f65f96c6dfe2133ea719f60a26ba1b766554e2141437bf5de9c1e777e8d0340ac79ae63ed886dd47a727510fdfd53ee94e748ba493b68e88c2027521196ed3780d95c810d5f8fef2a30b630b65279f7e5fe7a1867b1927c2b6ad1f742861cf5c30a418c1ce3fc1094df611666c72bd4173ce93caab2e2c719990bb37a7c10c23032942f61c497b108d25ef8d13df9e0ad20cf6ea0ba98adec827906c74cb97f0a91407c5379c9373301c1cf5af8227fc22a3945eefb219f287591cc7d9ce7af7d04c78b91d4e5f237f371d11b674701cc473e38d75062cff237b530c2fc9a6deae399efedad6fb5279247dbd691e1653d03a7f535c810c1736355100dbfaa54f83b0cd4cea4f1f23c606b3dce5d5cd51d4e3cd48544de517fba0f6b3bad57e79b80f387a9e1f3c187db7e042170ccc327e1e38a57973f1fe31ee59085cabf649842bd25e70307844adb77315662b684239996e933aab25bcbb1d942d4f45473ecaf400404fcf15710885f2d1acc2417f0ca208ad798a478d50592bbfa559e01f71a361b1e55b272d62d4571cdb488488fdcafe1f40becd94d49578985d1b67ee22192dd59ebbc99fee5f1a70cc746a48e2eb912443605ba6728b81c3c542b682091017cba819108f1d6d29ad41ab47041e8a135055681cb62a1e2b738ed10c0bce020ee645050f5b54a7a0c348e87cf99525728dc6285046b6327d8f20bf978c';
//
// const res = await new Promise<boolean>((resolve, reject) => {
//   pbkdf2('string123', salt, 25000, 512, 'sha256', (e, hashBuffer) => {
//     if (e) {
//       reject(e);
//     }
//
//     if (timingSafeEqual(hashBuffer, Buffer.from(hash, 'hex'))) {
//       resolve(true);
//     }
//     // if (scmp(hashBuffer, Buffer.from(hash, 'hex'))) {
//     //   resolve(true);
//     else {
//       reject(new Error('Invalid password'));
//     }
//   });
// });
//
// console.log(res);

// const generatedHash = pbkdf2('string123', salt, 25000, 512, 'sha256');
// console.log(generatedHash);
// console.log(timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hash)));

const env = validateEnv({
  ...DatabaseValidationSchema,
  PAYLOAD_SECRET: Joi.string().required(),
});

import { UserCollection } from 'src/collections/user.collection';
import { MediaCollection } from 'src/collections/media.collection';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: UserCollection.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [UserCollection, MediaCollection],
  editor: lexicalEditor(),
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({ url: env.DATABASE_URL }),
  sharp,
  plugins: [],
  // onInit: async (payload) => {
  //   console.log('payload', payload);
  //   payload.config.custom['email'] = payload.emailField;
  // },
});
