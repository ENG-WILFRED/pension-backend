import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBankNameToAccount1767600000000 implements MigrationInterface {
  name = 'AddBankNameToAccount1767600000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "bankName" character varying(128)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bankName"`);
  }
}
