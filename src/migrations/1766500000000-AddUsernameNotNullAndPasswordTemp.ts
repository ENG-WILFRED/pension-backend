import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsernameNotNullAndPasswordTemp1766500000000 implements MigrationInterface {
    name = 'AddUsernameNotNullAndPasswordTemp1766500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add passwordIsTemporary column with default false
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordIsTemporary" boolean NOT NULL DEFAULT false`);

        // Populate null usernames by extracting local part of email or generating from id
        await queryRunner.query(`UPDATE "users" SET "username" = split_part(email, '@', 1) WHERE username IS NULL AND email IS NOT NULL`);
        await queryRunner.query(`UPDATE "users" SET "username" = 'user_' || substring(id::text, 1, 8) WHERE username IS NULL`);

        // Add unique constraint on username if not exists
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_username_unique" ON "users" (username)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_username_unique"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordIsTemporary"`);
    }
}
