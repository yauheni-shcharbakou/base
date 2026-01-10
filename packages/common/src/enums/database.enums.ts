export enum MigrationStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum AdminCollectionGroup {
  SYSTEM = 'System',
  AUTH = 'Auth',
}

export enum CommonDatabaseCollection {
  MIGRATION = 'migrations',
  EXTERNAL_USER = 'external-users',
}

export enum AuthDatabaseCollection {
  USER = 'users',
}

export enum MainDatabaseCollection {
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
