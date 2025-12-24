import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTermsAndConditions1766564879239 implements MigrationInterface {
    name = 'CreateTermsAndConditions1766564879239'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_users_username_unique"`);
        await queryRunner.query(`CREATE TABLE "terms_and_conditions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "body" text NOT NULL, "createdDate" TIMESTAMP NOT NULL DEFAULT now(), "updatedDate" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4ab651fa6e201399c954dbe263d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL`);
        await queryRunner.query(`DROP TABLE "terms_and_conditions"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_username_unique" ON "users" ("username") `);
    }

}
