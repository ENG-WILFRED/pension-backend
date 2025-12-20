import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPhoneUnique1766255144616 implements MigrationInterface {
    name = 'AddPhoneUnique1766255144616'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, nullify duplicate phone numbers (keep first occurrence)
        await queryRunner.query(`
            UPDATE "users" SET "phone" = NULL
            WHERE "phone" IS NOT NULL AND id NOT IN (
                SELECT DISTINCT ON ("phone") id FROM "users"
                WHERE "phone" IS NOT NULL
                ORDER BY "phone", "createdAt" ASC
            )
        `);
        
        // Now add unique constraint on phone column (allows multiple NULLs)
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_a000cca60bcf04454e727699490"`);
    }

}
