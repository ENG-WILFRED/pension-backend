import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRoleToUser1766300000000 implements MigrationInterface {
    name = 'AddRoleToUser1766300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "role" character varying NOT NULL DEFAULT 'customer'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    }

}
