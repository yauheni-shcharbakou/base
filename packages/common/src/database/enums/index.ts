export enum Database {
  AUTH = 'auth',
  MAIN = 'main',
  STORAGE = 'storage',
}

export enum CommonDatabaseEntity {
  MIGRATION = 'migrations',
}

export enum AuthDatabaseEntity {
  USER = 'users',
  TEMP_CODE = 'temp-codes',
}

export enum StorageDatabaseEntity {
  FILE = 'files',
  IMAGE = 'images',
  STORAGE_OBJECT = 'storage-objects',
  VIDEO = 'videos',
}

export enum MainDatabaseEntity {
  CONTACT = 'contacts',
  EXPERIENCE = 'experiences',
  JOB = 'jobs',
  LANGUAGE = 'languages',
  IDENTITY = 'identities',
  COMPANY = 'companies',
  PROJECT = 'projects',
  EDUCATION = 'educations',
  CERTIFICATE = 'certificates',
}
