import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBankDetailsTable1767300000000 implements MigrationInterface {
  name = 'CreateBankDetailsTable1767300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the new bank_details table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bank_details" (
        "id" SERIAL PRIMARY KEY,
        "accountId" integer NOT NULL,
        "bankAccountName" character varying(200),
        "bankBranchName" character varying(64),
        "bankBranchCode" character varying(32),
        "bankAccountNumber" character varying(64),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_bank_details_accounts" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE
      )
    `);

    // Create index on accountId for faster queries
    await queryRunner.query(`CREATE INDEX "IDX_bank_details_accountId" ON "bank_details" ("accountId")`);

    // Copy existing bank details from accounts table to bank_details table
    await queryRunner.query(`
      INSERT INTO "bank_details" ("accountId", "bankAccountName", "bankBranchName", "bankBranchCode", "bankAccountNumber", "createdAt", "updatedAt")
      SELECT "id", "bankAccountName", "bankBranchName", "bankBranchCode", "bankAccountNumber", "createdAt", "updatedAt"
      FROM "accounts"
      WHERE "bankAccountName" IS NOT NULL OR "bankAccountNumber" IS NOT NULL
    `);

    // Drop the bank detail columns from accounts table
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankAccountName"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankBranchName"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankBranchCode"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankAccountNumber"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add the bank detail columns back to accounts table
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN "bankAccountName" character varying(200)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN "bankBranchName" character varying(64)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN "bankBranchCode" character varying(32)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN "bankAccountNumber" character varying(64)`);

    // Copy data back from bank_details to accounts
    await queryRunner.query(`
      UPDATE "accounts" a
      SET 
        "bankAccountName" = bd."bankAccountName",
        "bankBranchName" = bd."bankBranchName",
        "bankBranchCode" = bd."bankBranchCode",
        "bankAccountNumber" = bd."bankAccountNumber"
      FROM "bank_details" bd
      WHERE a."id" = bd."accountId"
    `);

    // Drop the bank_details table
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_details"`);
  }
}
