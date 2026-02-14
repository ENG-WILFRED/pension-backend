import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPendingPinToUser1767880000000 implements MigrationInterface {
    name = 'AddPendingPinToUser1767880000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add pendingPin column if it doesn't exist
        const hasColumn = await queryRunner.hasColumn("users", "pendingPin");
        if (!hasColumn) {
            await queryRunner.query(`ALTER TABLE "users" ADD "pendingPin" character varying`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "pendingPin"`);
    }

}
