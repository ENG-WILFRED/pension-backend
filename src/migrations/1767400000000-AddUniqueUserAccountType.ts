import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueUserAccountType1767400000000 implements MigrationInterface {
  name = 'AddUniqueUserAccountType1767400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_accounts_userId_accountType_unique" ON "accounts" ("userId", "accountType");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_accounts_userId_accountType_unique"`);
  }
}
