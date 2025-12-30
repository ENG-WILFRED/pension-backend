import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1767115131809 implements MigrationInterface {
    name = 'Init1767115131809'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying NOT NULL, "title" character varying, "fileName" character varying, "pdfBase64" text, "metadata" json, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD "bankAccountName" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD "bankBranchName" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD "bankBranchCode" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD "bankAccountNumber" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "title" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "bankAccountNumber"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "bankBranchCode"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "bankBranchName"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "bankAccountName"`);
        await queryRunner.query(`DROP TABLE "reports"`);
    }

}
