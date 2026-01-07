import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1767815269560 implements MigrationInterface {
    name = 'Init1767815269560'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Make this migration idempotent: only create objects if they don't exist
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "bank_details" ("id" SERIAL NOT NULL, "accountId" integer NOT NULL, "bankAccountName" character varying(200), "bankBranchName" character varying(64), "bankBranchCode" character varying(32), "bankAccountNumber" character varying(64), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ddbbcb9586b7f4d6124fe58f257" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_4f792e594e13070c227f30212f" ON "bank_details" ("accountId") `);
        // Drop old bank columns if present
        await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankBranchName"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankBranchCode"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankAccountNumber"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankName"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankAccountName"`);
        // Ensure the unique index exists without failing if already present
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fd64de0f7539597004d51cab4c" ON "accounts" ("userId", "accountType") `);
        // Foreign key constraint for bank_details->accounts should already exist when the table was created earlier.
        // Skipping adding FK here to avoid duplicate-constraint errors.
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bank_details" DROP CONSTRAINT "FK_4f792e594e13070c227f30212fe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fd64de0f7539597004d51cab4c"`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD "bankAccountName" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD "bankName" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD "bankAccountNumber" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD "bankBranchCode" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD "bankBranchName" character varying(64)`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f792e594e13070c227f30212f"`);
        await queryRunner.query(`DROP TABLE "bank_details"`);
    }

}
