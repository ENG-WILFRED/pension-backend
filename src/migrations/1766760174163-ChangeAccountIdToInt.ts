import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeAccountIdToInt1766760174163 implements MigrationInterface {
    name = 'ChangeAccountIdToInt1766760174163'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_26d8aec71ae9efbe468043cd2b9"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "PK_5a7a02c20412299d198e097a8fe"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD "id" SERIAL NOT NULL`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "accountNumber" DROP NOT NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_26d8aec71ae9efbe468043cd2b"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "accountId"`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "accountId" integer`);
        await queryRunner.query(`CREATE INDEX "IDX_26d8aec71ae9efbe468043cd2b" ON "transactions" ("accountId") `);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_26d8aec71ae9efbe468043cd2b9" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_26d8aec71ae9efbe468043cd2b9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_26d8aec71ae9efbe468043cd2b"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "accountId"`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "accountId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_26d8aec71ae9efbe468043cd2b" ON "transactions" ("accountId") `);
        await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "accountNumber" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "PK_5a7a02c20412299d198e097a8fe"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_26d8aec71ae9efbe468043cd2b9" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
