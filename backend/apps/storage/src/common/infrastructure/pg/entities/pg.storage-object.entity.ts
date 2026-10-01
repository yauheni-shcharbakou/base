import { PgEntity, PgProp, PgSchema } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import { PgVideoEntity } from '@common/infrastructure/pg/entities/pg.video.entity';
import { Collection, Ref } from '@mikro-orm/core';
import {
  Check,
  Formula,
  Index,
  ManyToOne,
  OneToMany,
  OneToOne,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import { StorageDatabaseEntity } from '@packages/common';
import { PgFileEntity } from './pg.file.entity';

export const ROOT_FOLDER_UNIQUE_INDEX = 'storage-objects_root_folder_unique';
export const NAME_UNIQUE_INDEX = 'storage-objects_name_unique';
export const OWNER_ID_UNIQUE = 'storage-objects_owner_id_unique';
export const PARENT_OWNER_FOREIGN_KEY = 'storage-objects_parent_owner_foreign';

const TABLE = StorageDatabaseEntity.STORAGE_OBJECT;

// Moves check for a cycle under the tree lock, so only a row written outside the service can close
// one; the bound keeps a read of such a row from recursing forever. Real trees are nowhere near
// this deep. Every walk up the tree stops at it: the path formula and the repository's ancestors.
export const MAX_FOLDER_DEPTH = 64;

// A leaf of `folderStats`, over its row `o` and its file `f`: counted once its upload is READY.
const READY_LEAF = `not o.is_folder and f.upload_status = '${NestStorage.FileUploadStatus.READY}'`;

/**
 * A user owns exactly one root folder. Enforced in the database rather than by a read-then-write
 * check, because the `auth.user.create` subscriber is at-least-once: two replicas (or a stalled
 * BullMQ job handed to a second worker) would otherwise both see "no folder" and both insert.
 */
@Index({
  name: ROOT_FOLDER_UNIQUE_INDEX,
  expression:
    `create unique index "${ROOT_FOLDER_UNIQUE_INDEX}" ` +
    `on "${TABLE}" ("user_id") ` +
    `where "is_folder" = true and "parent_id" is null`,
})
/**
 * A name is unique among a folder's live objects, folders and files alike. Creates and edits check
 * it under the owner's tree lock; this is the backstop for a row written any other way. A deleted
 * object drops out of it and frees its name at once.
 */
@Index({
  name: NAME_UNIQUE_INDEX,
  expression:
    `create unique index "${NAME_UNIQUE_INDEX}" ` +
    `on "${TABLE}" ("parent_id", "name") ` +
    `where "is_deleted" = false`,
})
/**
 * The target of `storage-objects_parent_owner_foreign`, which the migration declares in SQL —
 * `(user_id, parent_id) references (user_id, id)`: a parent is always a row of the same owner, so no
 * `parent` link crosses two users' trees, whoever writes the row. MikroORM cannot express a foreign
 * key onto a non-primary key, which is why `parent` creates none of its own. `user_id` leads, so
 * this also serves every lookup by owner.
 */
@Unique({ name: OWNER_ID_UNIQUE, properties: ['userId', 'id'] })
@Check({ name: 'storage-objects_parent_not_self_check', expression: '"parent_id" <> "id"' })
@Check({
  name: 'storage-objects_is_folder_check',
  expression: `"is_folder" = ("type" = '${NestStorage.StorageObjectType.FOLDER}')`,
})
// A leaf is always placed; only a root folder has no parent.
@Check({
  name: 'storage-objects_leaf_placed_check',
  expression: '"is_folder" or "parent_id" is not null',
})
// `folderPath` joins names with '/', so a name holding one would read as two levels. Only the root
// folder is nameless.
@Check({
  name: 'storage-objects_name_check',
  expression: `strpos("name", '/') = 0 and ("name" <> '' or "parent_id" is null)`,
})
@PgSchema({ tableName: TABLE })
export class PgStorageObjectEntity
  extends PgEntity<'children' | 'isDeleted' | 'fileId' | 'imageId' | 'videoId' | 'parentId'>
  implements StorageObject
{
  // Never changes after insert: the tree lock is keyed by it and read before the lock is taken.
  // Lookups by owner use the leading column of `storage-objects_owner_id_unique`.
  @Property()
  userId: string;

  // No single-column index on `name` or the flags below: none is selective on its own, and an
  // index on a column the subtree `UPDATE`s rewrite (`is_public`, `is_deleted`) rules out a HOT
  // update for every row they touch. Names are found through the per-folder unique index.
  //
  // The column is `collate "natural_order"` (ICU, numbers by value), set by a hand-written migration
  // no property option can express. A generated `alter column "name" type …` carries no `collate`
  // and silently resets it to the default: add `collate "natural_order"` to any such statement.
  @Property()
  name: string;

  @Property({ default: false })
  isPublic: boolean;

  @Property({ default: false })
  isFolder: boolean;

  @Property({ default: false })
  isDeleted = false;

  @PgProp.Enum({ enum: NestStorage.StorageObjectType })
  type: NestStorage.StorageObjectType;

  // Indexed for the subtree walks (the `isPublic` cascade, the delete mark, the cleanup sweep),
  // which step down one level at a time by `parent_id`. Its foreign key is the owner-scoped
  // `storage-objects_parent_owner_foreign` (see the class), declared in the migration, and it is
  // `no action` on delete: folders go leaves first, so a parent deleted ahead of a child is a bug to
  // fail on, not a subfolder to turn silently into a second root.
  @ManyToOne({
    entity: () => PgStorageObjectEntity,
    nullable: true,
    ref: true,
    index: true,
    createForeignKeyConstraint: false,
  })
  parent?: Ref<PgStorageObjectEntity>;

  @Property({ persist: false, type: 'string' })
  get parentId() {
    return this.parent?.id;
  }

  @OneToMany({
    entity: () => PgStorageObjectEntity,
    mappedBy: 'parent',
  })
  children = new Collection<PgStorageObjectEntity>(this);

  @OneToOne({
    entity: () => PgFileEntity,
    mappedBy: 'storageObject',
    owner: true,
    nullable: true,
    deleteRule: 'cascade',
    ref: true,
  })
  file?: Ref<NestStorage.File>;

  @Property({ persist: false, type: 'string' })
  get fileId() {
    return this.file?.id;
  }

  /**
   * Derived from the tree on every read, never stored: '/' for a root folder, '/A/B/' for a nested
   * one (the root's own name is not part of it), null for a leaf. Nothing has to be cascaded when a
   * folder is moved or renamed, and no stored copy can drift from `parent_id`.
   *
   * Lazy — computed only where `populate: ['folderPath']` asks for it, as a correlated subquery in
   * the same SELECT: a whole page is still one statement, never a query per row. The walk goes up by
   * primary key, one lookup per level, and the CASE skips leaves and roots without running it.
   */
  @Formula(
    (cols) => `(case
      when not ${cols.isFolder} then null
      when ${cols.parent} is null then '/'
      else (
        with recursive up (parent_id, path, depth) as (
            select ${cols.parent}, ${cols.name}::text, 1
          union all
            select p.parent_id, p.name || '/' || up.path, up.depth + 1
            from up
            inner join "${StorageDatabaseEntity.STORAGE_OBJECT}" p on p.id = up.parent_id
            where p.parent_id is not null and up.depth < ${MAX_FOLDER_DEPTH}
        )
        select '/' || path || '/' from up order by depth desc limit 1
      )
    end)`,
    { lazy: true },
  )
  folderPath?: string;

  /**
   * What a folder holds, derived from the tree on every read like `folderPath`, and null for a leaf:
   * its live subfolders at any depth, the leaves among them whose upload is READY, and the sum of
   * those leaves' sizes. An image or a video counts through its backing file, which carries the
   * status and the size. Nothing is stored, so no write — an upload turning READY, a move, a delete —
   * has to keep a counter in step (ADR-0033).
   *
   * Lazy, and one walk down per row: a correlated subquery of the same SELECT that steps through live
   * children by `parent_id` (indexed) and aggregates what it reached. `UNION` over ids ends it on a
   * `parent_id` cycle. The folders of one page hold disjoint subtrees, so a listing walks about as
   * many rows as the subtree of the folder it lists.
   */
  @Formula(
    (cols) => `(case
      when not ${cols.isFolder} then null
      else (
        with recursive sub (id) as (
            select c.id from "${StorageDatabaseEntity.STORAGE_OBJECT}" c
            where c.parent_id = ${cols.id} and not c.is_deleted
          union
            select c.id from sub
            inner join "${StorageDatabaseEntity.STORAGE_OBJECT}" c on c.parent_id = sub.id
            where not c.is_deleted
        )
        select json_build_object(
          'fileCount', count(*) filter (where ${READY_LEAF}),
          'folderCount', count(*) filter (where o.is_folder),
          'totalSize', coalesce(sum(f.size) filter (where ${READY_LEAF}), 0)
        )
        from sub
        inner join "${StorageDatabaseEntity.STORAGE_OBJECT}" o on o.id = sub.id
        left join "${StorageDatabaseEntity.FILE}" f on f.id = o.file_id
      )
    end)`,
    { lazy: true, type: 'json' },
  )
  folderStats?: NestStorage.StorageObjectFolderStats;

  @OneToOne({
    entity: () => PgImageEntity,
    mappedBy: 'storageObject',
    owner: true,
    nullable: true,
    deleteRule: 'cascade',
    ref: true,
  })
  image?: Ref<NestStorage.Image>;

  @Property({ persist: false, type: 'string' })
  get imageId() {
    return this.image?.id;
  }

  @OneToOne({
    entity: () => PgVideoEntity,
    mappedBy: 'storageObject',
    owner: true,
    nullable: true,
    deleteRule: 'cascade',
    ref: true,
  })
  video?: Ref<NestStorage.Video>;

  @Property({ persist: false, type: 'string' })
  get videoId() {
    return this.video?.id;
  }
}
