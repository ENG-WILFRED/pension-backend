import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1766411857193 implements MigrationInterface {
    name = 'Init1766411857193'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_checkoutRequestId"`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" character varying NOT NULL DEFAULT 'customer'`);
        await queryRunner.query(`UPDATE "transactions" SET "checkoutRequestId" = uuid_generate_v4()::text WHERE "checkoutRequestId" IS NULL`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "checkoutRequestId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "UQ_95cab76803dd931682117e63ea3"`);
        await queryRunner.query(`UPDATE "users" SET "phone" = 'unknown_' || id WHERE "phone" IS NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_95cab76803dd931682117e63ea" ON "transactions" ("checkoutRequestId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_95cab76803dd931682117e63ea"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "UQ_95cab76803dd931682117e63ea3" UNIQUE ("checkoutRequestId")`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "checkoutRequestId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_checkoutRequestId" ON "transactions" ("checkoutRequestId") `);
    }

}
