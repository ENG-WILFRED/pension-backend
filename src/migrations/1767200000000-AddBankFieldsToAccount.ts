import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBankFieldsToAccount1767200000000 implements MigrationInterface {
  name = 'AddBankFieldsToAccount1767200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "bankAccountName" character varying(200)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "bankBranchName" character varying(64)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "bankBranchCode" character varying(32)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "bankAccountNumber" character varying(64)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankAccountNumber"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankBranchCode"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankBranchName"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankAccountName"`);
  }
}
